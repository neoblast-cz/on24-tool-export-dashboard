import { NextRequest, NextResponse } from 'next/server';
import { getOn24Client } from '@/lib/on24/client';
import { generateCSV } from '@/lib/csv/generator';
import { WebinarSummary } from '@/types/webinar';
import { calculatePerformanceRating } from '@/lib/analytics/recommendations';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventIds, preview, selectedColumns }: { eventIds: number[]; preview?: boolean; selectedColumns?: string[] } = body;

    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'eventIds array is required' },
        { status: 400 }
      );
    }

    const client = getOn24Client();

    // Fetch all event data in parallel
    const results = await Promise.allSettled(
      eventIds.map(async (eventId) => {
        const data = await client.getFullEventData(eventId);
        return { eventId, data };
      })
    );

    // Process results and transform to export format
    const exportData: WebinarSummary[] = [];
    const errors: { eventId: number; error: string }[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { eventId, data } = result.value;
        try {
          // Get campaign code from event (try multiple field names)
          const customFields = data.event.customFields as Record<string, string> | undefined;
          const campaignNameRaw =
            data.event.campaignCode ||
            data.event.campaigncode ||
            customFields?.['Campaign Code'] ||
            customFields?.['campaignCode'] ||
            '';
          const campaignName = typeof campaignNameRaw === 'string' ? campaignNameRaw : '';

          // Get webinar name (try multiple field names)
          const webinarNameRaw = data.event.title ||
            data.event.eventtitle ||
            data.event.eventname ||
            data.event.description ||
            `Event ${eventId}`;
          const webinarName = typeof webinarNameRaw === 'string' ? webinarNameRaw : `Event ${eventId}`;

          // Get start date (try multiple field names)
          const startDateRawValue = data.event.eventStartDate ||
            data.event.eventstartdate ||
            data.event.startdate ||
            data.event.localstarttime ||
            null;
          const startDateRaw = typeof startDateRawValue === 'string' ? startDateRawValue : null;

          // Calculate engagement score
          const getAttendeeEngagement = (a: typeof data.attendees[0]) => {
            return a.engagementScore ?? a.engagementscore ?? a.engagement ?? 0;
          };
          const avgEngagementFromAttendees =
            data.attendees.length > 0
              ? data.attendees.reduce((sum, a) => sum + getAttendeeEngagement(a), 0) /
                data.attendees.length
              : 0;
          const engagementScore =
            data.analytics.averageEngagementScore || avgEngagementFromAttendees;

          // Calculate contact CTA clicks
          const contactCTAs = data.cta.filter(
            (c) => c.actiontype === 'contact' || c.ctaname.toLowerCase().includes('contact')
          );

          // Unique poll questions
          const uniquePollQuestions = new Set(data.polls.map((p) => p.pollQuestion)).size;

          // Format date safely
          const formattedDate = startDateRaw
            ? new Date(startDateRaw).toLocaleDateString('en-US')
            : 'No date';

          // Detect test webinars
          const isTest = /test|demo|trial/i.test(webinarName)
            || /do not use/i.test(webinarName)
            || /can be deleted/i.test(webinarName);
          const hasCampaignCode = Boolean(campaignName && campaignName.trim() !== '');

          exportData.push({
            eventId,
            campaignName,
            webinarName,
            date: formattedDate,
            startDateTime: startDateRaw || new Date().toISOString(),
            totalRegistrations: data.registrants.length,
            totalAttendees: data.attendees.length,
            avgMinutesViewed: data.analytics.averageViewDuration || 0,
            engagementScore,
            surveyResponses: data.surveys.length,
            questionsAsked: data.analytics.questionsAsked || 0,
            resourcesDownloaded: data.resources.length,
            uniqueUsers: data.attendees.length,
            newUsers: 0,
            ctaContactRequests: contactCTAs.length,
            pollQuestions: uniquePollQuestions,
            pollResponses: data.polls.length,
            performanceRating: calculatePerformanceRating(engagementScore),
            recommendations: [],
            isTest,
            hasCampaignCode,
          });
        } catch (transformError) {
          errors.push({
            eventId,
            error: transformError instanceof Error ? transformError.message : 'Transform error',
          });
        }
      } else {
        const eventId = eventIds[results.indexOf(result)];
        errors.push({
          eventId,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        });
      }
    }

    // If preview mode, return JSON data
    if (preview) {
      return NextResponse.json({
        success: true,
        data: exportData,
        errors: errors.length > 0 ? errors : undefined,
        count: exportData.length,
      });
    }

    // Generate CSV with selected columns
    const csv = generateCSV(exportData, selectedColumns);

    // Return as downloadable file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="on24-export-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error generating export:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate export',
      },
      { status: 500 }
    );
  }
}
