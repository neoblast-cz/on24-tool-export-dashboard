import { NextRequest, NextResponse } from 'next/server';
import { getOn24Client } from '@/lib/on24/client';
import { WebinarSummary, Speaker } from '@/types/webinar';
import { On24Event } from '@/types/on24';
import { calculatePerformanceRating } from '@/lib/analytics/recommendations';

// Helper to generate date range batches (max 180 days each for On24 API)
function generateDateBatches(startDateStr: string, endDateStr: string): { start: string; end: string }[] {
  const batches: { start: string; end: string }[] = [];
  let currentEnd = new Date(endDateStr);

  while (currentEnd > new Date(startDateStr)) {
    const batchStart = new Date(currentEnd);
    batchStart.setDate(batchStart.getDate() - 179); // 180 days max

    const actualStart = batchStart < new Date(startDateStr)
      ? new Date(startDateStr)
      : batchStart;

    batches.push({
      start: actualStart.toISOString().split('T')[0],
      end: currentEnd.toISOString().split('T')[0],
    });

    // Move to next batch (1 day before current start)
    currentEnd = new Date(actualStart);
    currentEnd.setDate(currentEnd.getDate() - 1);
  }

  return batches;
}

// Convert event to WebinarSummary using correct field names from On24 API
function eventToWebinarSummary(event: On24Event): WebinarSummary {
  // Get webinar name - description is often the actual title
  const webinarName = event.description || `Event ${event.eventid}`;

  // Get date from livestart (primary date field from API)
  const startDateTime = event.livestart || '';
  const endDateTime = event.liveend || '';

  // Format date for display
  let formattedDate = 'No date';
  if (startDateTime) {
    try {
      const parsed = new Date(startDateTime);
      if (!isNaN(parsed.getTime())) {
        formattedDate = parsed.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }
    } catch {
      formattedDate = 'Invalid date';
    }
  }

  // Get campaign code
  const campaignName = event.campaigncode || '';
  const hasCampaignCode = Boolean(campaignName && campaignName.trim() !== '');

  // Get test flag from istestevent
  const isTest = event.istestevent === true;

  // Get tags (already an array in API response)
  const tags: string[] = Array.isArray(event.tags) ? event.tags : [];

  // Get speakers
  const speakers: Speaker[] = Array.isArray(event.speakers)
    ? event.speakers.map(s => ({
        name: s.name,
        title: s.title,
        company: s.company,
        description: s.description,
      }))
    : [];

  // Get embedded analytics
  const analytics = event.eventanalytics;
  const totalRegistrations = analytics?.totalregistrants || 0;
  const totalAttendees = analytics?.totalattendees || 0;
  const avgMinutesViewed = analytics?.averagearchiveminutes || 0;
  const resourcesDownloaded = analytics?.uniqueattendeeresourcedownloads || 0;

  // Calculate simple engagement score based on attendance rate
  const attendanceRate = totalRegistrations > 0
    ? (totalAttendees / totalRegistrations) * 100
    : 0;
  const engagementScore = Math.min(10, attendanceRate / 10); // Simple approximation

  return {
    eventId: event.eventid,
    campaignName,
    webinarName,
    date: formattedDate,
    startDateTime,
    endDateTime,
    totalRegistrations,
    totalAttendees,
    avgMinutesViewed,
    engagementScore,
    surveyResponses: 0,
    questionsAsked: 0,
    resourcesDownloaded,
    uniqueUsers: totalAttendees,
    newUsers: 0,
    ctaContactRequests: 0,
    pollQuestions: 0,
    pollResponses: 0,
    performanceRating: calculatePerformanceRating(engagementScore),
    recommendations: [],
    isTest,
    hasCampaignCode,
    // Expanded details
    description: event.description || '',
    promotionalSummary: event.promotionalsummary || '',
    tags,
    language: event.localelanguagecd || 'en',
    duration: event.scheduledeventduration || 0,
    eventType: event.eventtype || 'Unknown',
    category: event.category || '',
    timezone: event.displaytimezonecd || '',
    status: event.isactive ? 'Active' : 'Inactive',
    speakers,
    audienceUrl: event.audienceurl || '',
    reportUrl: event.reporturl || '',
    funnelStages: Array.isArray(event.funnelstages) ? event.funnelstages : [],
    // Pass through full analytics from API
    eventAnalytics: analytics ? {
      totalRegistrants: analytics.totalregistrants,
      totalAttendees: analytics.totalattendees,
      noShowCount: analytics.noshowcount,
      registrationPageHits: analytics.registrationpagehits,
      numberOfGetPricingRequests: analytics.numberofgetpricingrequests,
      numberOfFreeTrialRequests: analytics.numberoffreetrialrequests,
      numberOfResourcesAvailable: analytics.numberofresourcesavailable,
      attendeesWhoDownloadedResource: analytics.attendeeswhodownloadedresource,
      uniqueAttendeeResourceDownloads: analytics.uniqueattendeeresourcedownloads,
      numberOfMeetingConversions: analytics.numberofmeetingconversions,
      numberOfDemoConversions: analytics.numberofdemoconversions,
      averageArchiveMinutes: analytics.averagearchiveminutes,
      averageCumulativeArchiveMinutes: analytics.averagecumulativearchiveminutes,
      totalCumulativeLiveMinutes: analytics.totalcumulativeliveminutes,
      totalCumulativeArchiveMinutes: analytics.totalcumulativearchiveminutes,
      totalCumulativeMinutes: analytics.totalcumulativeminutes,
      totalMediaPlayerMinutes: analytics.totalmediaplayerminutes,
      totalLiveMediaPlayerMinutes: analytics.totallivemediaplayerminutes,
      totalArchiveMediaPlayerMinutes: analytics.totalarchivemediaplayerminutes,
    } : undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const status = searchParams.get('status') as 'live' | 'ondemand' | 'upcoming' | undefined;

    const client = getOn24Client();

    // Fetch events in batches if date range > 180 days
    let events: On24Event[] = [];

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > 180) {
        // Fetch in batches
        const batches = generateDateBatches(startDate, endDate);
        console.log(`Fetching events in ${batches.length} batches (${daysDiff} days total)`);

        for (const batch of batches) {
          console.log(`Fetching batch: ${batch.start} to ${batch.end}`);
          try {
            const batchEvents = await client.listEvents({
              startDate: batch.start,
              endDate: batch.end,
              status
            });
            events = events.concat(batchEvents);
          } catch (batchError) {
            console.error(`Error fetching batch ${batch.start}-${batch.end}:`, batchError);
            // Continue with other batches
          }
        }

        // Remove duplicates by eventid
        const seenIds = new Set<number>();
        events = events.filter(e => {
          if (seenIds.has(e.eventid)) return false;
          seenIds.add(e.eventid);
          return true;
        });

        console.log(`Total unique events fetched: ${events.length}`);
      } else {
        events = await client.listEvents({ startDate, endDate, status });
      }
    } else {
      events = await client.listEvents({ startDate, endDate, status });
    }

    // Log first event to debug field names
    if (events.length > 0) {
      const sampleEvent = events[0] as Record<string, unknown>;
      console.log('=== ON24 API DEBUG ===');
      console.log('All field names:', Object.keys(sampleEvent));
      console.log('livestart:', sampleEvent.livestart);
      console.log('eventanalytics:', sampleEvent.eventanalytics);
      console.log('istestevent:', sampleEvent.istestevent);
      console.log('=== END DEBUG ===');
    }

    // Convert to webinar summaries
    const webinars: WebinarSummary[] = events.map(eventToWebinarSummary);

    // Calculate overall stats
    const totalRegs = webinars.reduce((sum, w) => sum + w.totalRegistrations, 0);
    const totalAtts = webinars.reduce((sum, w) => sum + w.totalAttendees, 0);
    const avgAttendanceRate = totalRegs > 0 ? (totalAtts / totalRegs) * 100 : 0;
    const avgEngagement = webinars.length > 0
      ? webinars.reduce((sum, w) => sum + w.engagementScore, 0) / webinars.length
      : 0;

    const overallStats = {
      totalWebinars: webinars.length,
      avgEngagementScore: avgEngagement,
      avgAttendanceRate,
      topPerformer: webinars.length > 0
        ? [...webinars].sort((a, b) => b.engagementScore - a.engagementScore)[0]?.webinarName || 'N/A'
        : 'N/A',
      bottomPerformer: webinars.length > 0
        ? [...webinars].sort((a, b) => a.engagementScore - b.engagementScore)[0]?.webinarName || 'N/A'
        : 'N/A',
    };

    return NextResponse.json({
      success: true,
      data: {
        lastUpdated: new Date().toISOString(),
        webinars,
        overallStats,
      },
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch events',
      },
      { status: 500 }
    );
  }
}
