'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { WebinarSummary, AttendeeMetrics } from '@/types/webinar';
import { useWebinarStore } from '@/store/webinar-store';
import { EventTable, EventTableRow, ExpandedPoll, ExpandedSurveyQuestion, ExpandedResource, ExpandedCTA, ExpandedPartnerRef } from '@/components/shared/event-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardRichDetail {
  pollDetails: ExpandedPoll[];
  surveyDetails: ExpandedSurveyQuestion[];
  resourceDetails: ExpandedResource[];
  ctaDetails: ExpandedCTA[];
  partnerRefStats: ExpandedPartnerRef[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}

// ── Date presets ──────────────────────────────────────────────────────────────

function getDatePresets(): { label: string; start: string; end: string }[] {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const daysAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };
  const year = today.getFullYear();
  const month = today.getMonth();
  const qStart = new Date(year, Math.floor(month / 3) * 3, 1);
  const lastQStart = new Date(qStart); lastQStart.setMonth(lastQStart.getMonth() - 3);
  const lastQEnd = new Date(qStart); lastQEnd.setDate(lastQEnd.getDate() - 1);
  return [
    { label: 'Last 30 days',  start: fmt(daysAgo(30)),  end: fmt(today) },
    { label: 'Last 60 days',  start: fmt(daysAgo(60)),  end: fmt(today) },
    { label: 'Last 90 days',  start: fmt(daysAgo(90)),  end: fmt(today) },
    { label: 'This quarter',  start: fmt(qStart),        end: fmt(today) },
    { label: 'Last quarter',  start: fmt(lastQStart),    end: fmt(lastQEnd) },
    { label: 'This year',     start: fmt(new Date(year, 0, 1)),          end: fmt(today) },
    { label: 'Last year',     start: fmt(new Date(year - 1, 0, 1)),      end: fmt(new Date(year - 1, 11, 31)) },
    { label: 'This FY',       start: fmt(month >= 6 ? new Date(year, 6, 1) : new Date(year - 1, 6, 1)), end: fmt(today) },
    { label: 'Last FY',       start: fmt(month >= 6 ? new Date(year - 1, 6, 1) : new Date(year - 2, 6, 1)), end: fmt(month >= 6 ? new Date(year, 5, 30) : new Date(year - 1, 5, 30)) },
  ];
}

const DATE_PRESETS = getDatePresets();
const DEFAULT_PRESET = DATE_PRESETS[0]; // Last 30 days

// ── Event type color helpers (for filter chips) ───────────────────────────────

const CHIP_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  'webpage':    { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-800', dot: 'bg-orange-400' },
  'video':      { bg: 'bg-sky-100',    border: 'border-sky-300',    text: 'text-sky-800',    dot: 'bg-sky-400'    },
  'experience': { bg: 'bg-pink-100',   border: 'border-pink-300',   text: 'text-pink-800',   dot: 'bg-pink-400'   },
};
const DEFAULT_CHIP = { bg: 'bg-violet-100', border: 'border-violet-300', text: 'text-violet-800', dot: 'bg-violet-400' };
function chipColor(type: string) { return CHIP_COLORS[type.toLowerCase()] ?? DEFAULT_CHIP; }

// ── Row adapter ───────────────────────────────────────────────────────────────

function toTableRow(
  w: WebinarSummary,
  richDetail: DashboardRichDetail | 'loading' | undefined,
  ctaCount: number | undefined,
  onExportImage: () => void,
  onPrint: () => void,
): EventTableRow {
  const am = w.attendeeMetrics;
  const ea = w.eventAnalytics;
  const metricsLoading = !am?.loaded;
  const detailLoading = richDetail === 'loading';

  const row: EventTableRow = {
    eventId: w.eventId,
    webinarName: w.webinarName,
    displayDate: formatDate(w.startDateTime),
    startDateTimeRaw: w.startDateTime,
    eventType: w.eventType || '',
    isTest: w.isTest ?? false,
    campaignCode: w.hasCampaignCode ? w.campaignName : undefined,
    hasCampaignCode: w.hasCampaignCode ?? false,
    tags: w.tags || [],
    speakers: w.speakers || [],
    duration: w.duration,
    language: w.language,
    category: w.category,
    timezone: w.timezone,
    registrants: ea?.totalRegistrants ?? w.totalRegistrations,
    attendees: am?.loaded ? am.attendeeCount : (ea?.totalAttendees ?? w.totalAttendees),
    engagementScore: am?.loaded ? am.avgEngagementScore : w.engagementScore,
    qa: am?.loaded ? am.totalQuestionsAsked : (w.questionsAsked || 0),
    polls: am?.loaded ? am.totalPollsAnswered : (w.pollResponses || 0),
    surveys: am?.loaded ? am.totalSurveysAnswered : (w.surveyResponses || 0),
    dl: am?.loaded ? am.totalResourcesDownloaded : (ea?.uniqueAttendeeResourceDownloads ?? w.resourcesDownloaded ?? 0),
    liveAttendees: am?.loaded ? am.liveViewerCount : undefined,
    ondemandAttendees: am?.loaded ? am.archiveViewerCount : undefined,
    noShows: ea?.noShowCount != null ? ea.noShowCount : undefined,
    totalLiveMinutes: am?.loaded ? am.totalLiveMinutes : (ea?.totalCumulativeLiveMinutes ?? undefined),
    totalArchiveMinutes: am?.loaded ? am.totalArchiveMinutes : (ea?.totalCumulativeArchiveMinutes ?? undefined),
    totalMinutes: am?.loaded ? am.totalViewingMinutes : undefined,
    avgLiveMinutes: am?.loaded ? am.avgLiveMinutes : undefined,
    avgArchiveMinutes: am?.loaded ? am.avgArchiveMinutes : undefined,
    avgEngagementScore: am?.loaded ? am.avgEngagementScore : undefined,
    cta: ctaCount,
    metricsLoading,
    detailLoading,
    promotionalSummary: w.promotionalSummary || undefined,
    audienceUrl: w.audienceUrl,
    reportUrl: w.reportUrl,
    onExportImage,
    onPrint,
    expandedNote: metricsLoading && !detailLoading ? 'Attendee metrics loading…' : undefined,
  };

  if (richDetail && richDetail !== 'loading') {
    row.pollDetails = richDetail.pollDetails;
    row.surveyDetails = richDetail.surveyDetails;
    row.resourceDetails = richDetail.resourceDetails;
    row.ctaDetails = richDetail.ctaDetails;
    row.partnerRefStats = richDetail.partnerRefStats;
    // Rich detail gives per-CTA breakdown; use its total (may be more precise)
    const detailCta = richDetail.ctaDetails.reduce((s, c) => s + c.totalClicks, 0);
    row.cta = detailCta > 0 ? detailCta : (ctaCount ?? detailCta);
  }

  return row;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WEBINAR_TYPES = new Set(['webcast', 'on demand', 'live video and audio']);
const METRICS_BATCH_SIZE = 20;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { setLiveWebinars, setLiveCtaCounts, filterStartDate, filterEndDate, filterVersion } = useWebinarStore();

  // Date range — sourced from shared store (set via global filter strip in header)
  const startDate = filterStartDate || DEFAULT_PRESET.start;
  const endDate   = filterEndDate   || DEFAULT_PRESET.end;

  // Data
  const [webinars, setWebinars] = useState<WebinarSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

  // Attendee metrics (progressive)
  const [attendeeMetricsMap, setAttendeeMetricsMap] = useState<Map<number, AttendeeMetrics>>(new Map());
  const [metricsLoaded, setMetricsLoaded] = useState(0);
  const [metricsTotal, setMetricsTotal] = useState(0);

  // CTA counts (progressive, parallel to attendee metrics)
  const [ctaCountsMap, setCtaCountsMap] = useState<Map<number, number>>(new Map());

  // Rich event detail (lazy-loaded on row expand)
  const [detailsMap, setDetailsMap] = useState<Map<number, DashboardRichDetail | 'loading'>>(new Map());

  // Post-load filters
  const [searchQuery, setSearchQuery] = useState('');
  const [excludedEventTypes, setExcludedEventTypes] = useState<Set<string>>(new Set());
  const [showTests, setShowTests] = useState(false);
  const [missingCampaignOnly, setMissingCampaignOnly] = useState(false);
  const [tagFilters, setTagFilters] = useState<string[]>([]);

  const fetchAbortRef = useRef<AbortController | null>(null);
  const metricsAbortRef = useRef<AbortController | null>(null);
  const ctaAbortRef = useRef<AbortController | null>(null);

  // ── Fetch events ────────────────────────────────────────────────────────────

  const fetchEvents = async (start: string, end: string) => {
    fetchAbortRef.current?.abort();
    metricsAbortRef.current?.abort();
    ctaAbortRef.current?.abort();

    const abort = new AbortController();
    fetchAbortRef.current = abort;

    setLoading(true);
    setError('');
    setProgress('Loading events…');
    setWebinars([]);
    setAttendeeMetricsMap(new Map());
    setCtaCountsMap(new Map());
    setDetailsMap(new Map());
    setMetricsLoaded(0);
    setMetricsTotal(0);
    setTagFilters([]);

    try {
      const res = await fetch(`/api/on24/events?startDate=${start}&endDate=${end}`, {
        signal: abort.signal,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to fetch events');
      }
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Unknown error');

      const all: WebinarSummary[] = result.data?.webinars || [];
      setWebinars(all);
      setProgress(`${all.length} event${all.length !== 1 ? 's' : ''} loaded`);

      // Auto-exclude non-webinar types
      const toExclude = new Set<string>();
      for (const w of all) {
        const t = (w.eventType || '').toLowerCase();
        if (!WEBINAR_TYPES.has(t)) toExclude.add(w.eventType || '(unknown)');
      }
      setExcludedEventTypes(toExclude);

      // Kick off attendee metrics + CTA counts in parallel
      if (all.length > 0 && !abort.signal.aborted) {
        loadAttendeeMetrics(all, abort.signal);
        loadCtaCounts(all, abort.signal);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Network error');
      setProgress('');
    } finally {
      if (!abort.signal.aborted) setLoading(false);
    }
  };

  // ── Load attendee metrics progressively ─────────────────────────────────────

  const loadAttendeeMetrics = async (webinarList: WebinarSummary[], parentSignal: AbortSignal) => {
    metricsAbortRef.current?.abort();
    const abort = new AbortController();
    metricsAbortRef.current = abort;

    parentSignal.addEventListener('abort', () => abort.abort());

    const ids = webinarList.map(w => w.eventId);
    setMetricsTotal(ids.length);
    setMetricsLoaded(0);

    let loaded = 0;
    for (let i = 0; i < ids.length; i += METRICS_BATCH_SIZE) {
      if (abort.signal.aborted) break;
      const batch = ids.slice(i, i + METRICS_BATCH_SIZE);
      try {
        const res = await fetch('/api/on24/attendee-metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventIds: batch }),
          signal: abort.signal,
        });
        if (res.ok) {
          const { metrics } = await res.json() as { metrics: Record<string, AttendeeMetrics> };
          setAttendeeMetricsMap(prev => {
            const next = new Map(prev);
            for (const [id, m] of Object.entries(metrics)) next.set(Number(id), m);
            return next;
          });
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') break;
      }
      loaded += batch.length;
      setMetricsLoaded(Math.min(loaded, ids.length));
    }
  };

  // ── Load CTA counts progressively ───────────────────────────────────────────

  const loadCtaCounts = async (webinarList: WebinarSummary[], parentSignal: AbortSignal) => {
    ctaAbortRef.current?.abort();
    const abort = new AbortController();
    ctaAbortRef.current = abort;

    parentSignal.addEventListener('abort', () => abort.abort());

    const ids = webinarList.map(w => w.eventId);

    for (let i = 0; i < ids.length; i += METRICS_BATCH_SIZE) {
      if (abort.signal.aborted) break;
      const batch = ids.slice(i, i + METRICS_BATCH_SIZE);
      try {
        const res = await fetch('/api/on24/cta-counts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventIds: batch }),
          signal: abort.signal,
        });
        if (res.ok) {
          const { counts } = await res.json() as { counts: Record<string, number> };
          setCtaCountsMap(prev => {
            const next = new Map(prev);
            for (const [id, n] of Object.entries(counts)) next.set(Number(id), n);
            return next;
          });
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') break;
      }
    }
  };

  // Fetch on mount and whenever the user applies a new date range from the global filter
  useEffect(() => {
    fetchEvents(startDate, endDate);
    return () => {
      fetchAbortRef.current?.abort();
      metricsAbortRef.current?.abort();
      ctaAbortRef.current?.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterVersion]);

  // ── Derived data ────────────────────────────────────────────────────────────

  const webinarsWithMetrics = useMemo(() =>
    webinars.map(w => ({ ...w, attendeeMetrics: attendeeMetricsMap.get(w.eventId) })),
    [webinars, attendeeMetricsMap]
  );

  // Sync enriched data to store so the Insights tab can read it
  useEffect(() => {
    if (webinarsWithMetrics.length > 0) setLiveWebinars(webinarsWithMetrics);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webinarsWithMetrics]);

  useEffect(() => {
    if (ctaCountsMap.size > 0) setLiveCtaCounts(Object.fromEntries(ctaCountsMap));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctaCountsMap]);

  const nonWebinarTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of webinars) {
      const t = w.eventType || '(unknown)';
      if (!WEBINAR_TYPES.has(t.toLowerCase())) counts.set(t, (counts.get(t) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [webinars]);

  const testCount = useMemo(() => webinars.filter(w => w.isTest).length, [webinars]);
  const missingCampaignCount = useMemo(() => webinars.filter(w => !w.hasCampaignCode).length, [webinars]);

  const filteredWebinars = useMemo(() => webinarsWithMetrics.filter(w => {
    if (!showTests && w.isTest) return false;
    if (excludedEventTypes.has(w.eventType || '(unknown)')) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!w.webinarName?.toLowerCase().includes(q) &&
          !w.campaignName?.toLowerCase().includes(q) &&
          !w.eventId.toString().includes(q)) return false;
    }
    if (missingCampaignOnly && w.hasCampaignCode) return false;
    if (tagFilters.length > 0) {
      if (!w.tags) return false;
      for (const tag of tagFilters) if (!w.tags.includes(tag)) return false;
    }
    return true;
  }), [webinarsWithMetrics, showTests, excludedEventTypes, searchQuery, missingCampaignOnly, tagFilters]);

  const metricsLoading = metricsLoaded < metricsTotal;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const toggleExcludedType = (type: string) => {
    setExcludedEventTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const toggleTagFilter = (tag: string) =>
    setTagFilters(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  // Lazy-load rich event detail when a row is expanded
  const handleExpandRow = async (eventId: number) => {
    if (detailsMap.has(eventId)) return; // already loading or loaded
    setDetailsMap(prev => new Map(prev).set(eventId, 'loading'));
    try {
      const res = await fetch('/api/on24/export-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds: [eventId] }),
      });
      if (res.ok) {
        const { data } = await res.json();
        const event = data?.[0];
        setDetailsMap(prev => new Map(prev).set(eventId, {
          pollDetails: event?.polls || [],
          surveyDetails: event?.surveys || [],
          resourceDetails: event?.resources || [],
          ctaDetails: event?.ctas || [],
          partnerRefStats: event?.partnerRefStats || [],
        }));
      } else {
        setDetailsMap(prev => { const next = new Map(prev); next.delete(eventId); return next; });
      }
    } catch {
      setDetailsMap(prev => { const next = new Map(prev); next.delete(eventId); return next; });
    }
  };

  const handleExportImage = async (eventId: number, eventName: string) => {
    const el = document.getElementById(`event-details-${eventId}`);
    if (!el) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2 });
      const slug = eventName.slice(0, 40).replace(/[^a-zA-Z0-9]+/g, '-').replace(/-$/, '');
      const link = document.createElement('a');
      link.download = `event-${eventId}-${slug}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to export image:', err);
    }
  };

  const handlePrintEvent = (eventId: number) => {
    const el = document.getElementById(`event-details-${eventId}`);
    if (!el) return;
    el.setAttribute('data-print-target', 'true');
    const style = document.createElement('style');
    style.id = 'print-event-style';
    style.textContent = `
      @media print {
        body * { visibility: hidden !important; }
        [data-print-target="true"],
        [data-print-target="true"] * { visibility: visible !important; }
        [data-print-target="true"] {
          position: absolute; left: 0; top: 0; width: 100%;
          border: none !important; margin: 0 !important; padding: 16px !important;
        }
      }
    `;
    document.head.appendChild(style);
    window.print();
    el.removeAttribute('data-print-target');
    style.remove();
  };

  const handleExportCSV = () => {
    if (filteredWebinars.length === 0) return;
    const headers = [
      'Date', 'Event ID', 'Name', 'Campaign', 'Type', 'Duration (min)',
      'Registrants', 'Attendees', 'No-Shows', 'Att Rate %',
      'Live Attendees', 'On-Demand Attendees',
      'Total Live Min', 'Total Archive Min', 'Total Min',
      'Avg Live Min', 'Avg Archive Min', 'Avg Engagement',
      'Q&A', 'Polls', 'Surveys', 'Downloads', 'Tags',
    ];
    const rows = filteredWebinars.map(w => {
      const am = w.attendeeMetrics;
      const ea = w.eventAnalytics;
      const reg = ea?.totalRegistrants ?? w.totalRegistrations;
      const att = am?.loaded ? am.attendeeCount : (ea?.totalAttendees ?? w.totalAttendees);
      const attRate = reg > 0 ? ((att / reg) * 100).toFixed(1) : '';
      return [
        escapeCSV(formatDate(w.startDateTime)),
        String(w.eventId),
        escapeCSV(w.webinarName || ''),
        escapeCSV(w.hasCampaignCode ? (w.campaignName || '') : ''),
        escapeCSV(w.eventType || ''),
        w.duration != null ? String(w.duration) : '',
        String(reg),
        String(att),
        ea?.noShowCount != null ? String(ea.noShowCount) : '',
        attRate,
        am?.loaded ? String(am.liveViewerCount) : '',
        am?.loaded ? String(am.archiveViewerCount) : '',
        am?.loaded ? am.totalLiveMinutes.toFixed(0) : (ea?.totalCumulativeLiveMinutes != null ? String(ea.totalCumulativeLiveMinutes) : ''),
        am?.loaded ? am.totalArchiveMinutes.toFixed(0) : (ea?.totalCumulativeArchiveMinutes != null ? String(ea.totalCumulativeArchiveMinutes) : ''),
        am?.loaded ? am.totalViewingMinutes.toFixed(0) : '',
        am?.loaded ? am.avgLiveMinutes.toFixed(1) : '',
        am?.loaded ? am.avgArchiveMinutes.toFixed(1) : '',
        am?.loaded ? am.avgEngagementScore.toFixed(1) : '',
        am?.loaded ? String(am.totalQuestionsAsked) : String(w.questionsAsked || 0),
        am?.loaded ? String(am.totalPollsAnswered) : String(w.pollResponses || 0),
        am?.loaded ? String(am.totalSurveysAnswered) : String(w.surveyResponses || 0),
        am?.loaded ? String(am.totalResourcesDownloaded) : String(ea?.uniqueAttendeeResourceDownloads ?? w.resourcesDownloaded ?? 0),
        escapeCSV((w.tags || []).join('; ')),
      ].join(',');
    });
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const dateStr = new Date().toISOString().split('T')[0];
    downloadFile(csv, `dashboard-export-${dateStr}.csv`, 'text/csv;charset=utf-8');
  };

  const handleExportJSON = () => {
    if (filteredWebinars.length === 0) return;
    downloadFile(
      JSON.stringify(filteredWebinars, null, 2),
      `dashboard-export-${new Date().toISOString().split('T')[0]}.json`,
      'application/json',
    );
  };

  // Build EventTable rows
  const tableRows = useMemo(() =>
    filteredWebinars.map(w => toTableRow(
      w,
      detailsMap.get(w.eventId),
      ctaCountsMap.get(w.eventId),
      () => handleExportImage(w.eventId, w.webinarName),
      () => handlePrintEvent(w.eventId),
    )),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [filteredWebinars, detailsMap, ctaCountsMap]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Loading status bar */}
      {(loading || progress || error) && (
        <div className="flex items-center gap-3 px-1">
          {loading && (
            <button
              onClick={() => { fetchAbortRef.current?.abort(); metricsAbortRef.current?.abort(); setLoading(false); }}
              className="px-2.5 py-1 text-xs border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
            >
              Stop
            </button>
          )}
          {loading ? (
            <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 border-2 border-ansell-teal border-t-transparent rounded-full animate-spin" />
              {progress}
            </span>
          ) : progress ? (
            <span className="text-[11px] text-ansell-gray">{progress}</span>
          ) : null}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      )}

      {/* Results table */}
      {webinars.length > 0 && (
        <Card accent="blue">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-4 flex-wrap border-b border-gray-100">
            {/* Left: count + filter chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-ansell-gray">
                {filteredWebinars.length} event{filteredWebinars.length !== 1 ? 's' : ''}
                {filteredWebinars.length !== webinars.length && (
                  <span className="ml-1 text-xs font-normal text-gray-400">
                    (of {webinars.length})
                  </span>
                )}
              </span>

              {/* Type chips */}
              {nonWebinarTypeCounts.map(([type, count]) => {
                const excluded = excludedEventTypes.has(type);
                const c = chipColor(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleExcludedType(type)}
                    className={`px-2.5 py-1 text-xs border transition-colors flex items-center gap-1.5 ${
                      excluded
                        ? `${c.bg} ${c.border} ${c.text}`
                        : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                    }`}
                    title={excluded ? `Click to include ${type}` : `Click to exclude ${type}`}
                  >
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    {excluded ? `${count} ${type} hidden` : `${count} ${type}`}
                  </button>
                );
              })}

              {/* Tests chip */}
              {testCount > 0 && (
                <button
                  onClick={() => setShowTests(!showTests)}
                  className={`px-2.5 py-1 text-xs border transition-colors flex items-center gap-1.5 ${
                    showTests
                      ? 'bg-amber-100 border-amber-300 text-amber-800'
                      : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                  {showTests ? `${testCount} test` : `${testCount} test hidden`}
                </button>
              )}

              {/* Active tag pills */}
              {tagFilters.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTagFilter(tag)}
                  className="px-2.5 py-1 text-xs bg-ansell-teal text-white flex items-center gap-1"
                >
                  {tag}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
            </div>

            {/* Right: search + missing campaign + metrics indicator + exports */}
            <div className="flex items-center gap-2 flex-wrap">
              {missingCampaignCount > 0 && (
                <button
                  onClick={() => setMissingCampaignOnly(!missingCampaignOnly)}
                  className={`px-2.5 py-1 text-xs border transition-colors flex items-center gap-1.5 ${
                    missingCampaignOnly
                      ? 'bg-amber-100 border-amber-300 text-amber-800'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  Missing campaign ({missingCampaignCount})
                </button>
              )}
              <input
                type="text"
                placeholder="Search name, campaign, ID…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-ansell-teal w-56"
              />
              {metricsLoading && (
                <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-ansell-teal animate-pulse" />
                  Loading metrics {metricsLoaded}/{metricsTotal}
                </span>
              )}
              {/* Export buttons */}
              {filteredWebinars.length > 0 && (
                <>
                  <button
                    onClick={handleExportCSV}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                    title="Export table as CSV"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    CSV
                  </button>
                  <button
                    onClick={handleExportJSON}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                    title="Export data as JSON"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    JSON
                  </button>
                </>
              )}
            </div>
          </div>

          <CardContent className="p-0">
            <EventTable
              rows={tableRows}
              onExpand={handleExpandRow}
              activeTagFilters={tagFilters}
              onTagToggle={toggleTagFilter}
              emptyMessage={searchQuery || missingCampaignOnly || tagFilters.length > 0
                ? 'No events match your filters'
                : 'No events found for this date range'}
            />
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && webinars.length === 0 && !error && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No events found for this date range.</p>
          <p className="text-sm mt-1">Try a wider range using the presets above.</p>
        </div>
      )}

    </div>
  );
}
