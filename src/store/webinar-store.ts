'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AttendeeMetrics, DashboardData, WebinarSummary } from '@/types/webinar';

interface WebinarState {
  // Data
  dashboardData: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  lastRefreshed: string | null;

  // Attendee metrics loading state
  attendeeMetricsLoading: boolean;
  attendeeMetricsProgress: { loaded: number; total: number };

  // Live session data (written by dashboard, read by insights — NOT persisted)
  liveWebinars: WebinarSummary[];
  liveCtaCounts: Record<number, number>;

  // Shared date filter (persisted across tabs)
  filterStartDate: string;
  filterEndDate: string;
  filterActivePreset: string;

  // Actions
  setDashboardData: (data: DashboardData) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearCache: () => void;
  setAttendeeMetricsForEvents: (metrics: Record<number, AttendeeMetrics>) => void;
  setAttendeeMetricsLoading: (loading: boolean) => void;
  setAttendeeMetricsProgress: (loaded: number, total: number) => void;
  setLiveWebinars: (webinars: WebinarSummary[]) => void;
  setLiveCtaCounts: (counts: Record<number, number>) => void;
  setDateFilter: (startDate: string, endDate: string, activePreset: string) => void;
  applyDateFilter: (startDate: string, endDate: string, activePreset: string) => void;

  // Incremented each time the user explicitly applies a date range (triggers page re-fetch)
  filterVersion: number;

  // Computed helpers
  getWebinarById: (eventId: number) => WebinarSummary | undefined;
  getTopPerformers: (count?: number) => WebinarSummary[];
  getPoorPerformers: (count?: number) => WebinarSummary[];
}

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export const useWebinarStore = create<WebinarState>()(
  persist(
    (set, get) => ({
      // Initial state
      dashboardData: null,
      isLoading: false,
      error: null,
      lastRefreshed: null,
      attendeeMetricsLoading: false,
      attendeeMetricsProgress: { loaded: 0, total: 0 },
      liveWebinars: [],
      liveCtaCounts: {},
      filterStartDate: '',
      filterEndDate: '',
      filterActivePreset: 'Last 30 days',
      filterVersion: 0,

      // Actions
      setDashboardData: (data) =>
        set({
          dashboardData: data,
          lastRefreshed: new Date().toISOString(),
          error: null,
        }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error, isLoading: false }),

      clearCache: () =>
        set({
          dashboardData: null,
          lastRefreshed: null,
          error: null,
        }),

      setAttendeeMetricsForEvents: (metrics) =>
        set((state) => {
          if (!state.dashboardData) return state;
          const updatedWebinars = state.dashboardData.webinars.map(w => {
            const m = metrics[w.eventId];
            return m ? { ...w, attendeeMetrics: m } : w;
          });
          return {
            dashboardData: {
              ...state.dashboardData,
              webinars: updatedWebinars,
            },
          };
        }),

      setAttendeeMetricsLoading: (loading) =>
        set({ attendeeMetricsLoading: loading }),

      setAttendeeMetricsProgress: (loaded, total) =>
        set({ attendeeMetricsProgress: { loaded, total } }),

      setLiveWebinars: (webinars) => set({ liveWebinars: webinars }),

      setLiveCtaCounts: (counts) => set({ liveCtaCounts: counts }),

      setDateFilter: (startDate, endDate, activePreset) =>
        set({ filterStartDate: startDate, filterEndDate: endDate, filterActivePreset: activePreset }),

      applyDateFilter: (startDate, endDate, activePreset) =>
        set((state) => ({
          filterStartDate: startDate,
          filterEndDate: endDate,
          filterActivePreset: activePreset,
          filterVersion: state.filterVersion + 1,
        })),

      // Computed helpers
      getWebinarById: (eventId) => {
        const { dashboardData } = get();
        return dashboardData?.webinars.find((w) => w.eventId === eventId);
      },

      getTopPerformers: (count = 5) => {
        const { dashboardData } = get();
        if (!dashboardData) return [];
        return [...dashboardData.webinars]
          .sort((a, b) => b.engagementScore - a.engagementScore)
          .slice(0, count);
      },

      getPoorPerformers: (count = 5) => {
        const { dashboardData } = get();
        if (!dashboardData) return [];
        return [...dashboardData.webinars]
          .sort((a, b) => a.engagementScore - b.engagementScore)
          .slice(0, count);
      },
    }),
    {
      name: 'on24-webinar-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        dashboardData: state.dashboardData,
        lastRefreshed: state.lastRefreshed,
        filterStartDate: state.filterStartDate,
        filterEndDate: state.filterEndDate,
        filterActivePreset: state.filterActivePreset,
      }),
    }
  )
);

// Helper to check if cache is valid
export function isCacheValid(lastRefreshed: string | null): boolean {
  if (!lastRefreshed) return false;
  const lastRefreshTime = new Date(lastRefreshed).getTime();
  const now = Date.now();
  return now - lastRefreshTime < CACHE_DURATION_MS;
}

// Format relative time (kept for compatibility)
export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// Format timestamp for display
export function formatTimestamp(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
