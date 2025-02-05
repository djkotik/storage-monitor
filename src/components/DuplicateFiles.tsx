import React from 'react';
import { Copy } from 'lucide-react';
import { formatBytes } from '../utils/format';

interface DuplicateFile {
  name: string;
  size: number;
  paths: string[];
}

interface DuplicateFilesProps {
  files: DuplicateFile[];
}

export function DuplicateFiles({ files }: DuplicateFilesProps) {
  return (
    <div className="space-y-4">
      {files.map((file, index) => (
        <div
          key={index}
          className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Copy className="w-4 h-4 text-primary-light dark:text-primary-dark" />
              <span className="font-medium text-gray-900 dark:text-white">
                {file.name}
              </span>
            </div>
            <span className="text-gray-500 dark:text-gray-400">
              {formatBytes(file.size)}
            </span>
          </div>
          <div className="pl-6 space-y-1">
            {/* Parse the JSON string to get the array of paths */}
            {JSON.parse(file.paths).map((path: string, pathIndex: number) => (
              <div
                key={pathIndex}
                className="text-sm text-gray-600 dark:text-gray-400"
              >
                {path}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
