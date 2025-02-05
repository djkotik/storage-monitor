import React from 'react';
import { Moon, Sun, Maximize2, HardDrive, FileType2, Files, Copy, PieChart, FolderTree as FolderTreeIcon, RefreshCw, Settings as SettingsIcon, AlertCircle } from 'lucide-react';
import { useThemeStore } from '../store/theme';
import { StorageChart } from './StorageChart';
import { FolderTree } from './FolderTree';
import { DuplicateFiles } from './DuplicateFiles';
import { FileTypePieChart } from './FileTypePieChart';
import { MonitoredFoldersPieChart } from './MonitoredFoldersPieChart';
import { AddFolderModal } from './AddFolderModal';
import { FullscreenModal } from './FullscreenModal';
import { formatBytes } from '../utils/format';
import { SettingsModal } from './SettingsModal';
import { ScanStatusModal } from './ScanStatusModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';

function MainContent() {
  const { isDark } = useThemeStore();
  const [timeRange, setTimeRange] = React.useState<'day' | 'week' | 'month' | 'year'>('month');
  const [isAddFolderOpen, setIsAddFolderOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isScanStatusOpen, setIsScanStatusOpen] = React.useState(false);
  const [scanInterval, setScanInterval] = React.useState(3600);
  const [folders, setFolders] = React.useState<Array<{ id: string; path: string }>>([]);
  const [fullscreenContent, setFullscreenContent] = React.useState<{
    isOpen: boolean;
    title: string;
    content: React.ReactNode;
  }>({
    isOpen: false,
    title: '',
    content: null,
  });

  const queryClient = useQueryClient();

  const { data: scanStatus } = useQuery({
    queryKey: ['scanStatus'],
    queryFn: async () => {
      const response = await fetch('/api/scan/status');
      if (!response.ok) throw new Error('Failed to fetch scan status');
      return response.json();
    },
    refetchInterval: 1000,
  });

  const { data: storageStats } = useQuery({
    queryKey: ['storageStats'],
    queryFn: async () => {
      const response = await fetch('/api/storage/stats');
      if (!response.ok) throw new Error('Failed to fetch storage stats');
      return response.json();
    },
    refetchInterval: 5000,
  });

  const { data: storageHistory } = useQuery({
    queryKey: ['storageHistory', timeRange],
    queryFn: async () => {
      const response = await fetch('/api/storage/history');
      if (!response.ok) throw new Error('Failed to fetch storage history');
      const data = await response.json();
      return data.map((item: any) => ({
        timestamp: new Date(item.timestamp),
        usedSize: item.used_size,
      }));
    },
  });

  const { data: fileTypes } = useQuery({
    queryKey: ['fileTypes'],
    queryFn: async () => {
      const response = await fetch('/api/files/types');
      if (!response.ok) throw new Error('Failed to fetch file types');
      return response.json();
    },
  });

  const { data: duplicateFiles } = useQuery({
    queryKey: ['duplicateFiles'],
    queryFn: async () => {
      const response = await fetch('/api/files/duplicates');
      if (!response.ok) throw new Error('Failed to fetch duplicates');
      return response.json();
    },
  });

  const { data: monitoredFolders } = useQuery({
    queryKey: ['monitoredFolders'],
    queryFn: async () => {
      const response = await fetch('/api/folders');
      if (!response.ok) throw new Error('Failed to fetch folders');
      return response.json();
    },
  });

  const handleScanIntervalChange = async (interval: number) => {
    try {
      const response = await fetch('/api/settings/scan-interval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval }),
      });
      
      if (!response.ok) throw new Error('Failed to update scan interval');
      setScanInterval(interval);
    } catch (error) {
      console.error('Error updating scan interval:', error);
    }
  };

  const handleAddFolder = async (path: string) => {
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      
      if (!response.ok) throw new Error('Failed to add folder');
      const { id } = await response.json();
      setFolders(prev => [...prev, { id, path }]);
      queryClient.invalidateQuery({ queryKey: ['monitoredFolders'] });
    } catch (error) {
      console.error('Error adding folder:', error);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      const response = await fetch(`/api/folders/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete folder');
      setFolders(prev => prev.filter(folder => folder.id !== id));
      queryClient.invalidateQuery({ queryKey: ['monitoredFolders'] });
    } catch (error) {
      console.error('Error deleting folder:', error);
    }
  };

  const handleRefresh = async () => {
    if (scanStatus?.isScanning) return;
    
    try {
      const response = await fetch('/api/scan', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to initiate scan');
      }
      setIsScanStatusOpen(true);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  const openFullscreen = (title: string, content: React.ReactNode) => {
    setFullscreenContent({
      isOpen: true,
      title,
      content,
    });
  };

  return (
    <main className="container mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Storage Overview Card - Full Width */}
        <div className="col-span-full bg-card-light dark:bg-card-dark rounded-lg shadow-md p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {storageStats ? formatBytes(storageStats.used_size) : 'Loading...'}
              </h2>
              <p className="text-gray-500 dark:text-gray-400">Total Storage Used</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1 text-sm text-gray-900 dark:text-white"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
              <button 
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                onClick={() => openFullscreen('Storage Usage Over Time', 
                  <div className="h-full">
                    <StorageChart data={storageHistory || []} timeRange={timeRange} />
                  </div>
                )}
              >
                <Maximize2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>
          <div className="h-48">
            <StorageChart data={storageHistory || []} timeRange={timeRange} />
          </div>
        </div>

        {/* Storage Distribution */}
        <div className="bg-card-light dark:bg-card-dark rounded-lg shadow-md p-4">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-primary-light dark:text-primary-dark" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Storage Distribution</h3>
            </div>
            <button 
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              onClick={() => openFullscreen('Storage Distribution', 
                <div className="h-full w-full">
                  <FileTypePieChart data={fileTypes || []} />
                </div>
              )}
            >
              <Maximize2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          <div className="h-[300px]">
            <FileTypePieChart data={fileTypes || []} />
          </div>
        </div>

        {/* Storage by File Type */}
        <div className="bg-card-light dark:bg-card-dark rounded-lg shadow-md p-4">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <FileType2 className="w-5 h-5 text-primary-light dark:text-primary-dark" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Storage by File Type</h3>
            </div>
            <button 
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              onClick={() => openFullscreen('Storage by File Type', 
                <div className="space-y-4">
                  {fileTypes?.map((item: any) => (
                    <div key={item.type} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <span className="text-gray-700 dark:text-gray-300 text-lg">{item.type}</span>
                      <span className="text-gray-900 dark:text-white font-medium text-lg">
                        {formatBytes(item.size)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            >
              <Maximize2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          <div className="space-y-3">
            {fileTypes?.map((item: any) => (
              <div key={item.type} className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">{item.type}</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {formatBytes(item.size)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Monitored Folders */}
        <div className="bg-card-light dark:bg-card-dark rounded-lg shadow-md p-4">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <Files className="w-5 h-5 text-primary-light dark:text-primary-dark" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Monitored Folders</h3>
            </div>
            <button 
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              onClick={() => openFullscreen('Monitored Folders', 
                <div className="space-y-4">
                  <button 
                    onClick={() => setIsAddFolderOpen(true)}
                    className="w-full py-2 px-4 bg-primary-light dark:bg-primary-dark text-white rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Add Folder
                  </button>
                  <FolderTree data={monitoredFolders || { name: 'Loading...', size: 0, type: 'folder' as const }} />
                </div>
              )}
            >
              <Maximize2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          <div className="space-y-3">
            <button 
              onClick={() => setIsAddFolderOpen(true)}
              className="w-full py-2 px-4 bg-primary-light dark:bg-primary-dark text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Add Folder
            </button>
            <FolderTree data={monitoredFolders || { name: 'Loading...', size: 0, type: 'folder' as const }} />
          </div>
        </div>

        {/* Monitored Folders Distribution */}
        <div className="bg-card-light dark:bg-card-dark rounded-lg shadow-md p-4">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <FolderTreeIcon className="w-5 h-5 text-primary-light dark:text-primary-dark" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Folders Distribution</h3>
            </div>
            <button 
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              onClick={() => openFullscreen('Folders Distribution', 
                <div className="h-full w-full">
                  <MonitoredFoldersPieChart data={monitoredFolders || { name: 'Loading...', size: 0, type: 'folder' as const }} />
                </div>
              )}
            >
              <Maximize2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          <div className="h-[300px]">
            <MonitoredFoldersPieChart data={monitoredFolders || { name: 'Loading...', size: 0, type: 'folder' as const }} />
          </div>
        </div>

        {/* Duplicate Files Card - Full Width */}
        <div className="col-span-full bg-card-light dark:bg-card-dark rounded-lg shadow-md p-4">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <Copy className="w-5 h-5 text-primary-light dark:text-primary-dark" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Duplicate Files</h3>
            </div>
            <button 
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              onClick={() => openFullscreen('Duplicate Files', 
                <DuplicateFiles files={duplicateFiles || []} />
              )}
            >
              <Maximize2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          <DuplicateFiles files={duplicateFiles || []} />
        </div>
      </div>

      <AddFolderModal
        isOpen={isAddFolderOpen}
        onClose={() => setIsAddFolderOpen(false)}
        onAdd={handleAddFolder}
      />

      <FullscreenModal
        isOpen={fullscreenContent.isOpen}
        onClose={() => setFullscreenContent(prev => ({ ...prev, isOpen: false }))}
        title={fullscreenContent.title}
      >
        {fullscreenContent.content}
      </FullscreenModal>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        scanInterval={scanInterval}
        onScanIntervalChange={handleScanIntervalChange}
        folders={folders}
        onDeleteFolder={handleDeleteFolder}
      />

      <ScanStatusModal
        isOpen={isScanStatusOpen}
        onClose={() => setIsScanStatusOpen(false)}
        status={scanStatus}
      />
    </main>
  );
}

export default MainContent;
