import React from 'react';
import { Moon, Sun, Maximize2, HardDrive, FileType2, Files, Copy, PieChart, FolderTree as FolderTreeIcon, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
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

// Mock data - replace with real data from your backend
const generateStorageHistory = (days: number) => {
  return Array.from({ length: days }, (_, i) => ({
    timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
    usedSize: 80 * 1024 * 1024 * 1024 + (Math.random() * 20 * 1024 * 1024 * 1024), // Base 80GB + random up to 20GB
  })).reverse();
};

const mockFolderData = {
  name: 'data',
  size: 12.1 * 1024 * 1024 * 1024,
  type: 'folder' as const,
  children: [
    {
      name: 'Movies',
      size: 5.2 * 1024 * 1024 * 1024,
      type: 'folder' as const,
      children: [
        {
          name: 'Action',
          size: 3.1 * 1024 * 1024 * 1024,
          type: 'folder' as const,
        },
        {
          name: 'Comedy',
          size: 2.1 * 1024 * 1024 * 1024,
          type: 'folder' as const,
        },
      ],
    },
    {
      name: 'Photos',
      size: 2.8 * 1024 * 1024 * 1024,
      type: 'folder' as const,
    },
    {
      name: 'Documents',
      size: 1.5 * 1024 * 1024 * 1024,
      type: 'folder' as const,
    },
  ],
};

const mockFileTypes = [
  { type: 'Video', size: 5.2 * 1024 * 1024 * 1024 },
  { type: 'Images', size: 2.8 * 1024 * 1024 * 1024 },
  { type: 'Documents', size: 1.5 * 1024 * 1024 * 1024 },
  { type: 'Audio', size: 1.2 * 1024 * 1024 * 1024 },
  { type: 'Other', size: 1.4 * 1024 * 1024 * 1024 },
].sort((a, b) => b.size - a.size);

const mockDuplicates = [
  {
    name: 'movie.mp4',
    size: 1.5 * 1024 * 1024 * 1024,
    paths: [
      '/data/Movies/Action/movie.mp4',
      '/data/Movies/Backup/movie.mp4',
    ],
  },
  {
    name: 'document.pdf',
    size: 25 * 1024 * 1024,
    paths: [
      '/data/Documents/document.pdf',
      '/data/Documents/Archive/document.pdf',
      '/data/Downloads/document.pdf',
    ],
  },
];

function App() {
  const { isDark, toggleTheme } = useThemeStore();
  const [timeRange, setTimeRange] = React.useState<'day' | 'week' | 'month' | 'year'>('month');
  const [isAddFolderOpen, setIsAddFolderOpen] = React.useState(false);
  const [monitoredFolders, setMonitoredFolders] = React.useState(mockFolderData);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
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

  // Generate storage history based on time range
  const storageHistory = React.useMemo(() => {
    const days = timeRange === 'day' ? 1 : 
                timeRange === 'week' ? 7 : 
                timeRange === 'month' ? 30 : 365;
    return generateStorageHistory(days);
  }, [timeRange]);

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
    } catch (error) {
      console.error('Error deleting folder:', error);
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/scan', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to initiate scan');
      }
      // Reload the data after scan completes
      // In a production app, you'd want to implement proper data fetching here
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
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

  return (
    <div className={`min-h-screen bg-background-light dark:bg-background-dark transition-colors duration-200`}>
      <header className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-primary-light dark:text-primary-dark" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Storage Monitor</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                isRefreshing ? 'opacity-50' : ''
              }`}
            >
              <RefreshCw className={`w-5 h-5 text-gray-700 dark:text-gray-200 ${
                isRefreshing ? 'animate-spin' : ''
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
                  {formatBytes(monitoredFolders.size)}
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
                      <StorageChart data={storageHistory} timeRange={timeRange} />
                    </div>
                  )}
                >
                  <Maximize2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>
            <div className="h-48">
              <StorageChart data={storageHistory} timeRange={timeRange} />
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
                    <FileTypePieChart data={mockFileTypes} />
                  </div>
                )}
              >
                <Maximize2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="h-[300px]">
              <FileTypePieChart data={mockFileTypes} />
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
                    {mockFileTypes.map((item) => (
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
              {mockFileTypes.map((item) => (
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
                    <FolderTree data={monitoredFolders} />
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
              <FolderTree data={monitoredFolders} />
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
                    <MonitoredFoldersPieChart data={monitoredFolders} />
                  </div>
                )}
              >
                <Maximize2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="h-[300px]">
              <MonitoredFoldersPieChart data={monitoredFolders} />
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
                  <DuplicateFiles files={mockDuplicates} />
                )}
              >
                <Maximize2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <DuplicateFiles files={mockDuplicates} />
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
    </div>
  );
}

export default App;