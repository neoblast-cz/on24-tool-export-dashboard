import {
  On24Event,
  On24Registrant,
  On24Attendee,
  On24EventAnalytics,
  On24PollResponse,
  On24SurveyResponse,
  On24Question,
  On24ResourceDownload,
  On24CTAClick,
} from '@/types/on24';

interface On24ClientConfig {
  clientId: string;
  tokenKey: string;
  tokenSecret: string;
  baseUrl?: string;
}

interface ListEventsFilters {
  startDate?: string;
  endDate?: string;
  status?: 'live' | 'ondemand' | 'upcoming';
  pageSize?: number;
  page?: number;
}

export class On24Client {
  private clientId: string;
  private tokenKey: string;
  private tokenSecret: string;
  private baseUrl: string;

  constructor(config: On24ClientConfig) {
    this.clientId = config.clientId;
    this.tokenKey = config.tokenKey;
    this.tokenSecret = config.tokenSecret;
    this.baseUrl = config.baseUrl || 'https://api.on24.com/v2';
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}/client/${this.clientId}${endpoint}`;

    const headers: HeadersInit = {
      accesstokenkey: this.tokenKey,
      accesstokensecret: this.tokenSecret,
      accept: 'application/json',
      ...(body && { 'content-type': 'application/json' }),
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`On24 API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // Event Methods
  async listEvents(filters?: ListEventsFilters): Promise<On24Event[]> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.pageSize) params.append('pageSize', filters.pageSize.toString());
    if (filters?.page) params.append('page', filters.page.toString());

    const queryString = params.toString();
    const endpoint = `/event${queryString ? `?${queryString}` : ''}`;

    const response = await this.request<{ events: On24Event[] } | On24Event[]>(endpoint);

    // Handle different response formats
    if (Array.isArray(response)) {
      return response;
    }
    return response.events || [];
  }

  async getEvent(eventId: number): Promise<On24Event> {
    return this.request<On24Event>(`/event/${eventId}`);
  }

  // Registrant/Attendee Methods
  async listRegistrants(
    eventId: number,
    filters?: { partnerref?: string }
  ): Promise<On24Registrant[]> {
    const params = new URLSearchParams();
    if (filters?.partnerref) params.append('partnerref', filters.partnerref);

    const queryString = params.toString();
    const endpoint = `/event/${eventId}/registrant${queryString ? `?${queryString}` : ''}`;

    const response = await this.request<{ registrants: On24Registrant[] } | On24Registrant[]>(endpoint);

    if (Array.isArray(response)) {
      return response;
    }
    return response.registrants || [];
  }

  async listAttendees(eventId: number): Promise<On24Attendee[]> {
    const response = await this.request<{ attendees: On24Attendee[] } | On24Attendee[]>(
      `/event/${eventId}/attendee`
    );

    if (Array.isArray(response)) {
      return response;
    }
    return response.attendees || [];
  }

  // Analytics Methods
  async getEventAnalytics(eventId: number): Promise<On24EventAnalytics> {
    try {
      return await this.request<On24EventAnalytics>(`/event/${eventId}/analytics`);
    } catch {
      // Return default analytics if endpoint not available
      return {
        eventid: eventId,
        totalRegistrations: 0,
        totalAttendees: 0,
        averageEngagementScore: 0,
        averageViewDuration: 0,
        peakConcurrentViewers: 0,
        pollParticipationRate: 0,
        surveyCompletionRate: 0,
        resourceDownloads: 0,
        ctaClicks: 0,
        questionsAsked: 0,
      };
    }
  }

  // Interaction Data Methods
  async getPollResponses(eventId: number): Promise<On24PollResponse[]> {
    try {
      const response = await this.request<{ polls: On24PollResponse[] } | On24PollResponse[]>(
        `/event/${eventId}/poll`
      );
      if (Array.isArray(response)) {
        return response;
      }
      return response.polls || [];
    } catch {
      return [];
    }
  }

  async getSurveyResponses(eventId: number): Promise<On24SurveyResponse[]> {
    try {
      const response = await this.request<{ surveys: On24SurveyResponse[] } | On24SurveyResponse[]>(
        `/event/${eventId}/survey`
      );
      if (Array.isArray(response)) {
        return response;
      }
      return response.surveys || [];
    } catch {
      return [];
    }
  }

  async getQuestions(eventId: number): Promise<On24Question[]> {
    try {
      const response = await this.request<{ questions: On24Question[] } | On24Question[]>(
        `/event/${eventId}/question`
      );
      if (Array.isArray(response)) {
        return response;
      }
      return response.questions || [];
    } catch {
      return [];
    }
  }

  async getResourceDownloads(eventId: number): Promise<On24ResourceDownload[]> {
    try {
      const response = await this.request<{ resources: On24ResourceDownload[] } | On24ResourceDownload[]>(
        `/event/${eventId}/resource`
      );
      if (Array.isArray(response)) {
        return response;
      }
      return response.resources || [];
    } catch {
      return [];
    }
  }

  async getCTAClicks(eventId: number): Promise<On24CTAClick[]> {
    try {
      const response = await this.request<{ cta: On24CTAClick[] } | On24CTAClick[]>(
        `/event/${eventId}/cta`
      );
      if (Array.isArray(response)) {
        return response;
      }
      return response.cta || [];
    } catch {
      return [];
    }
  }

  // Aggregated Data for Export
  async getFullEventData(eventId: number) {
    const [
      event,
      registrants,
      attendees,
      analytics,
      polls,
      surveys,
      questions,
      resources,
      cta,
    ] = await Promise.all([
      this.getEvent(eventId),
      this.listRegistrants(eventId),
      this.listAttendees(eventId),
      this.getEventAnalytics(eventId),
      this.getPollResponses(eventId),
      this.getSurveyResponses(eventId),
      this.getQuestions(eventId),
      this.getResourceDownloads(eventId),
      this.getCTAClicks(eventId),
    ]);

    return {
      event,
      registrants,
      attendees,
      analytics,
      polls,
      surveys,
      questions,
      resources,
      cta,
    };
  }
}

// Singleton factory
let clientInstance: On24Client | null = null;

export function getOn24Client(): On24Client {
  if (!clientInstance) {
    const clientId = process.env.ON24_CLIENT_ID;
    const tokenKey = process.env.ON24_TOKEN_KEY;
    const tokenSecret = process.env.ON24_TOKEN_SECRET;
    const baseUrl = process.env.ON24_API_BASE_URL;

    if (!clientId || !tokenKey || !tokenSecret) {
      throw new Error('On24 API credentials not configured. Please set ON24_CLIENT_ID, ON24_TOKEN_KEY, and ON24_TOKEN_SECRET environment variables.');
    }

    clientInstance = new On24Client({
      clientId,
      tokenKey,
      tokenSecret,
      baseUrl,
    });
  }
  return clientInstance;
}

// Reset client (useful for testing)
export function resetOn24Client(): void {
  clientInstance = null;
}
