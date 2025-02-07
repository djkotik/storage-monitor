import React from 'react';
import { X, Trash2, Settings as SettingsIcon } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  scanInterval: number;
  onScanIntervalChange: (interval: number) => void;
  folders: Array<{ id: string; path: string }>;
  onDeleteFolder: (id: string) => void;
  onResetDatabase: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  scanInterval,
  onScanIntervalChange,
  folders,
  onDeleteFolder,
  onResetDatabase,
}: SettingsModalProps) {
  const [showConfirmDelete, setShowConfirmDelete] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleDelete = (id: string) => {
    setShowConfirmDelete(id);
  };

  const confirmDelete = async (id: string) => {
    await onDeleteFolder(id);
    setShowConfirmDelete(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card-light dark:bg-card-dark rounded-lg p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary-light dark:text-primary-dark" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Scan Interval Setting */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Scan Interval</h3>
            <select
              value={scanInterval}
              onChange={(e) => onScanIntervalChange(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
            >
              <option value={3600}>Hourly</option>
              <option value={86400}>Daily</option>
              <option value={604800}>Weekly</option>
            </select>
          </div>

          {/* Monitored Folders */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Monitored Folders</h3>
            <div className="space-y-2">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <span className="text-gray-700 dark:text-gray-300">{folder.path}</span>
                  {showConfirmDelete === folder.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => confirmDelete(folder.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setShowConfirmDelete(null)}
                        className="px-3 py-1 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDelete(folder.id)}
                      className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Reset Database */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Reset Database</h3>
            <p className="text-gray-700 dark:text-gray-300">This will delete all data and reset the database to its initial state.</p>
            <button
              onClick={onResetDatabase}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Reset Database
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
