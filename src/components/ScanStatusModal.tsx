import React from 'react';
import { X, AlertCircle } from 'lucide-react';

interface ScanStatus {
  isScanning: boolean;
  progress: {
    totalItems: number;
    scannedItems: number;
    currentPath: string;
    errors: string[];
  };
}

interface ScanStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: ScanStatus | undefined;
}

export function ScanStatusModal({ isOpen, onClose, status }: ScanStatusModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card-light dark:bg-card-dark rounded-lg p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-primary-light dark:text-primary-dark" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Scan Status</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Current Status</h3>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-gray-700 dark:text-gray-300">
                {status?.isScanning ? 'Scan in progress...' : 'No scan running'}
              </p>
              {status?.isScanning && (
                <>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Currently scanning: {status.progress.currentPath}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Items scanned: {status.progress.scannedItems}
                  </p>
                </>
              )}
            </div>
          </div>

          {status?.progress.errors.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Errors</h3>
              <div className="space-y-2">
                {status.progress.errors.map((error, index) => (
                  <div key={index} className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
