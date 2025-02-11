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

// Utility function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

// Global variables
let db: any;
const scanProgress = {
  totalItems: 0,
  scannedItems: 0,
  currentPath: '',
  errors: [] as string[],
  logs: [] as Array<{ timestamp: string; level: string; message: string }>
};

// Enhanced logging function with file output
async function log(level: 'info' | 'error' | 'warn', message: string, error?: unknown) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  const logWithError = error ? `${logMessage}\nError details: ${JSON.stringify(error, null, 2)}` : logMessage;
  
  console.log(logWithError);
  
  try {
    await fs.mkdir('/appdata/logs', { recursive: true });
    await fs.appendFile('/appdata/logs/server.log', logWithError + '\n');
  } catch (err) {
    console.error('Failed to write to log file:', err instanceof Error ? err.message : String(err));
  }
}

// Express app setup
const app = express();
const port = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || '/appdata/database.sqlite';

// Initialize database
async function initializeDatabase() {
  try {
    await log('info', 'Initializing database...');
    
    const dbDir = dirname(DB_PATH);
    await log('info', `Ensuring database directory exists: ${dbDir}`);
    await fs.mkdir(dbDir, { recursive: true });
    
    try {
      await fs.access(dbDir, fs.constants.W_OK);
      await log('info', `Write permission confirmed for directory: ${dbDir}`);
    } catch (error) {
      throw new Error(`No write permission for database directory ${dbDir}: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    await log('info', `Opening database at: ${DB_PATH}`);
    
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    await log('info', 'Database connection established');

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
  } catch (error) {
    await log('error', 'Database initialization failed', error);
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    await log('error', `Path validation failed: ${path}`, error);
    return { 
      valid: false, 
      error: `Path is not accessible: ${errorMessage}`
    };
  }
}

async function scanDirectory(dirPath: string, folderId: string): Promise<{ size: number; items: number }> {
  try {
    await log('info', `Scanning directory: ${dirPath}`);
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
      await log('error', `Skipping inaccessible path: ${dirPath}`, validation.error);
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
          await log('warn', `Permission denied for path: ${fullPath}`, error);
          continue;
        }
        await log('error', `Error scanning ${fullPath}`, error);
      }
    }

    // Update storage history for this folder
    const stats = await statfs(dirPath);
    const freeFolderSize = stats.bfree * stats.bsize;
    
    await db.run(
      'INSERT INTO storage_history (used_size, free_size, folder_id) VALUES (?, ?, ?)',
      [totalSize, freeFolderSize, folderId]
    );

    await log('info', `Scan completed for ${dirPath}: ${totalItems} items, ${totalSize} bytes`);
    scanProgress.logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Scan completed for ${dirPath}: ${totalItems} items, ${formatBytes(totalSize)}`
    });
    
    return { size: totalSize, items: totalItems };
  } catch (error) {
    await log('error', `Failed to scan directory: ${dirPath}`, error);
    throw error;
  }
}

// API Routes
app.get('/api/scan/status', (_req, res) => {
  res.json(scanProgress);
});

app.post('/api/folders', async (req, res) => {
  try {
    const { path } = req.body;
    
    const validation = await validatePath(path);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    const id = Math.random().toString(36).substr(2, 9);
    
    await db.run('BEGIN TRANSACTION');
    
    try {
      await db.run(
        'INSERT INTO monitored_folders (id, path, size, items, last_scan) VALUES (?, ?, 0, 0, ?)',
        [id, path, new Date().toISOString()]
      );
      
      const { size, items } = await scanDirectory(path, id);
      await db.run(
        'UPDATE monitored_folders SET size = ?, items = ? WHERE id = ?',
        [size, items, id]
      );
      
      await db.run('COMMIT');
      res.json({ success: true, id });
      
      await log('info', `Added new folder to monitor: ${path}`);
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    await log('error', 'Failed to add folder', error);
    res.status(500).json({ error: 'Failed to add folder' });
  }
});

// Start the server
async function startServer() {
  try {
    await log('info', 'Starting server...');
    await initializeDatabase();
    
    app.use(express.json());
    app.use(express.static(path.join(__dirname, '../../dist')));
    
    app.listen(port, () => {
      log('info', `Server running on port ${port}`);
    });
  } catch (error) {
    await log('error', 'Fatal error starting server', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});