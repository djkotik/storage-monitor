export interface FileStats {
  name: string;
  path: string;
  size: number;
  type: string;
  modified: Date;
  items?: number;
}

export interface StorageData {
  totalSize: number;
  usedSize: number;
  freeSize: number;
  alertThreshold: number;
}

export interface MonitoredFolder {
  id: string;
  path: string;
  size: number;
  items: number;
  lastScan: Date;
}

export interface FileTypeStats {
  type: string;
  size: number;
  count: number;
}

export interface StorageHistory {
  timestamp: Date;
  usedSize: number;
}

export interface DuplicateFile {
  name: string;
  size: number;
  paths: string[];
}
