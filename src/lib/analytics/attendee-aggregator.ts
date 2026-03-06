import { On24Attendee } from '@/types/on24';
import { AttendeeMetrics } from '@/types/webinar';

// Safely extract a numeric field value, trying multiple field name variants
function getNumericField(attendee: On24Attendee, ...fieldNames: string[]): number {
  for (const name of fieldNames) {
    const val = attendee[name];
    if (typeof val === 'number' && !isNaN(val)) return val;
  }
  return 0;
}

const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
const avg = (arr: number[]) => arr.length > 0 ? sum(arr) / arr.length : 0;

const EMPTY_METRICS: AttendeeMetrics = {
  loaded: true,
  attendeeCount: 0,
  liveViewerCount: 0,
  archiveViewerCount: 0,
  avgEngagementScore: 0,
  totalLiveMinutes: 0,
  avgLiveMinutes: 0,
  totalArchiveMinutes: 0,
  avgArchiveMinutes: 0,
  totalViewingMinutes: 0,
  avgViewingMinutes: 0,
  totalQuestionsAsked: 0,
  totalResourcesDownloaded: 0,
  totalPollsAnswered: 0,
  totalSurveysAnswered: 0,
};

/**
 * Aggregates attendee-level data into event-level metrics.
 * Returns ONLY numeric aggregates - zero PII.
 */
export function aggregateAttendeeMetrics(attendees: On24Attendee[]): AttendeeMetrics {
  if (attendees.length === 0) {
    return { ...EMPTY_METRICS };
  }

  const engagementScores = attendees.map(a =>
    getNumericField(a, 'engagementscore', 'engagementScore', 'engagement')
  );
  const liveMinutes = attendees.map(a =>
    getNumericField(a, 'liveminutes', 'livemediaplayerminutes', 'liveduration', 'liveDuration', 'liveviewedduration', 'cumulativeliveminutes')
  );
  const archiveMinutes = attendees.map(a =>
    getNumericField(a, 'archiveminutes', 'archivemediaplayerminutes', 'ondemandduration', 'ondemandDuration', 'ondemandviewedduration', 'cumulativearchiveminutes')
  );

  const totalLive = sum(liveMinutes);
  const totalArchive = sum(archiveMinutes);

  return {
    loaded: true,
    attendeeCount: attendees.length,
    liveViewerCount: liveMinutes.filter(m => m > 0).length,
    archiveViewerCount: archiveMinutes.filter(m => m > 0).length,
    avgEngagementScore: Math.round(avg(engagementScores) * 10) / 10,
    totalLiveMinutes: totalLive,
    avgLiveMinutes: Math.round(avg(liveMinutes) * 10) / 10,
    totalArchiveMinutes: totalArchive,
    avgArchiveMinutes: Math.round(avg(archiveMinutes) * 10) / 10,
    totalViewingMinutes: totalLive + totalArchive,
    avgViewingMinutes: Math.round(((totalLive + totalArchive) / attendees.length) * 10) / 10,
    totalQuestionsAsked: sum(attendees.map(a => getNumericField(a, 'askedquestions'))),
    totalResourcesDownloaded: sum(attendees.map(a => getNumericField(a, 'resourcesdownloaded'))),
    totalPollsAnswered: sum(attendees.map(a => getNumericField(a, 'answeredpolls'))),
    totalSurveysAnswered: sum(attendees.map(a => getNumericField(a, 'answeredsurveys'))),
    totalReactions: sum(attendees.map(a => Array.isArray(a.reactions) ? a.reactions.length : 0)),
    reactionsByType: (() => {
      const byType: Record<string, number> = {};
      for (const a of attendees) {
        if (Array.isArray(a.reactions)) {
          for (const r of a.reactions) {
            if (r.type) byType[r.type] = (byType[r.type] || 0) + 1;
          }
        }
      }
      return byType;
    })(),
    resourceBreakdown: (() => {
      const byName: Record<string, number> = {};
      for (const a of attendees) {
        if (Array.isArray(a.resources)) {
          for (const r of a.resources) {
            if (r.resourceviewed) byName[r.resourceviewed] = (byName[r.resourceviewed] || 0) + 1;
          }
        }
      }
      return byName;
    })(),
  };
}

export function createErrorMetrics(error: string): AttendeeMetrics {
  return { ...EMPTY_METRICS, error };
}
