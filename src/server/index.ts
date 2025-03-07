import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { statfs } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Global variables
let db: any;
const scanProgress = {
  isScanning: false,
  totalItems: 0,
  scannedItems: 0,
  currentPath: '',
  lastScanTime: null as string | null,
  errors: [] as string[],
  logs: [] as Array<{ timestamp: string; level: string; message: string }>,
  initializing: true
};

// Express app setup
const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || '/appdata/database.sqlite';

// Add logging function
function log(level: 'info' | 'error' | 'warn', message: string) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message
  };
  scanProgress.logs.push(logEntry);
  console.log(`[${logEntry.timestamp}] ${level.toUpperCase()}: ${message}`);
}

// Initialize database
async function initializeDatabase() {
  try {
    log('info', 'Initializing database...');
    
    const dbDir = dirname(DB_PATH);
    await fs.mkdir(dbDir, { recursive: true });
    
    try {
      await fs.access(dbDir, fs.constants.W_OK);
      log('info', `Write permission confirmed for directory: ${dbDir}`);
    } catch (error) {
      throw new Error(`No write permission for database directory ${dbDir}`);
    }
    
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    log('info', 'Database connection established');

    // Create tables if they don't exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS monitored_folders (
        id TEXT PRIMARY KEY,
        path TEXT UNIQUE NOT NULL,
        size INTEGER NOT NULL DEFAULT 0,
        items INTEGER NOT NULL DEFAULT 0,
        last_scan DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS storage_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        used_size INTEGER NOT NULL,
        free_size INTEGER NOT NULL,
        folder_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS file_stats (
        path TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        size INTEGER NOT NULL,
        type TEXT NOT NULL,
        modified DATETIME NOT NULL,
        parent_folder TEXT NOT NULL,
        FOREIGN KEY(parent_folder) REFERENCES monitored_folders(path)
      );

      CREATE TABLE IF NOT EXISTS duplicate_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        size INTEGER NOT NULL,
        paths TEXT NOT NULL
      );
    `);

    scanProgress.initializing = false;
    log('info', 'Database initialization complete');
  } catch (error) {
    log('error', `Database initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function validatePath(path: string): Promise<{ valid: boolean; error?: string }> {
  try {
    await fs.access(path, fs.constants.R_OK);
    const stats = await fs.stat(path);
    if (!stats.isDirectory()) {
      return { valid: false, error: 'Path is not a directory' };
    }
    await fs.readdir(path);
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: `Path is not accessible: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function scanDirectory(dirPath: string, folderId: string): Promise<{ size: number; items: number }> {
  try {
    scanProgress.currentPath = dirPath;
    log('info', `Scanning directory: ${dirPath}`);
    
    let totalSize = 0;
    let totalItems = 0;

    const validation = await validatePath(dirPath);
    if (!validation.valid) {
      const errorMsg = `Skipping inaccessible path: ${dirPath} - ${validation.error}`;
      scanProgress.errors.push(errorMsg);
      log('error', errorMsg);
      return { size: 0, items: 0 };
    }

    const files = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);
      
      try {
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          const { size, items } = await scanDirectory(fullPath, folderId);
          totalSize += size;
          totalItems += items;
        } else {
          totalSize += stats.size;
          totalItems++;
          scanProgress.scannedItems++;
          
          await db.run(
            'INSERT OR REPLACE INTO file_stats (path, name, size, type, modified, parent_folder) VALUES (?, ?, ?, ?, ?, ?)',
            [fullPath, file.name, stats.size, path.extname(file.name) || 'unknown', stats.mtime.toISOString(), dirPath]
          );
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EACCES') {
          const errorMsg = `Permission denied: ${fullPath}`;
          scanProgress.errors.push(errorMsg);
          log('error', errorMsg);
          continue;
        }
        log('error', `Error scanning ${fullPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Update storage history for this folder
    const stats = await statfs(dirPath);
    const freeFolderSize = stats.bfree * stats.bsize;
    
    await db.run(
      'INSERT INTO storage_history (used_size, free_size, folder_id) VALUES (?, ?, ?)',
      [totalSize, freeFolderSize, folderId]
    );

    // Update last scan time
    scanProgress.lastScanTime = new Date().toISOString();
    await db.run(
      'UPDATE monitored_folders SET last_scan = ?, size = ?, items = ? WHERE id = ?',
      [scanProgress.lastScanTime, totalSize, totalItems, folderId]
    );

    log('info', `Scan completed for ${dirPath}: ${totalItems} items, ${totalSize} bytes`);
    
    return { size: totalSize, items: totalItems };
  } catch (error) {
    const errorMsg = `Failed to scan directory: ${dirPath} - ${error instanceof Error ? error.message : String(error)}`;
    log('error', errorMsg);
    throw error;
  }
}

// API Routes
app.get('/api/scan/status', (_req, res) => {
  res.json({
    ...scanProgress,
    logs: scanProgress.logs.slice(-100) // Only return the last 100 logs
  });
});

app.get('/api/storage/stats', async (_req, res) => {
  try {
    const stats = await db.get('SELECT SUM(size) as total_size FROM monitored_folders');
    res.json({
      used_size: stats.total_size || 0,
      initializing: scanProgress.initializing
    });
  } catch (error) {
    log('error', `Failed to fetch storage stats: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to fetch storage stats' });
  }
});

app.get('/api/storage/history', async (_req, res) => {
  try {
    const history = await db.all(`
      SELECT timestamp, SUM(used_size) as used_size
      FROM storage_history
      GROUP BY timestamp
      ORDER BY timestamp DESC
      LIMIT 100
    `);
    res.json(history);
  } catch (error) {
    log('error', `Failed to fetch storage history: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to fetch storage history' });
  }
});

app.get('/api/files/types', async (_req, res) => {
  try {
    const types = await db.all(`
      SELECT type, COUNT(*) as count, SUM(size) as size
      FROM file_stats
      GROUP BY type
      ORDER BY size DESC
    `);
    res.json(types);
  } catch (error) {
    log('error', `Failed to fetch file types: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to fetch file types' });
  }
});

interface DuplicateFile {
  id: number;
  name: string;
  size: number;
  paths: string;
}

app.get('/api/files/duplicates', async (_req, res) => {
  try {
    const duplicates = await db.all('SELECT * FROM duplicate_files ORDER BY size DESC');
    res.json(duplicates.map((d: DuplicateFile) => {
      try {
        return {
          ...d,
          paths: JSON.parse(d.paths)
        };
      } catch (error) {
        // If JSON parsing fails, return an empty array for paths
        return {
          ...d,
          paths: []
        };
      }
    }));
  } catch (error) {
    log('error', `Failed to fetch duplicates: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to fetch duplicates' });
  }
});

app.get('/api/folders', async (_req, res) => {
  try {
    const folders = await db.all('SELECT * FROM monitored_folders');
    res.json(folders);
  } catch (error) {
    log('error', `Failed to fetch folders: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

app.post('/api/folders', async (req, res) => {
  try {
    const { path: folderPath } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    log('info', `Adding new folder: ${folderPath}`);

    // Check if folder already exists
    const existingFolder = await db.get('SELECT id FROM monitored_folders WHERE path = ?', [folderPath]);
    if (existingFolder) {
      return res.status(400).json({ error: 'Folder is already being monitored' });
    }

    const validation = await validatePath(folderPath);
    if (!validation.valid) {
      log('error', `Invalid path: ${folderPath} - ${validation.error}`);
      return res.status(400).json({ error: validation.error });
    }
    
    const id = Math.random().toString(36).substr(2, 9);
    
    await db.run('BEGIN TRANSACTION');
    
    try {
      await db.run(
        'INSERT INTO monitored_folders (id, path, size, items, last_scan) VALUES (?, ?, 0, 0, ?)',
        [id, folderPath, new Date().toISOString()]
      );
      
      scanProgress.isScanning = true;
      const { size, items } = await scanDirectory(folderPath, id);
      scanProgress.isScanning = false;
      
      await db.run(
        'UPDATE monitored_folders SET size = ?, items = ? WHERE id = ?',
        [size, items, id]
      );
      
      await db.run('COMMIT');
      log('info', `Successfully added folder: ${folderPath}`);
      res.json({ success: true, id });
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    scanProgress.isScanning = false;
    log('error', `Failed to add folder: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to add folder' });
  }
});

app.delete('/api/folders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    log('info', `Deleting folder with ID: ${id}`);
    
    await db.run('BEGIN TRANSACTION');
    
    try {
      const folder = await db.get('SELECT path FROM monitored_folders WHERE id = ?', [id]);
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found' });
      }
      
      await db.run('DELETE FROM file_stats WHERE parent_folder = ?', [folder.path]);
      await db.run('DELETE FROM storage_history WHERE folder_id = ?', [id]);
      await db.run('DELETE FROM monitored_folders WHERE id = ?', [id]);
      
      await db.run('COMMIT');
      log('info', `Successfully deleted folder with ID: ${id}`);
      res.json({ success: true });
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    log('error', `Failed to delete folder: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

app.post('/api/scan', async (_req, res) => {
  try {
    if (scanProgress.isScanning) {
      return res.status(400).json({ error: 'Scan already in progress' });
    }

    log('info', 'Starting manual scan of all folders');
    scanProgress.isScanning = true;
    scanProgress.scannedItems = 0;
    scanProgress.errors = [];

    const folders = await db.all('SELECT * FROM monitored_folders');
    
    for (const folder of folders) {
      try {
        await scanDirectory(folder.path, folder.id);
      } catch (error) {
        log('error', `Error scanning folder ${folder.path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    scanProgress.isScanning = false;
    log('info', 'Manual scan completed');
    res.json({ success: true });
  } catch (error) {
    scanProgress.isScanning = false;
    log('error', `Failed to start scan: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to start scan' });
  }
});

// Add reset endpoint
app.post('/api/reset', async (_req, res) => {
  try {
    log('info', 'Resetting database...');
    
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Delete all data from tables
      await db.run('DELETE FROM file_stats');
      await db.run('DELETE FROM storage_history');
      await db.run('DELETE FROM duplicate_files');
      await db.run('DELETE FROM monitored_folders');
      
      await db.run('COMMIT');
      log('info', 'Database reset successful');
      res.json({ success: true });
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    log('error', `Failed to reset database: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to reset database' });
  }
});

// Start the server
async function startServer() {
  try {
    log('info', 'Starting server...');
    await initializeDatabase();
    
    // Serve static files
    app.use(express.static(path.join(__dirname, '../../dist')));
    
    // Handle SPA routing
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, '../../dist/index.html'));
    });
    
    app.listen(port, () => {
      log('info', `Server running on port ${port}`);
    });
  } catch (error) {
    log('error', `Fatal error starting server: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

startServer();