import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { formatBytes } from '../utils/format';
import { useThemeStore } from '../store/theme';

ChartJS.register(ArcElement, Tooltip, Legend);

interface FileTypeData {
  type: string;
  size: number;
}

interface FileTypePieChartProps {
  data: FileTypeData[];
}

export function FileTypePieChart({ data }: FileTypePieChartProps) {
  const { isDark } = useThemeStore();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
  
  React.useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setContainerSize({ width, height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const colors = [
    'rgb(59, 130, 246)', // blue
    'rgb(16, 185, 129)', // green
    'rgb(239, 68, 68)',  // red
    'rgb(245, 158, 11)', // yellow
    'rgb(139, 92, 246)'  // purple
  ];

  const chartData = {
    labels: data.map(item => item.type),
    datasets: [
      {
        data: data.map(item => item.size),
        backgroundColor: colors,
        borderColor: 'transparent',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: isDark ? '#fff' : '#000',
          padding: 20,
          font: {
            size: Math.min(Math.max(containerSize.width * 0.02, 12), 16),
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `${context.label}: ${formatBytes(context.raw)}`;
          },
        },
      },
    },
  };

  return (
    <div ref={containerRef} className="h-full w-full flex items-center justify-center">
      <div style={{ width: '100%', height: '100%', maxHeight: containerSize.height }}>
        <Pie data={chartData} options={options} />
      </div>
    </div>
  );
}
