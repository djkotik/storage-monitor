import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Maximize2, FolderOpen, FileText, HardDrive, Sun, Moon, RefreshCw } from 'lucide-react';

const StorageDashboard = () => {
  const [timeRange, setTimeRange] = useState('week');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  // Sample data remains the same as before
  const storageData = [
    { date: '2024-01-16', usage: 10.2 },
    { date: '2024-01-17', usage: 10.5 },
    { date: '2024-01-18', usage: 10.8 },
    { date: '2024-01-19', usage: 11.2 },
    { date: '2024-01-20', usage: 11.5 },
    { date: '2024-01-21', usage: 11.9 },
    { date: '2024-01-22', usage: 12.1 }
  ];

  const typeData = [
    { type: 'Video', size: 5.2 },
    { type: 'Images', size: 2.8 },
    { type: 'Documents', size: 1.5 },
    { type: 'Audio', size: 1.2 },
    { type: 'Other', size: 1.4 }
  ];

  const folderData = [
    { name: 'Downloads', size: 5.2, items: 11 },
    { name: '.local', size: 4.7, items: 98578 },
    { name: '.cache', size: 1.7, items: 32813 },
    { name: '.config', size: 0.364, items: 2651 }
  ];

  const handleScan = async () => {
    setIsScanning(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className={`p-6 min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header with Theme Toggle and Scan Button */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Storage Dashboard</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            onClick={handleScan}
            disabled={isScanning}
            className={`flex items-center gap-2 px-4 py-2 rounded ${
              isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
            } text-white`}
          >
            <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>
      </div>

      {/* Total Storage Overview */}
      <Card className={`mb-6 relative ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
        <Maximize2 className="h-5 w-5 cursor-pointer hover:text-blue-500 absolute top-4 right-4" />
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <HardDrive className="h-8 w-8 text-blue-500" />
              <div>
                <h2 className="text-2xl font-bold">12.1 GB</h2>
                <p className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                  Total Storage Used
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <p className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                Last scan: Today 14:30
              </p>
              <select 
                className={`border rounded p-2 ${
                  isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                }`}
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <option value="day">24 Hours</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Storage Usage Over Time */}
        <Card className={`relative ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
          <Maximize2 className="h-5 w-5 cursor-pointer hover:text-blue-500 absolute top-4 right-4" />
          <CardContent className="pt-12">
            <h3 className="text-lg font-semibold mb-4">Storage Growth</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={storageData}>
                  <XAxis 
                    dataKey="date" 
                    stroke={isDarkMode ? '#9CA3AF' : '#6B7280'}
                  />
                  <YAxis
                    stroke={isDarkMode ? '#9CA3AF' : '#6B7280'}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#374151' : '#FFFFFF',
                      borderColor: isDarkMode ? '#4B5563' : '#E5E7EB',
                      color: isDarkMode ? '#FFFFFF' : '#000000'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="usage" 
                    stroke="#2563eb"
                    strokeWidth={2} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Storage by File Type */}
        <Card className={`relative ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
          <Maximize2 className="h-5 w-5 cursor-pointer hover:text-blue-500 absolute top-4 right-4" />
          <CardContent className="pt-12">
            <h3 className="text-lg font-semibold mb-4">Storage by File Type</h3>
            <div className="space-y-4">
              {typeData.map((item) => (
                <div key={item.type} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <span>{item.type}</span>
                  </div>
                  <span className="font-medium">{item.size} GB</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Monitored Folders */}
        <Card className={`md:col-span-2 relative ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
          <Maximize2 className="h-5 w-5 cursor-pointer hover:text-blue-500 absolute top-4 right-4" />
          <CardContent className="pt-12">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Monitored Folders</h3>
              <button className={`px-4 py-2 ${
                isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
              } text-white rounded`}>
                Add Folder
              </button>
            </div>
            <div className="space-y-4">
              {folderData.map((folder) => (
                <div 
                  key={folder.name}
                  className={`flex items-center justify-between p-4 rounded-lg cursor-pointer ${
                    isDarkMode 
                      ? 'bg-gray-700 hover:bg-gray-600' 
                      : 'bg-white border hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <FolderOpen className="h-5 w-5 text-blue-500" />
                    <div>
                      <h3 className="font-medium">{folder.name}</h3>
                      <p className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                        {folder.items} items
                      </p>
                    </div>
                  </div>
                  <span className="font-medium">{folder.size} GB</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StorageDashboard;