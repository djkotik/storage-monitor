import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import { Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import chokidar from 'chokidar';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Enhanced logging function
function log(level: 'info' | 'error' | 'warn', message: string, error?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  
  if (error) {
    console.error(logMessage, '\nError details:', error);
  } else {
    console.log(logMessage);
  }
}

const app = express();
const port = process.env.PORT || 3000;
const SCAN_INTERVAL = parseInt(process.env.SCAN_INTERVAL || '3600', 10) * 1000;
const STORAGE_ALERT_THRESHOLD = parseInt(process.env.STORAGE_ALERT_THRESHOLD || '90', 10);
const DATA_PATH = process.env.DATA_PATH || '/data';
const DB_PATH = process.env.DB_PATH || '/appdata/database.sqlite';

log('info', `Starting server with configuration:
  Port: ${port}
  Scan Interval: ${SCAN_INTERVAL}ms
  Alert Threshold: ${STORAGE_ALERT_THRESHOLD}%
  Data Path: ${DATA_PATH}
  DB Path: ${DB_PATH}
`);

// Ensure required directories exist
async function ensureDirectories() {
  try {
    log('info', 'Creating required directories...');
    await fs.mkdir('/appdata', { recursive: true });
    await fs.mkdir(DATA_PATH, { recursive: true });
    log('info', 'Directories created successfully');
  } catch (error) {
    log('error', 'Failed to create required directories', error);
    throw error;
  }
}

let db: Database;

async function initializeDatabase() {
  try {
    log('info', 'Initializing database...');
    
    // Ensure the database directory exists
    await fs.mkdir(dirname(DB_PATH), { recursive: true });
    
    db = await new Database({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    log('info', 'Database connection established');

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
    log('error', 'Database initialization failed', error);
    throw error;
  }
}

async function scanDirectory(dirPath: string): Promise<{ size: number; items: number }> {
  try {
    log('info', `Scanning directory: ${dirPath}`);
    
    let totalSize = 0;
    let totalItems = 0;

    const files = await fs.readdir(dirPath, { withFileTypes: true });
    
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
          
          await db.run(
            'INSERT OR REPLACE INTO file_stats (path, name, size, type, modified, parent_folder) VALUES (?, ?, ?, ?, ?, ?)',
            [fullPath, file.name, stats.size, path.extname(file.name) || 'unknown', stats.mtime.toISOString(), dirPath]
          );
        }
      } catch (error) {
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
    
    const stats = await fs.statfs(DATA_PATH);
    const totalSize = stats.blocks * stats.bsize;
    const freeSize = stats.bfree * stats.bsize;
    const usedSize = totalSize - freeSize;

    await db.run(
      'INSERT INTO storage_history (used_size, free_size) VALUES (?, ?)',
      [usedSize, freeSize]
    );

    // Find and record duplicate files
    const duplicates = await db.all(`
      SELECT name, size, GROUP_CONCAT(path) as paths
      FROM file_stats
      GROUP BY name, size
      HAVING COUNT(*) > 1 AND size > 0
    `);

    for (const dup of duplicates) {
      await db.run(
        'INSERT OR REPLACE INTO duplicate_files (name, size, paths) VALUES (?, ?, ?)',
        [dup.name, dup.size, dup.paths]
      );
    }

    log('info', 'Storage stats updated successfully', {
      totalSize,
      usedSize,
      freeSize,
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
    
    // Initial scan
    await updateStorageStats();
    const { size, items } = await scanDirectory(DATA_PATH);
    
    await db.run(
      'INSERT OR REPLACE INTO monitored_folders (id, path, size, items, last_scan) VALUES (?, ?, ?, ?, ?)',
      ['root', DATA_PATH, size, items, new Date().toISOString()]
    );

    // Set up file system watcher
    const watcher = chokidar.watch(DATA_PATH, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: true
    });

    watcher
      .on('add', path => log('info', `File added: ${path}`))
      .on('change', path => log('info', `File changed: ${path}`))
      .on('unlink', path => log('info', `File removed: ${path}`))
      .on('error', error => log('error', 'Watcher error', error));

    // Schedule regular scans
    setInterval(async () => {
      try {
        await updateStorageStats();
        const { size, items } = await scanDirectory(DATA_PATH);
        
        await db.run(
          'UPDATE monitored_folders SET size = ?, items = ?, last_scan = ? WHERE id = ?',
          [size, items, new Date().toISOString(), 'root']
        );
      } catch (error) {
        log('error', 'Scheduled scan failed', error);
      }
    }, SCAN_INTERVAL);

    log('info', 'Monitoring service started successfully');
  } catch (error) {
    log('error', 'Failed to start monitoring service', error);
    throw error;
  }
}

// API Routes
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../dist')));

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  log('error', 'API Error', err);
  res.status(500).json({ error: 'Internal server error' });
});

// API Routes with error handling
app.get('/api/storage/stats', async (req, res) => {
  try {
    const stats = await db.get('SELECT * FROM storage_history ORDER BY timestamp DESC LIMIT 1');
    res.json(stats);
  } catch (error) {
    log('error', 'Failed to fetch storage stats', error);
    res.status(500).json({ error: 'Failed to fetch storage stats' });
  }
});

app.get('/api/storage/history', async (req, res) => {
  try {
    const history = await db.all('SELECT * FROM storage_history ORDER BY timestamp DESC LIMIT 365');
    res.json(history.reverse());
  } catch (error) {
    log('error', 'Failed to fetch storage history', error);
    res.status(500).json({ error: 'Failed to fetch storage history' });
  }
});

app.get('/api/files/types', async (req, res) => {
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

app.get('/api/files/duplicates', async (req, res) => {
  try {
    const duplicates = await db.all('SELECT * FROM duplicate_files ORDER BY size DESC');
    res.json(duplicates);
  } catch (error) {
    log('error', 'Failed to fetch duplicates', error);
    res.status(500).json({ error: 'Failed to fetch duplicates' });
  }
});

app.get('/api/folders', async (req, res) => {
  try {
    const folders = await db.all('SELECT * FROM monitored_folders');
    res.json(folders);
  } catch (error) {
    log('error', 'Failed to fetch folders', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

app.post('/api/scan', async (req, res) => {
  try {
    await updateStorageStats();
    const { size, items } = await scanDirectory(DATA_PATH);
    
    await db.run(
      'UPDATE monitored_folders SET size = ?, items = ?, last_scan = ? WHERE id = ?',
      [size, items, new Date().toISOString(), 'root']
    );
    
    res.json({ success: true });
  } catch (error) {
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
    
    await db.run(
      'INSERT INTO monitored_folders (id, path, size, items, last_scan) VALUES (?, ?, 0, 0, ?)',
      [id, path, new Date().toISOString()]
    );
    
    const { size, items } = await scanDirectory(path);
    
    await db.run(
      'UPDATE monitored_folders SET size = ?, items = ? WHERE id = ?',
      [size, items, id]
    );
    
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
      await db.run('DELETE FROM file_stats WHERE parent_folder = ?', [folder.path]);
      await db.run('DELETE FROM monitored_folders WHERE id = ?', [id]);
    }
    
    res.json({ success: true });
  } catch (error) {
    log('error', 'Failed to delete folder', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// Start the server
async function startServer() {
  try {
    log('info', 'Starting server...');
    await ensureDirectories();
    await initializeDatabase();
    await startMonitoring();
    
    app.listen(port, () => {
      log('info', `Server running on port ${port}`);
    });
  } catch (error) {
    log('error', 'Fatal error starting server', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log('error', 'Uncaught exception', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  log('error', 'Unhandled promise rejection', reason);
  process.exit(1);
});

startServer();