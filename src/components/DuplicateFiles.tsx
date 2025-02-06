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
      {files && files.length > 0 ? (
        files.map((file, index) => (
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
              {/* Check if file.paths is a valid JSON string before parsing */}
              {(() => {
                try {
                  const paths = JSON.parse(file.paths);
                  if (Array.isArray(paths)) {
                    return paths.map((path: string, pathIndex: number) => (
                      <div
                        key={pathIndex}
                        className="text-sm text-gray-600 dark:text-gray-400"
                      >
                        {path}
                      </div>
                    ));
                  } else {
                    console.warn('Invalid paths data:', file.paths);
                    return <div className="text-sm text-gray-600 dark:text-gray-400">Invalid paths data</div>;
                }
              } catch (error) {
                console.error('Error parsing paths:', error);
                return <div className="text-sm text-gray-600 dark:text-gray-400">Error loading paths</div>;
              }
            })()}
          </div>
        </div>
      ))
    ) : (
      <div className="text-gray-500 dark:text-gray-400">No duplicate files found.</div>
    )}
    </div>
  );
}
