'use client';

import { WebinarSummary } from '@/types/webinar';
import { EventTable, EventTableRow } from '@/components/shared/event-table';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'No date';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Invalid date';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return 'Invalid date'; }
}

// ── Adapter: WebinarSummary → EventTableRow ───────────────────────────────────

function toTableRow(webinar: WebinarSummary): EventTableRow {
  const am = webinar.attendeeMetrics;
  const ea = webinar.eventAnalytics;
  const metricsLoading = !am?.loaded;

  return {
    eventId: webinar.eventId,
    webinarName: webinar.webinarName,
    displayDate: formatDate(webinar.startDateTime),
    startDateTimeRaw: webinar.startDateTime,
    eventType: webinar.eventType || '',
    isTest: webinar.isTest ?? false,
    campaignCode: webinar.hasCampaignCode ? webinar.campaignName : undefined,
    hasCampaignCode: webinar.hasCampaignCode ?? false,
    tags: webinar.tags || [],
    speakers: webinar.speakers || [],
    duration: webinar.duration,
    language: webinar.language,
    category: webinar.category,
    timezone: webinar.timezone,
    registrants: ea?.totalRegistrants ?? webinar.totalRegistrations,
    attendees: am?.loaded ? am.attendeeCount : (ea?.totalAttendees ?? webinar.totalAttendees),
    engagementScore: am?.loaded ? am.avgEngagementScore : webinar.engagementScore,
    qa: am?.loaded ? am.totalQuestionsAsked : (webinar.questionsAsked || 0),
    polls: am?.loaded ? am.totalPollsAnswered : (webinar.pollResponses || 0),
    surveys: am?.loaded ? am.totalSurveysAnswered : (webinar.surveyResponses || 0),
    dl: am?.loaded
      ? am.totalResourcesDownloaded
      : (ea?.uniqueAttendeeResourceDownloads ?? webinar.resourcesDownloaded ?? 0),
    liveAttendees: am?.loaded ? am.liveViewerCount : undefined,
    ondemandAttendees: am?.loaded ? am.archiveViewerCount : undefined,
    noShows: ea?.noShowCount != null ? ea.noShowCount : undefined,
    totalLiveMinutes: am?.loaded ? am.totalLiveMinutes : (ea?.totalCumulativeLiveMinutes ?? undefined),
    totalArchiveMinutes: am?.loaded ? am.totalArchiveMinutes : (ea?.totalCumulativeArchiveMinutes ?? undefined),
    totalMinutes: am?.loaded ? am.totalViewingMinutes : undefined,
    avgLiveMinutes: am?.loaded ? am.avgLiveMinutes : undefined,
    avgArchiveMinutes: am?.loaded ? am.avgArchiveMinutes : undefined,
    avgEngagementScore: am?.loaded ? am.avgEngagementScore : undefined,
    metricsLoading,
    audienceUrl: webinar.audienceUrl,
    reportUrl: webinar.reportUrl,
    expandedNote: metricsLoading
      ? 'Attendee metrics loading — Q&A, polls, survey, download counts will appear shortly'
      : undefined,
  };
}

// ── Main component ─────────────────────────────────────────────────────────────

interface WebinarListProps {
  webinars: WebinarSummary[];
  emptyMessage?: string;
  activeTagFilters?: string[];
  onTagToggle?: (tag: string) => void;
  // legacy props kept for call-site compatibility — ignored
  variant?: string;
  showDetails?: boolean;
  sortable?: boolean;
}

export function WebinarList({
  webinars,
  emptyMessage = 'No webinars to display',
  activeTagFilters = [],
  onTagToggle,
}: WebinarListProps) {
  const rows = webinars.map(toTableRow);

  return (
    <EventTable
      rows={rows}
      activeTagFilters={activeTagFilters}
      onTagToggle={onTagToggle}
      emptyMessage={emptyMessage}
    />
  );
}
