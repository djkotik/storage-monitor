import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { format } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface StorageHistoryPoint {
  timestamp: Date;
  usedSize: number;
}

interface StorageChartProps {
  data: StorageHistoryPoint[];
  timeRange: 'day' | 'week' | 'month' | 'year';
}

export function StorageChart({ data, timeRange }: StorageChartProps) {
  const chartData = {
    labels: data.map(point => format(new Date(point.timestamp), 'MMM dd, yyyy')),
    datasets: [
      {
        label: 'Storage Used',
        data: data.map(point => point.usedSize / (1024 * 1024 * 1024)), // Convert to GB
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `${context.parsed.y.toFixed(2)} GB`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number) => `${value.toFixed(2)} GB`,
        },
      },
    },
  };

  return (
    <div className="h-full w-full">
      <Line data={chartData} options={options} />
    </div>
  );
}