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
  // UTM tracking parameters (present when registration link included UTM query params)
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  // Some On24 accounts use no-underscore variants
  utmsource?: string;
  utmmedium?: string;
  utmcampaign?: string;
  customFields?: Record<string, string>;
  [key: string]: unknown;
}

export interface On24Attendee extends On24Registrant {
  attendeeid?: number;
  // Engagement
  engagementScore?: number;
  engagementscore?: number;
  engagement?: number;
  // Live viewing
  liveDuration?: number;
  liveduration?: number;
  liveminutes?: number;
  liveviewed?: number;
  liveviewedduration?: number;
  // Archive viewing
  ondemandDuration?: number;
  ondemandduration?: number;
  archiveminutes?: number;
  archiveviewed?: number;
  ondemandviewedduration?: number;
  // Total viewing
  totalDuration?: number;
  totalduration?: number;
  // Cumulative
  cumulativeliveminutes?: number;
  cumulativearchiveminutes?: number;
  // Media player
  livemediaplayerminutes?: number;
  archivemediaplayerminutes?: number;
  // Interactions
  askedquestions?: number;
  resourcesdownloaded?: number;
  answeredpolls?: number;
  answeredsurveys?: number;
  answeredsurveyquestions?: number;
  attendeesessions?: number;
  // Reactions (emoji responses during the event)
  reactions?: Array<{ type: string; timefromstart: number; datetime: string }>;
  // Resources downloaded during/after the event
  resources?: Array<{ resourceid: number; resourceviewed: string; resourceviewedtimestamp: string }>;
  // Dates
  firstViewDate?: string;
  lastViewDate?: string;
  // Allow additional fields
  [key: string]: unknown;
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

export interface On24ResourceDownload {
  resourceid: number;
  resourcename: string;
  uniquedownloads: number;
  totaldownloads: number;
}

export interface On24CTAClick {
  ctaid: number;
  ctaname: string;
  actiontype: string;
  action: string;
  totalclicks: number;
  uniqueclicks: number;
}

export interface On24ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}
