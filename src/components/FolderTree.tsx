import React from 'react';
import { ChevronRight, ChevronDown, Folder, File } from 'lucide-react';
import { formatBytes } from '../utils/format';

interface FileNode {
  name: string;
  size: number;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface FolderTreeProps {
  data: FileNode;
  level?: number;
}

export function FolderTree({ data, level = 0 }: FolderTreeProps) {
  const [isExpanded, setIsExpanded] = React.useState(level === 0);

  const sortedChildren = React.useMemo(() => {
    if (!data.children) return [];
    return [...data.children].sort((a, b) => b.size - a.size);
  }, [data.children]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="w-full">
      <div
        className={`flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer ${
          level === 0 ? 'bg-gray-50 dark:bg-gray-800' : ''
        }`}
        onClick={handleToggle}
        style={{ paddingLeft: `${level * 1.5}rem` }}
      >
        {data.children && data.children.length > 0 ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )
        ) : (
          <span className="w-4" />
        )}
        {data.type === 'folder' ? (
          <Folder className="w-4 h-4 text-primary-light dark:text-primary-dark" />
        ) : (
          <File className="w-4 h-4 text-gray-500" />
        )}
        <span className="flex-1 text-gray-700 dark:text-gray-300">{data.name}</span>
        <span className="text-gray-900 dark:text-white font-medium">
          {formatBytes(data.size)}
        </span>
      </div>
      {isExpanded && sortedChildren.length > 0 && (
        <div className="space-y-1">
          {sortedChildren.map((child, index) => (
            <FolderTree key={`${child.name}-${index}`} data={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}