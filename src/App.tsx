import React from 'react';
import { Moon, Sun, Maximize2, HardDrive, FileType2, Files, Copy, PieChart, FolderTree as FolderTreeIcon, RefreshCw, Settings as SettingsIcon, AlertCircle } from 'lucide-react';
import { useThemeStore } from './store/theme';
import { StorageChart } from './components/StorageChart';
import { FolderTree } from './components/FolderTree';
import { DuplicateFiles } from './components/DuplicateFiles';
import { FileTypePieChart } from './components/FileTypePieChart';
import { MonitoredFoldersPieChart } from './components/MonitoredFoldersPieChart';
import { AddFolderModal } from './components/AddFolderModal';
import { FullscreenModal } from './components/FullscreenModal';
import { formatBytes } from './utils/format';
import { SettingsModal } from './components/SettingsModal';
import { ScanStatusModal } from './components/ScanStatusModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';

function App() {
  const { isDark, toggleTheme } = useThemeStore();
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

  const { data: storageStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['storageStats'],
    queryFn: async () => {
      const response = await fetch('/api/storage/stats');
      if (!response.ok) throw new Error('Failed to fetch storage stats');
      return response.json();
    },
    refetchInterval: 5000,
  });

  const { data: storageHistory, isLoading: isLoadingHistory } = useQuery({
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

  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  if (isLoadingStats || storageStats?.initializing) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark transition-colors duration-200">
        <header className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2">
              <HardDrive className="w-6 h-6 text-primary-light dark:text-primary-dark" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Storage Monitor</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-gray-200" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-700" />
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="container mx-auto p-4">
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <div className="animate-spin">
              <RefreshCw className="w-8 h-8 text-primary-light dark:text-primary-dark" />
            </div>
            <p className="text-lg text-gray-700 dark:text-gray-300">
              {storageStats?.initializing 
                ? "Initializing storage monitor..."
                : "Loading storage information..."}
            </p>
            <button
              onClick={() => setIsAddFolderOpen(true)}
              className="px-4 py-2 bg-primary-light dark:bg-primary-dark text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Add Folder to Monitor
            </button>
          </div>
        </main>

        <AddFolderModal
          isOpen={isAddFolderOpen}
          onClose={() => setIsAddFolderOpen(false)}
          onAdd={handleAddFolder}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background-light dark:bg-background-dark transition-colors duration-200`}>
      <header className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <HardDrive className="w-6 h-6 text-primary-light dark:text-primary-dark" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Storage Monitor</h1>
            </div>
            {scanStatus?.lastScanTime && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Last scan: {new Date(scanStatus.lastScanTime).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {scanStatus?.isScanning && (
              <button
                onClick={() => setIsScanStatusOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
              >
                <AlertCircle className="w-5 h-5 text-primary-light dark:text-primary-dark animate-pulse" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary-light dark:bg-primary-dark rounded-full" />
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={scanStatus?.isScanning}
              className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                scanStatus?.isScanning ? 'opacity-50' : ''
              }`}
            >
              <RefreshCw className={`w-5 h-5 text-gray-700 dark:text-gray-200 ${
                scanStatus?.isScanning ? 'animate-spin' : ''
              }`} />
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <SettingsIcon className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-gray-200" />
              ) : (
                <Moon className="w-5 h-5 text-gray-700" />
              )}
            </button>
          </div>
        </div>
      </header>

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
      </main>

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
    </div>
  );
}

export default App;