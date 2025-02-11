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