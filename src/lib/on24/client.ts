import {
  On24Event,
  On24Registrant,
  On24Attendee,
  On24EventAnalytics,
  On24PollResponse,
  On24SurveyResponse,
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

const DEFAULT_PAGE_SIZE = 100;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

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

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          // Rate limited or server error — retry with backoff
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          lastError = new Error(`On24 API Error: ${response.status}`);
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`On24 API Error: ${response.status} - ${errorText}`);
        }

        return response.json();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError || new Error('Request failed after retries');
  }

  // Fetch all pages of a paginated list endpoint
  private async requestAllPages<T>(
    baseEndpoint: string,
    extractItems: (response: unknown) => T[],
    pageSize: number = DEFAULT_PAGE_SIZE,
  ): Promise<T[]> {
    const MAX_PAGES = 50; // Safety limit: 50 pages = up to 5000 items
    const allItems: T[] = [];
    let page = 0;
    let prevCount = -1;

    while (page < MAX_PAGES) {
      const separator = baseEndpoint.includes('?') ? '&' : '?';
      const endpoint = `${baseEndpoint}${separator}pageSize=${pageSize}&page=${page}`;
      const response = await this.request<unknown>(endpoint);
      const items = extractItems(response);

      // If we got 0 items, we're done
      if (items.length === 0) break;

      // Detect API ignoring pagination: if page > 0 and we got same count as
      // first page, the API likely doesn't support paging — just use first page
      if (page > 0 && items.length === prevCount) {
        // Check if first item looks like a duplicate (same data as page 0)
        // by comparing JSON of first item
        const firstNewItem = JSON.stringify(items[0]);
        const firstExistingItem = allItems.length > 0 ? JSON.stringify(allItems[0]) : null;
        if (firstNewItem === firstExistingItem) {
          // API is returning the same data — stop paginating
          break;
        }
      }

      prevCount = items.length;
      allItems.push(...items);

      // If we got fewer items than pageSize, we've reached the last page
      if (items.length < pageSize) break;
      page++;
    }

    return allItems;
  }

  // Event Methods
  async listEvents(filters?: ListEventsFilters): Promise<On24Event[]> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.status) params.append('status', filters.status);

    const queryString = params.toString();
    const baseEndpoint = `/event${queryString ? `?${queryString}` : ''}`;

    return this.requestAllPages<On24Event>(baseEndpoint, (response) => {
      if (Array.isArray(response)) return response;
      const obj = response as Record<string, unknown>;
      return (obj.events as On24Event[]) || [];
    });
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
    const baseEndpoint = `/event/${eventId}/registrant${queryString ? `?${queryString}` : ''}`;

    return this.requestAllPages<On24Registrant>(baseEndpoint, (response) => {
      if (Array.isArray(response)) return response;
      const obj = response as Record<string, unknown>;
      return (obj.registrants as On24Registrant[]) || [];
    });
  }

  async listAttendees(eventId: number): Promise<On24Attendee[]> {
    return this.requestAllPages<On24Attendee>(
      `/event/${eventId}/attendee`,
      (response) => {
        if (Array.isArray(response)) return response;
        const obj = response as Record<string, unknown>;
        return (obj.attendees as On24Attendee[]) || [];
      },
    );
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
      // /poll returns {eventid, polls: [...]}
      const response = await this.request<Record<string, unknown>>(`/event/${eventId}/poll`);
      const items = (response.polls as On24PollResponse[]) || [];
      return items;
    } catch {
      return [];
    }
  }

  async getSurveyResponses(eventId: number): Promise<On24SurveyResponse[]> {
    try {
      // /survey returns {eventid, surveys: [...]}
      const response = await this.request<Record<string, unknown>>(`/event/${eventId}/survey`);
      const items = (response.surveys as On24SurveyResponse[]) || [];
      return items;
    } catch {
      return [];
    }
  }

  // Note: /question endpoint returns 404. Q&A data is not available via the On24 API.
  // Attendee records include an `askedquestions` count field.

  async getResourceDownloads(eventId: number): Promise<On24ResourceDownload[]> {
    try {
      // /resource returns {eventid, totalresources, resourcesviewed: [...]}
      const response = await this.request<Record<string, unknown>>(`/event/${eventId}/resource`);
      const items = (response.resourcesviewed as On24ResourceDownload[]) || [];
      return items;
    } catch {
      return [];
    }
  }

  async getCTAClicks(eventId: number): Promise<On24CTAClick[]> {
    try {
      // /cta returns {eventid, calltoactions: [...]}
      const response = await this.request<Record<string, unknown>>(`/event/${eventId}/cta`);
      const items = (response.calltoactions as On24CTAClick[]) || [];
      return items;
    } catch {
      return [];
    }
  }

  // Note: /reaction standalone endpoint returns 404, but reactions ARE included
  // in the attendee records returned by /event/{eventId}/attendee as a `reactions` array.

  // Aggregated Data for Export
  async getFullEventData(eventId: number) {
    const [
      event,
      registrants,
      attendees,
      analytics,
      polls,
      surveys,
      resources,
      cta,
    ] = await Promise.all([
      this.getEvent(eventId),
      this.listRegistrants(eventId),
      this.listAttendees(eventId),
      this.getEventAnalytics(eventId),
      this.getPollResponses(eventId),
      this.getSurveyResponses(eventId),
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
