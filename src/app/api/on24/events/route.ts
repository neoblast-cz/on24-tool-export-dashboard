import { NextRequest, NextResponse } from 'next/server';
import { getOn24Client } from '@/lib/on24/client';
import { WebinarSummary } from '@/types/webinar';
import { generateRecommendations, calculatePerformanceRating } from '@/lib/analytics/recommendations';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const status = searchParams.get('status') as 'live' | 'ondemand' | 'upcoming' | undefined;

    const client = getOn24Client();
    const events = await client.listEvents({ startDate, endDate, status });

    // Enrich events with analytics and transform to WebinarSummary format
    const webinars: WebinarSummary[] = await Promise.all(
      events.map(async (event) => {
        try {
          const [analytics, attendees, polls, surveys, questions, resources, cta] = await Promise.all([
            client.getEventAnalytics(event.eventid),
            client.listAttendees(event.eventid),
            client.getPollResponses(event.eventid),
            client.getSurveyResponses(event.eventid),
            client.getQuestions(event.eventid),
            client.getResourceDownloads(event.eventid),
            client.getCTAClicks(event.eventid),
          ]);

          // Calculate engagement score from attendees if analytics doesn't have it
          const avgEngagementFromAttendees = attendees.length > 0
            ? attendees.reduce((sum, a) => sum + (a.engagementScore || 0), 0) / attendees.length
            : 0;

          const engagementScore = analytics.averageEngagementScore || avgEngagementFromAttendees;

          // Get campaign code from event
          const campaignName = event.campaignCode ||
            event.customFields?.['Campaign Code'] ||
            event.customFields?.['campaignCode'] ||
            'General';

          // Calculate contact CTA clicks
          const contactCTAs = cta.filter(
            (c) => c.ctaType === 'contact' || c.ctaName.toLowerCase().includes('contact')
          );

          // Unique poll questions
          const uniquePollQuestions = new Set(polls.map((p) => p.pollQuestion)).size;

          const webinar: WebinarSummary = {
            eventId: event.eventid,
            campaignName,
            webinarName: event.title,
            date: new Date(event.eventStartDate).toLocaleDateString('en-US'),
            startDateTime: event.eventStartDate,
            totalRegistrations: analytics.totalRegistrations || 0,
            totalAttendees: attendees.length || analytics.totalAttendees || 0,
            avgMinutesViewed: analytics.averageViewDuration || 0,
            engagementScore,
            surveyResponses: surveys.length,
            questionsAsked: questions.length,
            resourcesDownloaded: resources.length,
            uniqueUsers: attendees.length,
            newUsers: 0, // Would need historical data to calculate
            ctaContactRequests: contactCTAs.length,
            pollQuestions: uniquePollQuestions,
            pollResponses: polls.length,
            performanceRating: calculatePerformanceRating(engagementScore),
            recommendations: [],
          };

          webinar.recommendations = generateRecommendations(webinar);
          return webinar;
        } catch (error) {
          console.error(`Error enriching event ${event.eventid}:`, error);
          // Return basic webinar data if enrichment fails
          return {
            eventId: event.eventid,
            campaignName: event.campaignCode || 'General',
            webinarName: event.title,
            date: new Date(event.eventStartDate).toLocaleDateString('en-US'),
            startDateTime: event.eventStartDate,
            totalRegistrations: 0,
            totalAttendees: 0,
            avgMinutesViewed: 0,
            engagementScore: 0,
            surveyResponses: 0,
            questionsAsked: 0,
            resourcesDownloaded: 0,
            uniqueUsers: 0,
            newUsers: 0,
            ctaContactRequests: 0,
            pollQuestions: 0,
            pollResponses: 0,
            performanceRating: 'poor' as const,
            recommendations: ['Unable to fetch detailed analytics for this event.'],
          };
        }
      })
    );

    // Calculate overall stats
    const overallStats = {
      totalWebinars: webinars.length,
      avgEngagementScore: webinars.length > 0
        ? webinars.reduce((sum, w) => sum + w.engagementScore, 0) / webinars.length
        : 0,
      avgAttendanceRate: webinars.length > 0
        ? webinars.reduce(
            (sum, w) =>
              sum + (w.totalRegistrations > 0 ? w.totalAttendees / w.totalRegistrations : 0),
            0
          ) / webinars.length
        : 0,
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
