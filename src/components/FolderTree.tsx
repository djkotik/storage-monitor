import React from 'react';
import { ChevronRight, ChevronDown, Folder, File } from 'lucide-react';
import { formatBytes } from '../utils/format';

interface FileNode {
  id: string;
  path: string;
  size: number;
  items: number;
  lastScan: Date;
}

interface FolderTreeProps {
  data: FileNode[] | undefined; // Allow data to be an array or undefined
  level?: number;
}

export function FolderTree({ data, level = 0 }: FolderTreeProps) {
  const [isExpanded, setIsExpanded] = React.useState(level === 0);

  // Handle the case where data is undefined or an empty array
  if (!data || data.length === 0) {
    return (
      <div className="text-gray-500 dark:text-gray-400" style={{ paddingLeft: `${level * 1.5}rem` }}>
        No folders monitored yet.
      </div>
    );
  }

  return (
    <div className="w-full">
      {data.map((folder) => (
        <div
          key={folder.id}
          className={`flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer ${
            level === 0 ? 'bg-gray-50 dark:bg-gray-800' : ''
          }`}
          style={{ paddingLeft: `${level * 1.5}rem` }}
        >
          <Folder className="w-4 h-4 text-primary-light dark:text-primary-dark" />
          <span className="flex-1 text-gray-700 dark:text-gray-300">{folder.path}</span>
          <span className="text-gray-900 dark:text-white font-medium">
            {formatBytes(folder.size)}
          </span>
        </div>
      ))}
    </div>
  );
}
