// Internal Webinar Types

export type PerformanceRating = 'excellent' | 'good' | 'average' | 'poor';

export interface WebinarSummary {
  eventId: number;
  campaignName: string;
  webinarName: string;
  date: string;
  startDateTime: string;
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
