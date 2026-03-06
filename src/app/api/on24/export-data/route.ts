import { NextRequest, NextResponse } from 'next/server';
import { getOn24Client } from '@/lib/on24/client';
import { aggregateAttendeeMetrics } from '@/lib/analytics/attendee-aggregator';
import { On24Event, On24Attendee, On24Registrant } from '@/types/on24';

const MAX_CONCURRENT = 3;
const DELAY_MS = 300;

interface PollAnswerDetail {
  answer: string;
  percentage: number;
}

interface PollDetail {
  question: string;
  totalVotes: number;
  type: string;
  answers: PollAnswerDetail[];
}

interface SurveyQuestionDetail {
  question: string;
  responses: number;
  type: string;
  answers: PollAnswerDetail[];
}

interface ResourceDetail {
  name: string;
  uniqueDownloads: number;
  totalDownloads: number;
}

interface CTADetail {
  name: string;
  actionType: string;
  totalClicks: number;
  uniqueClicks: number;
}

interface PartnerRefStat {
  code: string;
  registrants: number;
  attendees: number;
}

export interface ExportEventData {
  eventId: number;
  date: string;
  webinarName: string;
  campaignCode: string;
  // Event details
  eventDuration: number;
  language: string;
  eventType: string;
  category: string;
  // Counts
  registrants: number;
  attendees: number;
  liveAttendees: number;
  ondemandAttendees: number;
  noShows: number;
  // Viewing
  totalLiveMinutes: number;
  totalArchiveMinutes: number;
  totalMinutes: number;
  avgLiveMinutes: number;
  avgArchiveMinutes: number;
  // Engagement
  avgEngagementScore: number;
  eventEngagementScore: number;
  // Interactions (from embedded analytics)
  questionsAsked: number;
  questionsAnswered: number;
  pollsPushed: number;
  pollResponses: number;
  surveysPresentedCount: number;
  surveyResponseCount: number;
  ctaClicks: number;
  resourcesAvailable: number;
  resourcesDownloaded: number;
  uniqueResourceDownloads: number;
  // Poll details
  polls: PollDetail[];
  // Survey details
  surveys: SurveyQuestionDetail[];
  // Resource download details (from /resource endpoint)
  resources: ResourceDetail[];
  // CTA details (from /cta endpoint)
  ctas: CTADetail[];
  // Registration sources
  partnerRefStats: PartnerRefStat[];
  // Tags
  tags: string[];
  // Speakers
  speakers: { name: string; title?: string; company?: string }[];
  // Links
  audienceUrl: string;
  reportUrl: string;
  // Content
  promotionalSummary?: string;
  // Flags
  isTest: boolean;
  // Error
  error?: string;
}

// Process items with concurrency limit
async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      if (DELAY_MS > 0 && currentIndex > 0) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
      await fn(item);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
}

function buildExportData(
  event: On24Event,
  metrics: ReturnType<typeof aggregateAttendeeMetrics> | null,
  rawPolls: unknown[],
  rawSurveys: unknown[],
  rawResources: unknown[],
  rawCTAs: unknown[],
  registrants: On24Registrant[],
  attendees: On24Attendee[],
  fallbackCampaignCode?: string,
): ExportEventData {
  const ea = event.eventanalytics as Record<string, unknown> | undefined;

  // Parse polls from the aggregate endpoint
  const polls: PollDetail[] = rawPolls.map((p: unknown) => {
    const poll = p as Record<string, unknown>;
    const summary = Array.isArray(poll.summary) ? poll.summary : [];
    return {
      question: (poll.pollquestion as string) || 'Unknown',
      totalVotes: (poll.totalvotes as number) || 0,
      type: (poll.polltype as string) || 'unknown',
      answers: summary.map((a: Record<string, unknown>) => ({
        answer: (a.answer as string) || '',
        percentage: (a.percentage as number) || 0,
      })),
    };
  });

  // Parse surveys from the aggregate endpoint
  const surveys: SurveyQuestionDetail[] = [];
  for (const s of rawSurveys) {
    const survey = s as Record<string, unknown>;
    const surveyQuestions = Array.isArray(survey.surveyquestions) ? survey.surveyquestions : [];
    for (const q of surveyQuestions) {
      const sq = q as Record<string, unknown>;
      const answers = Array.isArray(sq.surveyanswer) ? sq.surveyanswer : [];
      surveys.push({
        question: (sq.question as string) || 'Unknown',
        responses: (sq.responses as number) || 0,
        type: (sq.questiontype as string) || 'unknown',
        answers: answers.map((a: Record<string, unknown>) => ({
          answer: (a.answer as string) || '',
          percentage: (a.percentage as number) || 0,
        })),
      });
    }
  }

  // Parse resources from /resource endpoint
  // API returns: {resourceid, resourcename, uniquedownloads, totaldownloads}
  const resources: ResourceDetail[] = rawResources.map((r: unknown) => {
    const item = r as Record<string, unknown>;
    return {
      name: (item.resourcename as string) || `Resource ${item.resourceid || ''}`,
      uniqueDownloads: (item.uniquedownloads as number) || 0,
      totalDownloads: (item.totaldownloads as number) || 0,
    };
  }).sort((a, b) => b.totalDownloads - a.totalDownloads);

  // Parse CTAs from /cta endpoint
  // API returns: {ctaid, ctaname, actiontype, action, totalclicks, uniqueclicks}
  const ctas: CTADetail[] = rawCTAs.map((c: unknown) => {
    const item = c as Record<string, unknown>;
    return {
      name: (item.ctaname as string) || `CTA ${item.ctaid || ''}`,
      actionType: (item.actiontype as string) || '',
      totalClicks: (item.totalclicks as number) || 0,
      uniqueClicks: (item.uniqueclicks as number) || 0,
    };
  }).sort((a, b) => b.totalClicks - a.totalClicks);

  // Registration sources: count actual registrants and attendees per partnerref
  const attendeeEmails = new Set(attendees.map(a => (a.email || '').toLowerCase()).filter(Boolean));
  const sourceMap = new Map<string, { registrants: number; attendees: number }>();
  for (const reg of registrants) {
    const code = reg.partnerref || '(direct)';
    const entry = sourceMap.get(code) || { registrants: 0, attendees: 0 };
    entry.registrants++;
    if (reg.email && attendeeEmails.has(reg.email.toLowerCase())) {
      entry.attendees++;
    }
    sourceMap.set(code, entry);
  }
  const partnerRefStats: PartnerRefStat[] = Array.from(sourceMap.entries())
    .map(([code, counts]) => ({ code, registrants: counts.registrants, attendees: counts.attendees }))
    .sort((a, b) => b.registrants - a.registrants);

  // Compute total CTA clicks from API data
  const totalCTAClicks = ctas.reduce((s, c) => s + c.totalClicks, 0);
  // Compute total resource downloads from API data
  const totalResourceDL = resources.reduce((s, r) => s + r.totalDownloads, 0);
  const totalUniqueResourceDL = resources.reduce((s, r) => s + r.uniqueDownloads, 0);

  return {
    eventId: event.eventid,
    date: event.livestart || '',
    webinarName: event.description || `Event ${event.eventid}`,
    campaignCode: event.campaigncode
      || (event as Record<string, unknown>).campaignCode as string
      || (event as Record<string, unknown>).campaign_code as string
      || (Array.isArray(event.customeventfields)
        ? (event.customeventfields.find(f =>
            f.name?.toLowerCase() === 'campaigncode' || f.label?.toLowerCase() === 'campaign code'
          )?.value || '')
        : '')
      || fallbackCampaignCode
      || '',
    eventDuration: (event.eventduration as number) || (event as Record<string, unknown>).scheduledeventduration as number || 0,
    language: event.localelanguagecd || '',
    eventType: event.eventtype || '',
    category: event.category || '',
    registrants: (ea?.totalregistrants as number) || 0,
    attendees: metrics?.attendeeCount || (ea?.totalattendees as number) || 0,
    liveAttendees: (ea?.liveattendees as number) || 0,
    ondemandAttendees: (ea?.ondemandattendees as number) || 0,
    noShows: (ea?.noshowcount as number) || 0,
    totalLiveMinutes: metrics?.totalLiveMinutes || (ea?.totalcumulativeliveminutes as number) || 0,
    totalArchiveMinutes: metrics?.totalArchiveMinutes || (ea?.totalcumulativearchiveminutes as number) || 0,
    totalMinutes: metrics?.totalViewingMinutes || (ea?.totalcumulativeminutes as number) || 0,
    avgLiveMinutes: metrics?.avgLiveMinutes || (ea?.averagecumulativeliveminutes as number) || (ea?.averageliveminutes as number) || 0,
    avgArchiveMinutes: metrics?.avgArchiveMinutes || (ea?.averagecumulativearchiveminutes as number) || (ea?.averagearchiveminutes as number) || 0,
    avgEngagementScore: metrics?.avgEngagementScore || 0,
    eventEngagementScore: (ea?.eventengagementscore as number) || 0,
    questionsAsked: metrics?.totalQuestionsAsked || (ea?.numberofquestionsasked as number) || 0,
    questionsAnswered: (ea?.numberofquestionsanswered as number) || 0,
    pollsPushed: (ea?.numberofpollspushed as number) || 0,
    pollResponses: (ea?.numberofpollresponses as number) || 0,
    surveysPresentedCount: (ea?.numberofsurveyspresented as number) || 0,
    surveyResponseCount: (ea?.numberofsurveyresponses as number) || 0,
    ctaClicks: totalCTAClicks || (ea?.numberofctaclicks as number) || 0,
    resourcesAvailable: resources.length || (ea?.numberofresourcesavailable as number) || 0,
    resourcesDownloaded: totalResourceDL || metrics?.totalResourcesDownloaded || (ea?.uniqueattendeeresourcedownloads as number) || 0,
    uniqueResourceDownloads: totalUniqueResourceDL || (ea?.uniqueattendeeresourcedownloads as number) || 0,
    polls,
    surveys,
    resources,
    ctas,
    partnerRefStats,
    tags: event.tags || [],
    speakers: Array.isArray(event.speakers)
      ? event.speakers.map(s => ({ name: s.name, title: s.title, company: s.company }))
      : [],
    audienceUrl: event.audienceurl || '',
    reportUrl: event.reporturl || '',
    promotionalSummary: event.promotionalsummary || undefined,
    isTest: event.istestevent === true
      || /do not use/i.test(event.description || '')
      || /can be deleted/i.test(event.description || ''),
  };
}

function createErrorResult(eventId: number, errorMsg: string): ExportEventData {
  return {
    eventId, date: '', webinarName: `Event ${eventId} (failed)`, campaignCode: '',
    eventDuration: 0, language: '', eventType: '', category: '',
    registrants: 0, attendees: 0, liveAttendees: 0, ondemandAttendees: 0, noShows: 0,
    totalLiveMinutes: 0, totalArchiveMinutes: 0, totalMinutes: 0, avgLiveMinutes: 0, avgArchiveMinutes: 0,
    avgEngagementScore: 0, eventEngagementScore: 0,
    questionsAsked: 0, questionsAnswered: 0, pollsPushed: 0, pollResponses: 0,
    surveysPresentedCount: 0, surveyResponseCount: 0, ctaClicks: 0,
    resourcesAvailable: 0, resourcesDownloaded: 0, uniqueResourceDownloads: 0,
    polls: [], surveys: [], resources: [], ctas: [], partnerRefStats: [], tags: [],
    speakers: [], audienceUrl: '', reportUrl: '',
    isTest: false,
    error: errorMsg,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventIds, startDate, endDate, campaignCodes } = body as {
      eventIds?: number[];
      startDate?: string;
      endDate?: string;
      campaignCodes?: Record<number, string>;
    };

    const client = getOn24Client();
    const results: ExportEventData[] = [];
    let events: On24Event[] = [];

    if (eventIds && eventIds.length > 0) {
      await processWithConcurrency(eventIds, MAX_CONCURRENT, async (id) => {
        try {
          const event = await client.getEvent(id);
          events.push(event);
        } catch (err) {
          results.push(createErrorResult(id, err instanceof Error ? err.message : 'Failed to fetch'));
        }
      });
    } else if (startDate && endDate) {
      events = await client.listEvents({ startDate, endDate });
    } else {
      return NextResponse.json(
        { success: false, error: 'Provide eventIds or startDate+endDate' },
        { status: 400 }
      );
    }

    // For each event, fetch registrants + attendees + polls + surveys + resources + CTAs
    await processWithConcurrency(events, MAX_CONCURRENT, async (event) => {
      try {
        const [registrants, attendees, rawPolls, rawSurveys, rawResources, rawCTAs] = await Promise.all([
          client.listRegistrants(event.eventid).catch(() => []),
          client.listAttendees(event.eventid).catch(() => []),
          client.getPollResponses(event.eventid).catch(() => []),
          client.getSurveyResponses(event.eventid).catch(() => []),
          client.getResourceDownloads(event.eventid).catch(() => []),
          client.getCTAClicks(event.eventid).catch(() => []),
        ]);

        console.log(`[export-data] Event ${event.eventid}: ${registrants.length} reg, ${attendees.length} att, ${rawPolls.length} polls, ${rawSurveys.length} surveys, ${rawResources.length} resources, ${rawCTAs.length} ctas`);

        const metrics = aggregateAttendeeMetrics(attendees);
        const fallback = campaignCodes?.[event.eventid] || '';
        results.push(buildExportData(event, metrics, rawPolls as unknown[], rawSurveys as unknown[], rawResources as unknown[], rawCTAs as unknown[], registrants, attendees, fallback));
      } catch (err) {
        // Fall back to event-only data
        const fallback = campaignCodes?.[event.eventid] || '';
        results.push(buildExportData(event, null, [], [], [], [], [], [], fallback));
      }
    });

    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      success: true,
      data: results,
      totalEvents: results.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
