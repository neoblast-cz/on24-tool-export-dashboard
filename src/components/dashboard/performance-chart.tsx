'use client';

import { WebinarSummary } from '@/types/webinar';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface PerformanceChartProps {
  webinars: WebinarSummary[];
}

const getBarColor = (score: number) => {
  if (score >= 8) return '#22c55e'; // green
  if (score >= 6) return '#3b82f6'; // blue
  if (score >= 4) return '#eab308'; // yellow
  return '#ef4444'; // red
};

export function PerformanceChart({ webinars }: PerformanceChartProps) {
  // Sort by date and take last 10
  const chartData = [...webinars]
    .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime())
    .slice(-10)
    .map((w) => {
      const name = w.webinarName || `Event ${w.eventId}`;
      return {
        name: name.length > 20 ? name.slice(0, 20) + '...' : name,
        fullName: name,
      engagement: w.engagementScore,
      attendanceRate:
        w.totalRegistrations > 0
          ? ((w.totalAttendees / w.totalRegistrations) * 100).toFixed(1)
          : 0,
      };
    });

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No data available for chart
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="name"
          angle={-45}
          textAnchor="end"
          height={80}
          tick={{ fontSize: 11 }}
        />
        <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div className="bg-white p-3 shadow-lg rounded-lg border">
                  <p className="font-medium text-sm">{data.fullName}</p>
                  <p className="text-sm text-gray-600">
                    Engagement: <span className="font-semibold">{data.engagement.toFixed(1)}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Attendance: <span className="font-semibold">{data.attendanceRate}%</span>
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar dataKey="engagement" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.engagement)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
