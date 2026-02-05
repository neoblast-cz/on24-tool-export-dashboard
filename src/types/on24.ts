// On24 API Response Types

// Speaker info from event
export interface On24Speaker {
  name: string;
  title?: string;
  company?: string;
  description?: string;
}

// Embedded analytics in event response
export interface On24EmbeddedAnalytics {
  totalregistrants?: number;
  totalattendees?: number;
  noshowcount?: number;
  registrationpagehits?: number;
  numberofgetpricingrequests?: number;
  numberoffreetrialrequests?: number;
  numberofresourcesavailable?: number;
  attendeeswhodownloadedresource?: number;
  uniqueattendeeresourcedownloads?: number;
  numberofmeetingconversions?: number;
  numberofdemoconversions?: number;
  averagearchiveminutes?: number;
  averagecumulativearchiveminutes?: number;
  totalcumulativeliveminutes?: number;
  totalcumulativearchiveminutes?: number;
  totalcumulativeminutes?: number;
  totalmediaplayerminutes?: number;
  totallivemediaplayerminutes?: number;
  totalarchivemediaplayerminutes?: number;
}

// Custom event field
export interface On24CustomEventField {
  name: string;
  label: string;
  value: string;
}

export interface On24Event {
  eventid: number;
  clientid?: number;

  // Event info
  description?: string;
  promotionalsummary?: string;
  eventtype?: string;
  category?: string;
  contenttype?: string;
  application?: string;
  eventprofile?: string;
  streamtype?: string;
  eventlocation?: string;
  createdby?: string;

  // Date/time fields (correct field names from API)
  livestart?: string;           // "2017-02-02T03:20:00-08:00" - PRIMARY DATE FIELD
  liveend?: string;
  archivestart?: string;
  archiveend?: string;
  goodafter?: string;
  createtimestamp?: string;
  lastmodified?: string;
  lastupdated?: string;

  // Duration
  scheduledeventduration?: number;  // in minutes

  // Timezone & Language
  displaytimezonecd?: string;       // "America/Los_Angeles"
  localelanguagecd?: string;        // "zh"
  localecountrycd?: string;         // "TW"

  // Status flags
  isactive?: boolean;
  regrequired?: boolean;
  regnotificationrequired?: boolean;
  iseliteexpired?: string;
  istestevent?: boolean;            // Test event flag
  ishybridevent?: boolean;

  // Campaign & URLs
  campaigncode?: string;
  audienceurl?: string;
  audiencekey?: string;
  extaudienceurl?: string;
  reporturl?: string;
  uploadurl?: string;
  pmurl?: string;
  previewurl?: string;

  // Arrays
  tags?: string[];
  speakers?: On24Speaker[];
  funnelstages?: string[];
  surveyurls?: string[];
  customeventfields?: On24CustomEventField[];
  customaccounttags?: Array<{
    groupid: number;
    groupname: string;
    tagid: number;
    tagname: string;
  }>;

  // Embedded analytics (included in event response!)
  eventanalytics?: On24EmbeddedAnalytics;

  // Custom standard fields
  eventstd1?: string;
  eventstd2?: string;
  eventstd3?: string;
  eventstd4?: string;
  eventstd5?: string;

  // Media
  media?: {
    audios?: string[];
    videos?: string[];
    slides?: string[];
    videoclips?: string[];
    urls?: string[];
    polls?: string[];
  };

  // Partner ref stats
  partnerrefstats?: Array<{
    code: string;
    count: number;
  }>;

  // Allow any additional fields from API
  [key: string]: unknown;
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
  attendeeid?: number;
  engagementScore?: number;
  engagementscore?: number;
  engagement?: number;
  liveDuration?: number;
  liveduration?: number;
  ondemandDuration?: number;
  ondemandduration?: number;
  totalDuration?: number;
  totalduration?: number;
  firstViewDate?: string;
  lastViewDate?: string;
  liveviewedduration?: number;
  ondemandviewedduration?: number;
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
