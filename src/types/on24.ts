// On24 API Response Types

export interface On24Event {
  eventid: number;
  eventtype: string;
  title: string;
  description: string;
  eventStartDate: string;
  eventEndDate: string;
  timezone: string;
  status: string;
  registrationUrl: string;
  audienceUrl: string;
  campaignCode?: string;
  customFields?: Record<string, string>;
}

export interface On24Registrant {
  registrantid: number;
  email: string;
  firstname: string;
  lastname: string;
  company: string;
  createtimestamp: string;
  partnerref?: string;
  customFields?: Record<string, string>;
}

export interface On24Attendee extends On24Registrant {
  attendeeid: number;
  engagementScore: number;
  liveDuration: number;
  ondemandDuration: number;
  totalDuration: number;
  firstViewDate: string;
  lastViewDate: string;
}

export interface On24EventAnalytics {
  eventid: number;
  totalRegistrations: number;
  totalAttendees: number;
  averageEngagementScore: number;
  averageViewDuration: number;
  peakConcurrentViewers: number;
  pollParticipationRate: number;
  surveyCompletionRate: number;
  resourceDownloads: number;
  ctaClicks: number;
  questionsAsked: number;
}

export interface On24PollResponse {
  pollid: number;
  pollQuestion: string;
  attendeeEmail: string;
  response: string;
  responseTimestamp: string;
}

export interface On24SurveyResponse {
  surveyid: number;
  surveyQuestion: string;
  attendeeEmail: string;
  response: string;
  responseTimestamp: string;
}

export interface On24Question {
  questionid: number;
  attendeeEmail: string;
  questionText: string;
  timestamp: string;
  answered: boolean;
}

export interface On24ResourceDownload {
  resourceid: number;
  resourceName: string;
  attendeeEmail: string;
  downloadTimestamp: string;
}

export interface On24CTAClick {
  ctaid: number;
  ctaName: string;
  ctaType: string;
  attendeeEmail: string;
  clickTimestamp: string;
}

export interface On24ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}
