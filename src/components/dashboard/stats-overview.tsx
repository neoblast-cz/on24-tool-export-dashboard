'use client';

import { useMemo, useState } from 'react';
import { OverallStats, WebinarSummary } from '@/types/webinar';
import { Card } from '@/components/ui/card';

interface StatsOverviewProps {
  stats: OverallStats;
  webinars?: WebinarSummary[];
}

interface ChartDataPoint {
  value: number;
  label: string;
}

// Mini sparkline chart component with hover
function MiniChart({ data, color, formatValue }: { data: ChartDataPoint[]; color: string; formatValue: (v: number) => string }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length < 2) return null;

  const values = data.map(d => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const height = 40;
  const width = 140;
  const padding = 4;

  const getX = (i: number) => padding + (i / (data.length - 1)) * (width - padding * 2);
  const getY = (value: number) => padding + (height - padding * 2) - ((value - min) / range) * (height - padding * 2);

  const points = data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ');

  // Calculate trend
  const trend = data.length >= 2 ? values[values.length - 1] - values[0] : 0;
  const trendPercent = values[0] !== 0 ? ((trend / values[0]) * 100).toFixed(0) : '0';

  return (
    <div className="mt-3">
      <div className="relative">
        <svg width={width} height={height} className="overflow-visible">
          {/* Background grid lines */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" strokeWidth="1" />

          {/* Area fill */}
          <polygon
            points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
            fill={`${color}20`}
          />

          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive dots */}
          {data.map((d, i) => (
            <g key={i}>
              <circle
                cx={getX(i)}
                cy={getY(d.value)}
                r={hoveredIndex === i ? 5 : 3}
                fill={hoveredIndex === i ? color : 'white'}
                stroke={color}
                strokeWidth="2"
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredIndex !== null && (
          <div
            className="absolute bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10"
            style={{
              left: getX(hoveredIndex),
              top: -8,
              transform: 'translateX(-50%) translateY(-100%)',
            }}
          >
            <div className="font-medium">{formatValue(data[hoveredIndex].value)}</div>
            <div className="text-gray-400">{data[hoveredIndex].label}</div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-gray-400">Last 6 months</span>
        <span className={`text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(Number(trendPercent))}%
        </span>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  chartData?: ChartDataPoint[];
  chartColor?: string;
  formatChartValue?: (v: number) => string;
}

function StatCard({ title, value, subtitle, icon, chartData, chartColor = '#00b09c', formatChartValue = (v) => v.toFixed(1) }: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          {chartData && chartData.length >= 2 && (
            <MiniChart data={chartData} color={chartColor} formatValue={formatChartValue} />
          )}
        </div>
        <div className="p-2 bg-ansell-teal/10 rounded-lg">{icon}</div>
      </div>
    </Card>
  );
}

export function StatsOverview({ stats, webinars = [] }: StatsOverviewProps) {
  // Calculate monthly trends for last 6 months
  const monthlyTrends = useMemo(() => {
    if (webinars.length === 0) return { counts: [], engagements: [], attendances: [] };

    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Group webinars by month
    const monthlyData: Map<string, { count: number; totalEngagement: number; totalAttendance: number; webinarCount: number; label: string }> = new Map();

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthlyData.set(key, { count: 0, totalEngagement: 0, totalAttendance: 0, webinarCount: 0, label });
    }

    // Populate with webinar data
    webinars.forEach(w => {
      if (!w.startDateTime) return;
      const date = new Date(w.startDateTime);
      if (date < sixMonthsAgo) return;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthlyData.get(key);
      if (existing) {
        existing.count++;
        existing.totalEngagement += w.engagementScore || 0;
        const attendanceRate = w.totalRegistrations > 0
          ? (w.totalAttendees / w.totalRegistrations) * 100
          : 0;
        existing.totalAttendance += Math.min(attendanceRate, 100);
        existing.webinarCount++;
      }
    });

    // Convert to arrays with labels
    const sorted = Array.from(monthlyData.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    return {
      counts: sorted.map(([, v]) => ({ value: v.count, label: v.label })),
      engagements: sorted.map(([, v]) => ({ value: v.webinarCount > 0 ? v.totalEngagement / v.webinarCount : 0, label: v.label })),
      attendances: sorted.map(([, v]) => ({ value: v.webinarCount > 0 ? v.totalAttendance / v.webinarCount : 0, label: v.label })),
    };
  }, [webinars]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Webinars"
        value={stats.totalWebinars}
        chartData={monthlyTrends.counts}
        chartColor="#00b09c"
        formatChartValue={(v) => `${Math.round(v)} webinars`}
        icon={
          <svg className="h-6 w-6 text-ansell-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        }
      />
      <StatCard
        title="Avg Engagement Score"
        value={stats.avgEngagementScore.toFixed(1)}
        subtitle="Out of 10"
        chartData={monthlyTrends.engagements}
        chartColor="#00b09c"
        formatChartValue={(v) => `${v.toFixed(1)} / 10`}
        icon={
          <svg className="h-6 w-6 text-ansell-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        }
      />
      <StatCard
        title="Avg Attendance Rate"
        value={`${Math.min(stats.avgAttendanceRate, 100).toFixed(1)}%`}
        subtitle="Registrations to attendees"
        chartData={monthlyTrends.attendances}
        chartColor="#00b09c"
        formatChartValue={(v) => `${v.toFixed(1)}%`}
        icon={
          <svg className="h-6 w-6 text-ansell-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        }
      />
      <StatCard
        title="Top Performer"
        value={stats.topPerformer.length > 25 ? stats.topPerformer.slice(0, 25) + '...' : stats.topPerformer}
        subtitle="Highest engagement"
        icon={
          <svg className="h-6 w-6 text-ansell-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        }
      />
    </div>
  );
}
