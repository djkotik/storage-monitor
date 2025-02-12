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
  totalItems: 0,
  scannedItems: 0,
  currentPath: '',
  lastScanTime: null as string | null,
  errors: [] as string[],
  logs: [] as Array<{ timestamp: string; level: string; message: string }>
};

// Express app setup
const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || '/appdata/database.sqlite';

// Initialize database
async function initializeDatabase() {
  try {
    console.log('Initializing database...');
    
    const dbDir = dirname(DB_PATH);
    await fs.mkdir(dbDir, { recursive: true });
    
    try {
      await fs.access(dbDir, fs.constants.W_OK);
    } catch (error) {
      throw new Error(`No write permission for database directory ${dbDir}`);
    }
    
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

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
  } catch (error) {
    console.error('Database initialization failed:', error);
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
    scanProgress.logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Scanning directory: ${dirPath}`
    });
    
    let totalSize = 0;
    let totalItems = 0;

    const validation = await validatePath(dirPath);
    if (!validation.valid) {
      scanProgress.errors.push(`Skipping inaccessible path: ${dirPath} - ${validation.error}`);
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
          scanProgress.logs.push({
            timestamp: new Date().toISOString(),
            level: 'error',
            message: errorMsg
          });
          continue;
        }
        console.error(`Error scanning ${fullPath}:`, error);
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

    scanProgress.logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Scan completed for ${dirPath}: ${totalItems} items, ${totalSize} bytes`
    });
    
    return { size: totalSize, items: totalItems };
  } catch (error) {
    console.error(`Failed to scan directory: ${dirPath}`, error);
    throw error;
  }
}

// API Routes
app.get('/api/scan/status', (_req, res) => {
  res.json(scanProgress);
});

app.get('/api/folders', async (_req, res) => {
  try {
    const folders = await db.all('SELECT * FROM monitored_folders');
    res.json(folders);
  } catch (error) {
    console.error('Failed to fetch folders:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

app.post('/api/folders', async (req, res) => {
  try {
    const { path: folderPath } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const validation = await validatePath(folderPath);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    const id = Math.random().toString(36).substr(2, 9);
    
    await db.run('BEGIN TRANSACTION');
    
    try {
      await db.run(
        'INSERT INTO monitored_folders (id, path, size, items, last_scan) VALUES (?, ?, 0, 0, ?)',
        [id, folderPath, new Date().toISOString()]
      );
      
      const { size, items } = await scanDirectory(folderPath, id);
      await db.run(
        'UPDATE monitored_folders SET size = ?, items = ? WHERE id = ?',
        [size, items, id]
      );
      
      await db.run('COMMIT');
      res.json({ success: true, id });
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Failed to add folder:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to add folder' });
  }
});

// Start the server
async function startServer() {
  try {
    await initializeDatabase();
    app.use(express.static(path.join(__dirname, '../../dist')));
    
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  }
}

startServer();