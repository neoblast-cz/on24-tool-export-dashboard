// Internal Webinar Types

export type PerformanceRating = 'excellent' | 'good' | 'average' | 'poor';

// Speaker info
export interface Speaker {
  name: string;
  title?: string;
  company?: string;
  description?: string;
}

export interface WebinarSummary {
  eventId: number;
  campaignName: string;
  webinarName: string;
  date: string;
  startDateTime: string;
  endDateTime?: string;
  totalRegistrations: number;
  totalAttendees: number;
  avgMinutesViewed: number;
  engagementScore: number;
  surveyResponses: number;
  questionsAsked: number;
  resourcesDownloaded: number;
  uniqueUsers: number;
  newUsers: number;
  ctaContactRequests: number;
  pollQuestions: number;
  pollResponses: number;
  performanceRating: PerformanceRating;
  recommendations: string[];
  // Additional fields
  isTest?: boolean;
  hasCampaignCode?: boolean;
  // Expanded details
  description?: string;
  promotionalSummary?: string;
  tags?: string[];
  language?: string;
  duration?: number;
  eventType?: string;
  category?: string;
  timezone?: string;
  status?: string;
  // Speakers
  speakers?: Speaker[];
  // URLs
  audienceUrl?: string;
  reportUrl?: string;
  // Funnel stages
  funnelStages?: string[];
  // Event Analytics (from API)
  eventAnalytics?: {
    totalRegistrants?: number;
    totalAttendees?: number;
    noShowCount?: number;
    registrationPageHits?: number;
    numberOfGetPricingRequests?: number;
    numberOfFreeTrialRequests?: number;
    numberOfResourcesAvailable?: number;
    attendeesWhoDownloadedResource?: number;
    uniqueAttendeeResourceDownloads?: number;
    numberOfMeetingConversions?: number;
    numberOfDemoConversions?: number;
    averageArchiveMinutes?: number;
    averageCumulativeArchiveMinutes?: number;
    totalCumulativeLiveMinutes?: number;
    totalCumulativeArchiveMinutes?: number;
    totalCumulativeMinutes?: number;
    totalMediaPlayerMinutes?: number;
    totalLiveMediaPlayerMinutes?: number;
    totalArchiveMediaPlayerMinutes?: number;
  };
}

export interface DashboardData {
  lastUpdated: string;
  webinars: WebinarSummary[];
  overallStats: OverallStats;
}

export interface OverallStats {
  totalWebinars: number;
  avgEngagementScore: number;
  avgAttendanceRate: number;
  topPerformer: string;
  bottomPerformer: string;
}

export interface CacheMetadata {
  version: string;
  lastFetched: string;
  expiresAt: string;
  eventCount: number;
}

// Export row type for CSV generation
export interface ExportRow {
  date: string;
  campaignName: string;
  webinarName: string;
  totalRegistrations: number;
  totalAttendees: number;
  startDateTime: string;
  avgMinutesViewed: number;
  engagementScore: number;
  surveyResponses: string;
  questionsAsked: string;
  resourcesDownloaded: number;
  users: number;
  newUsers: number;
  ctaContactRequests: string;
  pollQuestions: string;
  pollResponses: number;
}
