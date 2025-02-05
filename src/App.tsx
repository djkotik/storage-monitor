import React, { useState } from 'react';
import { Moon, Sun, HardDrive, AlertCircle } from 'lucide-react';
import { useThemeStore } from './store/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MainContent from './components/MainContent';
import LogViewer from './components/LogViewer';

const queryClient = new QueryClient();

function App() {
  const { isDark, toggleTheme } = useThemeStore();
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);

  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className={`min-h-screen bg-background-light dark:bg-background-dark transition-colors duration-200`}>
        <header className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2">
              <HardDrive className="w-6 h-6 text-primary-light dark:text-primary-dark" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Storage Monitor</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsLogViewerOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
              >
                <AlertCircle className="w-5 h-5 text-gray-700 dark:text-gray-200" />
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
        <MainContent />
        <LogViewer isOpen={isLogViewerOpen} onClose={() => setIsLogViewerOpen(false)} />
      </div>
    </QueryClientProvider>
  );
}

export default App;
