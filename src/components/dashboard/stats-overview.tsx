'use client';

import { useMemo } from 'react';
import { WebinarSummary } from '@/types/webinar';
import { Card } from '@/components/ui/card';

interface StatsOverviewProps {
  webinars: WebinarSummary[];
  attendeeMetricsLoaded?: number;
  attendeeMetricsTotal?: number;
  startDate?: string; // ISO date e.g. "2025-11-01"
  endDate?: string;
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

interface ChartPoint { value: number; label: string }

function Sparkline({ data, color }: { data: ChartPoint[]; color: string }) {
  if (data.length < 2) return null;

  const values = data.map(d => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const W = 200, H = 26, P = 2;
  const x = (i: number) => P + (i / (data.length - 1)) * (W - P * 2);
  const y = (v: number) => P + (H - P * 2) - ((v - min) / range) * (H - P * 2);
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');

  return (
    <div className="mt-auto pt-2">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
        <polygon
          points={`${P},${H - P} ${pts} ${W - P},${H - P}`}
          fill={`${color}18`}
        />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  sparkData,
  sparkColor = '#00b09c',
  rangeLabel = '',
  accent = 'none',
}: {
  label: string;
  value: string | number;
  sub?: string;
  sparkData?: ChartPoint[];
  sparkColor?: string;
  rangeLabel?: string;
  accent?: 'blue' | 'teal' | 'gray' | 'purple' | 'none';
}) {
  return (
    <Card className="px-4 py-3 flex flex-col" accent={accent}>
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ansell-gray truncate">{label}</p>
      <p className="mt-1 text-[22px] font-bold leading-none text-ansell-dark">{value}</p>
      {sub && <p className="text-[11px] text-ansell-gray mt-0.5">{sub}</p>}
      {sparkData && <Sparkline data={sparkData} color={sparkColor} />}
    </Card>
  );
}

// ── Metric pill ───────────────────────────────────────────────────────────────

function MetricPill({
  label,
  value,
  loading,
}: {
  label: string;
  value: number;
  loading?: boolean;
}) {
  return (
    <div className="px-4 py-3 bg-white" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <div className="text-[18px] font-bold text-ansell-dark leading-tight">
        {loading && value === 0 ? (
          <span className="text-gray-300">—</span>
        ) : (
          value.toLocaleString()
        )}
      </div>
      <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-ansell-gray">{label}</div>
    </div>
  );
}

// ── Trend bucketing ────────────────────────────────────────────────────────────

function buildTrendData(
  webinars: WebinarSummary[],
  startDate: string | undefined,
  endDate: string | undefined,
) {
  const now = new Date();
  const end = endDate ? new Date(endDate) : now;
  const start = startDate ? new Date(startDate) : (() => { const d = new Date(now); d.setDate(d.getDate() - 30); return d; })();

  const daysDiff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));

  // Adaptive granularity
  const gran: 'day' | 'week' | 'month' =
    daysDiff <= 31 ? 'day' : daysDiff <= 90 ? 'week' : 'month';

  type Bucket = { count: number; reg: number; att: number; label: string };
  const map = new Map<string, Bucket>();

  if (gran === 'day') {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      map.set(key, { count: 0, reg: 0, att: 0, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
    }
    for (const w of webinars) {
      if (!w.startDateTime) continue;
      const key = new Date(w.startDateTime).toISOString().split('T')[0];
      const b = map.get(key);
      if (b) { b.count++; b.reg += w.eventAnalytics?.totalRegistrants ?? w.totalRegistrations ?? 0; b.att += w.eventAnalytics?.totalAttendees ?? w.totalAttendees ?? 0; }
    }
  } else if (gran === 'week') {
    // Build week-start keys
    const weekStarts: Date[] = [];
    let ws = new Date(start);
    while (ws <= end) { weekStarts.push(new Date(ws)); ws = new Date(ws); ws.setDate(ws.getDate() + 7); }
    for (const ws of weekStarts) {
      map.set(ws.toISOString().split('T')[0], { count: 0, reg: 0, att: 0, label: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
    }
    for (const w of webinars) {
      if (!w.startDateTime) continue;
      const d = new Date(w.startDateTime);
      // Find bucket: latest weekStart <= d
      let key = '';
      for (const ws of weekStarts) {
        if (d >= ws) key = ws.toISOString().split('T')[0]; else break;
      }
      const b = map.get(key);
      if (b) { b.count++; b.reg += w.eventAnalytics?.totalRegistrants ?? w.totalRegistrations ?? 0; b.att += w.eventAnalytics?.totalAttendees ?? w.totalAttendees ?? 0; }
    }
  } else {
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, { count: 0, reg: 0, att: 0, label: cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) });
      cur.setMonth(cur.getMonth() + 1);
    }
    for (const w of webinars) {
      if (!w.startDateTime) continue;
      const d = new Date(w.startDateTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const b = map.get(key);
      if (b) { b.count++; b.reg += w.eventAnalytics?.totalRegistrants ?? w.totalRegistrations ?? 0; b.att += w.eventAnalytics?.totalAttendees ?? w.totalAttendees ?? 0; }
    }
  }

  const buckets = Array.from(map.values());

  return {
    counts:        buckets.map(v => ({ value: v.count, label: v.label })),
    registrations: buckets.map(v => ({ value: v.reg,   label: v.label })),
    attendees:     buckets.map(v => ({ value: v.att,   label: v.label })),
  };
}

// ── Main component ─────────────────────────────────────────────────────────────

export function StatsOverview({
  webinars,
  attendeeMetricsLoaded = 0,
  attendeeMetricsTotal = 0,
  startDate,
  endDate,
}: StatsOverviewProps) {
  const metricsLoading = attendeeMetricsLoaded < attendeeMetricsTotal;

  // ── Aggregate totals ──────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let registrations = 0, attendees = 0, noShows = 0;
    let liveMinutes = 0, archiveMinutes = 0;
    let questionsAsked = 0, surveysAnswered = 0, pollsAnswered = 0, resourcesDownloaded = 0;

    for (const w of webinars) {
      const ea = w.eventAnalytics;
      const am = w.attendeeMetrics;
      registrations += ea?.totalRegistrants ?? w.totalRegistrations ?? 0;
      attendees     += ea?.totalAttendees   ?? w.totalAttendees   ?? 0;
      noShows       += ea?.noShowCount ?? 0;
      liveMinutes   += ea?.totalCumulativeLiveMinutes    ?? 0;
      archiveMinutes += ea?.totalCumulativeArchiveMinutes ?? 0;
      if (am?.loaded) {
        questionsAsked     += am.totalQuestionsAsked  ?? 0;
        surveysAnswered    += am.totalSurveysAnswered  ?? 0;
        pollsAnswered      += am.totalPollsAnswered    ?? 0;
        resourcesDownloaded += am.totalResourcesDownloaded ?? 0;
      }
    }

    const totalViewingHours = Math.round((liveMinutes + archiveMinutes) / 60);
    const attendanceRate = registrations > 0 ? (attendees / registrations) * 100 : 0;
    return { registrations, attendees, noShows, totalViewingHours, attendanceRate, questionsAsked, surveysAnswered, pollsAnswered, resourcesDownloaded };
  }, [webinars]);

  // ── Trend data (range-aware) ───────────────────────────────────────────────
  const trends = useMemo(
    () => buildTrendData(webinars, startDate, endDate),
    [webinars, startDate, endDate],
  );

  const fmtNum = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  const noShowRate = totals.attendees + totals.noShows > 0
    ? Math.round((totals.noShows / (totals.attendees + totals.noShows)) * 100)
    : 0;

  return (
    <div className="space-y-3">
      {/* Row 1: core counts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Webinars"
          value={webinars.length}
          sparkData={trends.counts}
          sparkColor="#0063AC"
          accent="blue"
        />
        <StatCard
          label="Registrations"
          value={fmtNum(totals.registrations)}
          sparkData={trends.registrations}
          sparkColor="#00A28F"
          accent="teal"
        />
        <StatCard
          label="Attendees"
          value={fmtNum(totals.attendees)}
          sub={`${totals.attendanceRate.toFixed(1)}% attendance rate`}
          sparkData={trends.attendees}
          sparkColor="#0063AC"
          accent="blue"
        />
        <StatCard
          label="Total Viewing Hours"
          value={totals.totalViewingHours.toLocaleString()}
          sub={noShowRate > 0 ? `${noShowRate}% no-show rate` : undefined}
          accent="purple"
        />
      </div>

      {/* Row 2: interaction metrics */}
      <div className="bg-white p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderTop: '5px solid #75787B' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-ansell-gray">Engagement</span>
          {metricsLoading ? (
            <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-ansell-teal animate-pulse" />
              Loading {attendeeMetricsLoaded}/{attendeeMetricsTotal} events
            </span>
          ) : attendeeMetricsTotal > 0 ? (
            <span className="text-[11px] text-emerald-600">All metrics loaded</span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MetricPill label="Q&A questions"     value={totals.questionsAsked}       loading={metricsLoading} />
          <MetricPill label="Survey responses"  value={totals.surveysAnswered}      loading={metricsLoading} />
          <MetricPill label="Poll responses"    value={totals.pollsAnswered}        loading={metricsLoading} />
          <MetricPill label="Resource downloads" value={totals.resourcesDownloaded} loading={metricsLoading} />
        </div>
        {metricsLoading && (
          <p className="mt-2 text-[10px] text-gray-400">
            Interaction counts update as attendee data loads. Stats reflect {attendeeMetricsLoaded} of {attendeeMetricsTotal} events.
          </p>
        )}
      </div>
    </div>
  );
}
