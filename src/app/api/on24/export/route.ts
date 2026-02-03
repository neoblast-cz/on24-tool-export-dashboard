import { NextRequest, NextResponse } from 'next/server';
import { getOn24Client } from '@/lib/on24/client';
import { generateCSV } from '@/lib/csv/generator';
import { WebinarSummary } from '@/types/webinar';
import { calculatePerformanceRating } from '@/lib/analytics/recommendations';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventIds, preview }: { eventIds: number[]; preview?: boolean } = body;

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
          // Get campaign code from event
          const campaignName =
            data.event.campaignCode ||
            data.event.customFields?.['Campaign Code'] ||
            data.event.customFields?.['campaignCode'] ||
            'General';

          // Calculate engagement score
          const avgEngagementFromAttendees =
            data.attendees.length > 0
              ? data.attendees.reduce((sum, a) => sum + (a.engagementScore || 0), 0) /
                data.attendees.length
              : 0;
          const engagementScore =
            data.analytics.averageEngagementScore || avgEngagementFromAttendees;

          // Calculate contact CTA clicks
          const contactCTAs = data.cta.filter(
            (c) => c.ctaType === 'contact' || c.ctaName.toLowerCase().includes('contact')
          );

          // Unique poll questions
          const uniquePollQuestions = new Set(data.polls.map((p) => p.pollQuestion)).size;

          exportData.push({
            eventId,
            campaignName,
            webinarName: data.event.title,
            date: new Date(data.event.eventStartDate).toLocaleDateString('en-US'),
            startDateTime: data.event.eventStartDate,
            totalRegistrations: data.registrants.length,
            totalAttendees: data.attendees.length,
            avgMinutesViewed: data.analytics.averageViewDuration || 0,
            engagementScore,
            surveyResponses: data.surveys.length,
            questionsAsked: data.questions.length,
            resourcesDownloaded: data.resources.length,
            uniqueUsers: data.attendees.length,
            newUsers: 0,
            ctaContactRequests: contactCTAs.length,
            pollQuestions: uniquePollQuestions,
            pollResponses: data.polls.length,
            performanceRating: calculatePerformanceRating(engagementScore),
            recommendations: [],
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

    // Generate CSV
    const csv = generateCSV(exportData);

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
