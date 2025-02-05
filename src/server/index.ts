import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import chokidar from 'chokidar';
import * as syncFs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Enhanced logging function with file output
const logBuffer: string[] = []; // In-memory log buffer
const maxLogLines = 100;

async function log(level: 'info' | 'error' | 'warn', message: string, error?: unknown) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  const logWithError = error ? `${logMessage}\nError details: ${JSON.stringify(error, null, 2)}` : logMessage;
  
  console.log(logWithError);
  
  // Add to in-memory log buffer
  logBuffer.push(logMessage);
  if (logBuffer.length > maxLogLines) {
    logBuffer.shift(); // Remove the oldest log message
  }

  try {
    // Ensure log directory exists
    await fs.mkdir('/appdata/logs', { recursive: true });
    await fs.appendFile('/appdata/logs/server.log', logWithError + '\n');
  } catch (err) {
    console.error('Failed to write to log file:', err instanceof Error ? err.message : String(err));
  }
}

// Log startup configuration
process.on('uncaughtException', async (error: Error) => {
  await log('error', 'UNCAUGHT EXCEPTION! 💥 Shutting down...', {
    name: error.name,
    message: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', async (error: unknown) => {
  await log('error', 'UNHANDLED REJECTION! 💥 Shutting down...', error);
  process.exit(1);
});

const app = express();
const port = process.env.PORT || 3000;
const SCAN_INTERVAL = parseInt(process.env.SCAN_INTERVAL || '3600', 10) * 1000;
const STORAGE_ALERT_THRESHOLD = parseInt(process.env.STORAGE_ALERT_THRESHOLD || '90', 10);
const DB_PATH = process.env.DB_PATH || '/appdata/database.sqlite';

log('info', `STORAGE_ALERT_THRESHOLD is set to: ${STORAGE_ALERT_THRESHOLD}`);

let isScanning = false;
let scanProgress = {
  totalItems: 0,
  scannedItems: 0,
  currentPath: '',
  errors: [] as string[]
};

// Ensure required directories exist
async function ensureDirectories() {
  try {
    log('info', 'Creating required directories...');
    await fs.mkdir('/appdata', { recursive: true });
    log('info', 'Directories created successfully');
  } catch (error) {
    log('error', 'Failed to create required directories', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

let db: Database;

async function initializeDatabase() {
  try {
    log('info', 'Initializing database...');
    
    const dbDir = dirname(DB_PATH);
    log('info', `Ensuring database directory exists: ${dbDir}`);
    await fs.mkdir(dbDir, { recursive: true });
    
    try {
      await fs.access(dbDir, fs.constants.W_OK);
      log('info', `Write permission confirmed for directory: ${dbDir}`);
    } catch (error) {
      throw new Error(`No write permission for database directory ${dbDir}: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    log('info', `Opening database at: ${DB_PATH}`);
    
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database,
      mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
    });

    log('info', 'Database connection established');

    try {
      await db.get('SELECT 1 as test');
      log('info', 'Database connection test successful');
    } catch (error) {
      throw new Error(`Database connection test failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    log('info', 'Creating database schema...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS monitored_folders (
        id TEXT PRIMARY KEY,
        path TEXT UNIQUE NOT NULL,
        size INTEGER NOT NULL DEFAULT 0,
        items INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_scan DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS storage_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        used_size INTEGER NOT NULL,
        free_size INTEGER NOT NULL
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

      CREATE INDEX IF NOT EXISTS idx_file_stats_type ON file_stats(type);
      CREATE INDEX IF NOT EXISTS idx_file_stats_size ON file_stats(size);
      CREATE INDEX IF NOT EXISTS idx_storage_history_timestamp ON storage_history(timestamp);
    `);

    log('info', 'Database schema initialized successfully');
  } catch (error) {
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
      errno: (error as any).syscall,
      path: (error as any).path
    } : String(error);
    
    log('error', 'Database initialization failed', errorDetails);
    throw error;
  }
}

async function scanDirectory(dirPath: string): Promise<{ size: number; items: number }> {
  try {
    log('info', `Scanning directory: ${dirPath}`);
    scanProgress.currentPath = dirPath;
    
    let totalSize = 0;
    let totalItems = 0;

    let files;
    try {
      files = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (error) {
      if ((error as any).code === 'EACCES') {
        scanProgress.errors.push(`Permission denied: ${dirPath}`);
        log('warn', `Permission denied for directory: ${dirPath}`, error);
        return { size: 0, items: 0 };
      }
      throw error;
    }
    
    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);
      
      try {
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          const { size, items } = await scanDirectory(fullPath);
          totalSize += size;
          totalItems += items;
        } else {
          totalSize += stats.size;
          totalItems++;
          scanProgress.scannedItems++;
          
          await db.run(
            `INSERT OR REPLACE INTO file_stats (path, name, size, type, modified, parent_folder) VALUES (?, ?, ?, ?, ?, ?)`,
            [fullPath, file.name, stats.size, path.extname(file.name) || 'unknown', stats.mtime.toISOString(), dirPath]
          );
        }
      } catch (error) {
        if ((error as any).code === 'EACCES') {
          scanProgress.errors.push(`Permission denied: ${fullPath}`);
          log('warn', `Permission denied for path: ${fullPath}`, error);
          continue;
        }
        log('error', `Error scanning ${fullPath}`, error);
      }
    }

    log('info', `Scan completed for ${dirPath}: ${totalItems} items, ${totalSize} bytes`);
    return { size: totalSize, items: totalItems };
  } catch (error) {
    log('error', `Failed to scan directory: ${dirPath}`, error);
    throw error;
  }
}

async function updateStorageStats() {
  try {
    log('info', 'Updating storage statistics...');
    let totalUsedSize = 0;
    
    log('info', 'Fetching monitored folders from the database...');
    const folders = await db.all('SELECT size FROM monitored_folders');
    log('info', `Fetched ${folders.length} monitored folders`);

    if (folders && folders.length > 0) {
      log('info', 'Calculating total used size...');
      folders.forEach(folder => {
        totalUsedSize += folder.size;
      });
      log('info', `Total used size calculated: ${totalUsedSize}`);
    } else {
      log('warn', 'No monitored folders found. Setting totalUsedSize to 0.');
      totalUsedSize = 0;
    }

    log('info', `Inserting storage history with used_size: ${totalUsedSize}`);
    await db.run(
      `INSERT INTO storage_history (used_size, free_size) VALUES (?, 0)`,
      [totalUsedSize]
    );
    log('info', 'Storage history updated successfully');

    // Find and record duplicate files
    log('info', 'Finding duplicate files...');
    const duplicates = await db.all(`
      SELECT name, size, GROUP_CONCAT(path) as paths
      FROM file_stats
      GROUP BY name, size
      HAVING COUNT(*) > 1 AND size > 0
    `);
    log('info', `Found ${duplicates.length} duplicate files`);

    for (const dup of duplicates) {
      const pathsArray = dup.paths.split(','); // Split the comma-separated string into an array
      await db.run(
        `INSERT OR REPLACE INTO duplicate_files (name, size, paths) VALUES (?, ?, ?)`,
        [dup.name, dup.size, JSON.stringify(pathsArray)]
      );
    }

    log('info', 'Duplicate files updated successfully');
    log('info', 'Storage stats updated successfully', {
      totalUsedSize,
      duplicates: duplicates.length
    });
  } catch (error) {
    log('error', 'Failed to update storage stats', error);
    throw error;
  }
}

async function startMonitoring() {
  try {
    log('info', 'Starting monitoring service...');
    isScanning = false;
    scanProgress = {
      totalItems: 0,
      scannedItems: 0,
      currentPath: '',
      errors: []
    };

    // Load monitored folders from the database
    const monitoredFoldersFromDb = await db.all('SELECT id, path FROM monitored_folders');

    // Function to scan each monitored folder
    const scanMonitoredFolder = async (folder: { id: string; path: string }) => {
      try {
        const { size, items } = await scanDirectory(folder.path);
        await db.run(
          `UPDATE monitored_folders SET size = ?, items = ?, last_scan = ? WHERE id = ?`,
          [size, items, new Date().toISOString(), folder.id]
        );
      } catch (error) {
        log('error', `Failed to scan monitored folder: ${folder.path}`, error);
      }
    };
    
    // Set up file system watcher for each monitored folder
    monitoredFoldersFromDb.forEach(folder => {
      const watcher = chokidar.watch(folder.path, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: true,
        ignored: p => {
          try {
            syncFs.accessSync(p, syncFs.constants.R_OK);
            return false;
          } catch {
            return true;
          }
        }
      });

      watcher
        .on('add', p => log('info', `File added: ${p}`))
        .on('change', p => log('info', `File changed: ${p}`))
        .on('unlink', p => log('info', `File removed: ${p}`))
        .on('error', error => log(`error`, `Watcher error: ${error}`))
    });

    // Schedule regular scans
    setInterval(async () => {
      if (!isScanning) {
        isScanning = true;
        scanProgress = {
          totalItems: 0,
          scannedItems: 0,
          currentPath: '',
          errors: []
        };
        
        try {
          await updateStorageStats();
          const updatedMonitoredFolders = await db.all('SELECT id, path FROM monitored_folders');
          await Promise.all(updatedMonitoredFolders.map(scanMonitoredFolder));
        } catch (error) {
          log('error', 'Scheduled scan failed', error);
        } finally {
          isScanning = false;
        }
      }
    }, SCAN_INTERVAL);

    log('info', 'Monitoring service started successfully');
  } catch (error) {
    log('error', 'Failed to start monitoring service', error);
    isScanning = false;
    throw error;
  }
}

async function initialSetup() {
  try {
    log('info', 'Performing initial setup...');
    
    // Load monitored folders from the database
    const monitoredFolders = await db.all('SELECT id, path FROM monitored_folders');

    // Function to scan each monitored folder
    const scanMonitoredFolder = async (folder: { id: string; path: string }) => {
      try {
        const { size, items } = await scanDirectory(folder.path);
        await db.run(
          `UPDATE monitored_folders SET size = ?, items = ?, last_scan = ? WHERE id = ?`,
          [size, items, new Date().toISOString(), folder.id]
        );
      } catch (error) {
        log('error', `Failed to scan monitored folder: ${folder.path}`, error);
      }
    };
    
    // Initial scan of all monitored folders
    await updateStorageStats();
    await Promise.all(monitoredFolders.map(scanMonitoredFolder));

    log('info', 'Initial setup completed successfully');
  } catch (error) {
    log('error', 'Failed to perform initial setup', error);
  }
}

// API Routes
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../dist')));

// API endpoint to get logs
app.get('/api/logs', (_, res) => {
  res.json(logBuffer);
});

// API Routes with error handling
app.get('/api/scan/status', (_, res) => {
  res.json({
    isScanning,
    progress: scanProgress
  });
});

app.get('/api/storage/stats', async (_, res) => {
  try {
    const stats = await db.get('SELECT * FROM storage_history ORDER BY timestamp DESC LIMIT 1');
    res.json(stats);
  } catch (error) {
    log('error', 'Failed to fetch storage stats', error);
    res.status(500).json({ error: 'Failed to fetch storage stats' });
  }
});

app.get('/api/storage/history', async (_, res) => {
  try {
    const history = await db.all('SELECT * FROM storage_history ORDER BY timestamp DESC LIMIT 365');
    res.json(history.reverse());
  } catch (error) {
    log('error', 'Failed to fetch storage history', error);
    res.status(500).json({ error: 'Failed to fetch storage history' });
  }
});

app.get('/api/files/types', async (_, res) => {
  try {
    const types = await db.all(`
      SELECT type, SUM(size) as size, COUNT(*) as count
      FROM file_stats
      GROUP BY type
      ORDER BY size DESC
    `);
    res.json(types);
  } catch (error) {
    log('error', 'Failed to fetch file types', error);
    res.status(500).json({ error: 'Failed to fetch file types' });
  }
});

app.get('/api/files/duplicates', async (_, res) => {
  try {
    const duplicates = await db.all(`SELECT * FROM duplicate_files ORDER BY size DESC`);
    res.json(duplicates);
  } catch (error) {
    log('error', 'Failed to fetch duplicates', error);
    res.status(500).json({ error: 'Failed to fetch duplicates' });
  }
});

app.get('/api/folders', async (_, res) => {
  try {
    const folders = await db.all('SELECT * FROM monitored_folders');
    res.json(folders);
  } catch (error) {
    log('error', 'Failed to fetch folders', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

app.post('/api/scan', async (_, res) => {
  try {
    if (isScanning) {
      return res.status(409).json({ error: 'Scan already in progress' });
    }
    
    isScanning = true;
    scanProgress = {
      totalItems: 0,
      scannedItems: 0,
      currentPath: '',
      errors: []
    };

    // Load monitored folders from the database
    const monitoredFolders = await db.all('SELECT id, path FROM monitored_folders');

    // Function to scan each monitored folder
    const scanMonitoredFolder = async (folder: { id: string; path: string }) => {
      try {
        const { size, items } = await scanDirectory(folder.path);
        await db.run(
          `UPDATE monitored_folders SET size = ?, items = ?, last_scan = ? WHERE id = ?`,
          [size, items, new Date().toISOString(), folder.id]
        );
      } catch (error) {
        log('error', `Failed to scan monitored folder: ${folder.path}`, error);
      }
    };
    
    await updateStorageStats();
    await Promise.all(monitoredFolders.map(scanMonitoredFolder));
    
    isScanning = false;
    res.json({ success: true });
  } catch (error) {
    isScanning = false;
    log('error', 'Failed to initiate scan', error);
    res.status(500).json({ error: 'Failed to initiate scan' });
  }
});

app.post('/api/settings/scan-interval', async (req, res) => {
  try {
    const { interval } = req.body;
    process.env.SCAN_INTERVAL = interval.toString();
    res.json({ success: true });
  } catch (error) {
    log('error', 'Failed to update scan interval', error);
    res.status(500).json({ error: 'Failed to update scan interval' });
  }
});

app.post('/api/folders', async (req, res) => {
  try {
    const { path } = req.body;
    const id = Math.random().toString(36).substr(2, 9);

    // Check if the folder already exists
    const existingFolder = await db.get('SELECT id FROM monitored_folders WHERE path = ?', [path]);
    if (existingFolder) {
      return res.status(409).json({ error: 'Folder already exists' });
    }
    
    await db.run(
      `INSERT INTO monitored_folders (id, path, size, items, last_scan) VALUES (?, ?, 0, 0, ?)`,
      [id, path, new Date().toISOString()],
    );
    
    const { size, items } = await scanDirectory(path);
    
    await db.run(
      `UPDATE monitored_folders SET size = ?, items = ? WHERE id = ?`,
      [size, items, id],
    );
    
    // After adding a folder, start watching it
    const watcher = chokidar.watch(path, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: true,
      ignored: p => {
        try {
          syncFs.accessSync(p, syncFs.constants.R_OK);
          return false;
        } catch {
          return true;
        }
      }
    });

    watcher
      .on('add', p => log('info', `File added: ${p}`))
      .on('change', p => log('info', `File changed: ${p}`))
      .on('unlink', p => log('info', `File removed: ${p}`))
      .on('error', error => log(`error`, `Watcher error: ${error}`))
    
    res.json({ success: true, id });
  } catch (error) {
    log('error', 'Failed to add folder', error);
    res.status(500).json({ error: 'Failed to add folder' });
  }
});

app.delete('/api/folders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const folder = await db.get('SELECT path FROM monitored_folders WHERE id = ?', [id]);
    
    if (folder) {
      await db.run(`DELETE FROM file_stats WHERE parent_folder = ?`, [folder.path]);
      await db.run(`DELETE FROM monitored_folders WHERE id = ?`, [id]);
    }
    
    res.json({ success: true });
  } catch (error) {
    log('error', 'Failed to delete folder', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// Serve the frontend
app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, '../../dist', 'index.html'));
});

// Start the server
async function startServer() {
  try {
    log('info', 'Starting server...');
    await ensureDirectories();
    await initializeDatabase();
    
    // Start initial setup asynchronously
    setImmediate(initialSetup);

    await startMonitoring();
    
    app.listen(port, () => {
      log('info', `Server running on port ${port}`);
    });
  } catch (error) {
    log('error', 'Fatal error starting server', error);
    process.exit(1);
  }
}

startServer();
