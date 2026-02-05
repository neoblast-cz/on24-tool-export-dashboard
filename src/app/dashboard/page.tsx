'use client';

import { useEffect, useCallback, useState, useMemo } from 'react';
import { useWebinarStore, isCacheValid, formatTimestamp } from '@/store/webinar-store';
import { StatsOverview } from '@/components/dashboard/stats-overview';
import { WebinarList } from '@/components/dashboard/webinar-list';
import { Recommendations } from '@/components/dashboard/recommendations';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { LoadingState } from '@/components/ui/spinner';
import { getOverallRecommendations } from '@/lib/analytics/recommendations';
import { DashboardData } from '@/types/webinar';
import { ExportModal } from '@/components/dashboard/export-modal';

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [showTestWebinars, setShowTestWebinars] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | '30' | '90' | '180' | '365' | '730'>('all');
  const [missingCampaignOnly, setMissingCampaignOnly] = useState(false);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const {
    dashboardData,
    isLoading,
    error,
    lastRefreshed,
    setDashboardData,
    setLoading,
    setError,
    clearCache,
  } = useWebinarStore();

  const cacheValid = isCacheValid(lastRefreshed);

  // Prevent hydration mismatch from localStorage
  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchWebinarData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Calculate date range (last 3 years)
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const response = await fetch(
        `/api/on24/events?startDate=${startDate}&endDate=${endDate}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch webinar data');
      }

      const result = await response.json();

      if (result.success) {
        setDashboardData(result.data as DashboardData);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  }, [setDashboardData, setLoading, setError]);

  // Auto-fetch on mount if cache is invalid
  useEffect(() => {
    if (!cacheValid && !isLoading && !dashboardData) {
      fetchWebinarData();
    }
  }, [cacheValid, isLoading, dashboardData, fetchWebinarData]);

  // Apply all filters
  const filteredWebinars = useMemo(() => {
    if (!dashboardData) return [];

    return dashboardData.webinars.filter((w) => {
      // Test webinar filter
      if (!showTestWebinars && w.isTest) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = w.webinarName?.toLowerCase().includes(query);
        const matchesCampaign = w.campaignName?.toLowerCase().includes(query);
        const matchesId = w.eventId.toString().includes(query);
        if (!matchesName && !matchesCampaign && !matchesId) return false;
      }

      // Date filter
      if (dateFilter !== 'all') {
        const days = parseInt(dateFilter);
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const webinarDate = new Date(w.startDateTime);
        if (webinarDate < cutoffDate) return false;
      }

      // Missing campaign filter
      if (missingCampaignOnly && w.hasCampaignCode) return false;

      // Tag filter (must have ALL selected tags)
      if (tagFilters.length > 0) {
        if (!w.tags) return false;
        for (const tag of tagFilters) {
          if (!w.tags.includes(tag)) return false;
        }
      }

      return true;
    });
  }, [dashboardData, showTestWebinars, searchQuery, dateFilter, missingCampaignOnly, tagFilters]);

  const testWebinarCount = dashboardData?.webinars.filter((w) => w.isTest).length ?? 0;
  const missingCampaignCount = dashboardData?.webinars.filter((w) => !w.hasCampaignCode).length ?? 0;

  // Top/poor performers from filtered data
  const topPerformers = useMemo(() => {
    return [...filteredWebinars]
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 5);
  }, [filteredWebinars]);

  const poorPerformers = useMemo(() => {
    return [...filteredWebinars]
      .filter(w => w.totalAttendees > 0) // Only include webinars that had attendees
      .sort((a, b) => a.engagementScore - b.engagementScore)
      .slice(0, 5);
  }, [filteredWebinars]);

  const overallRecommendations = dashboardData
    ? getOverallRecommendations(filteredWebinars)
    : [];


  // Wait for client-side hydration
  if (!mounted) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingState message="Loading..." />
      </div>
    );
  }

  // Loading state (no cached data)
  if (isLoading && !dashboardData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingState message="Loading webinar data from On24 (fetching 3 years in batches, this may take a moment)..." />
      </div>
    );
  }

  // Error state (no cached data)
  if (error && !dashboardData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="error" title="Error Loading Data">
          <p>{error}</p>
          <p className="mt-2 text-sm">
            Make sure your On24 API credentials are configured in the .env.local file.
          </p>
          <Button onClick={fetchWebinarData} variant="outline" className="mt-4">
            Try Again
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ansell-dark">Webinar Dashboard</h1>
          <p className="text-sm text-ansell-gray-500">
            {lastRefreshed ? (
              <>
                Last updated: {formatTimestamp(lastRefreshed)}
                {cacheValid && (
                  <span className="ml-2 text-ansell-teal">(cached)</span>
                )}
              </>
            ) : (
              'No data loaded'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {testWebinarCount > 0 && (
            <button
              onClick={() => setShowTestWebinars(!showTestWebinars)}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                showTestWebinars
                  ? 'bg-gray-100 border-gray-300 text-gray-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {showTestWebinars ? 'Hide' : 'Show'} Test Webinars ({testWebinarCount})
            </button>
          )}
          <Button
            onClick={fetchWebinarData}
            isLoading={isLoading}
            variant={cacheValid ? 'outline' : 'primary'}
          >
            {cacheValid ? 'Refresh Data' : 'Load Data'}
          </Button>
          {dashboardData && (
            <Button onClick={clearCache} variant="ghost">
              Clear Cache
            </Button>
          )}
        </div>
      </div>

      {/* Error banner (with cached data) */}
      {error && dashboardData && (
        <Alert variant="warning" title="Refresh Failed">
          <p>{error}</p>
          <p className="text-sm">Showing cached data from {formatTimestamp(lastRefreshed!)}.</p>
        </Alert>
      )}

      {/* Loading overlay (refreshing with cached data) */}
      {isLoading && dashboardData && (
        <div className="fixed inset-0 bg-black/20 z-40 flex items-center justify-center">
          <div className="bg-white shadow-xl p-6 mx-4 max-w-md border-t-4 border-ansell-teal">
            <div className="flex items-center gap-4">
              <div className="animate-spin h-8 w-8 border-b-2 border-ansell-teal"></div>
              <div>
                <p className="font-medium text-ansell-gray-900">Refreshing Data...</p>
                <p className="text-sm text-ansell-gray-500">Fetching 3 years of webinar data from On24</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-ansell-gray-400">This may take a moment as we fetch data in batches</p>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      {dashboardData && <StatsOverview stats={dashboardData.overallStats} webinars={filteredWebinars} />}

      {/* Filters */}
      {dashboardData && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 items-end">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
                <input
                  type="text"
                  placeholder="Search by name, campaign, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Date Range */}
              <div className="min-w-[140px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">Date Range</label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Time</option>
                  <option value="30">Last 30 Days</option>
                  <option value="90">Last 90 Days</option>
                  <option value="180">Last 6 Months</option>
                  <option value="365">Last Year</option>
                  <option value="730">Last 2 Years</option>
                </select>
              </div>

              {/* Missing Campaign Toggle */}
              {missingCampaignCount > 0 && (
                <button
                  onClick={() => setMissingCampaignOnly(!missingCampaignOnly)}
                  className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                    missingCampaignOnly
                      ? 'bg-amber-100 border-amber-300 text-amber-800'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Missing Campaign ({missingCampaignCount})
                </button>
              )}

              {/* Active Tag Filters */}
              {tagFilters.length > 0 && tagFilters.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilters(tagFilters.filter(t => t !== tag))}
                  className="px-2 py-1.5 text-sm rounded-md bg-ansell-teal text-white flex items-center gap-1"
                >
                  {tag}
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}

              {/* Clear Filters */}
              {(searchQuery || dateFilter !== 'all' || missingCampaignOnly || tagFilters.length > 0) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setDateFilter('all');
                    setMissingCampaignOnly(false);
                    setTagFilters([]);
                  }}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Filter Results Summary */}
            <div className="mt-3 text-sm text-gray-500">
              Showing {filteredWebinars.length} of {dashboardData.webinars.length} webinars
              {!showTestWebinars && testWebinarCount > 0 && ` (${testWebinarCount} test hidden)`}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Engagement Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData ? (
              <PerformanceChart webinars={filteredWebinars} />
            ) : (
              <p className="text-gray-500 text-center py-12">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <Recommendations recommendations={overallRecommendations} />
          </CardContent>
        </Card>
      </div>

      {/* Performance Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Performers */}
        <Card>
          <CardHeader className="border-l-4 border-l-ansell-teal">
            <CardTitle className="text-ansell-teal-dark">Top Performing Webinars</CardTitle>
          </CardHeader>
          <CardContent>
            <WebinarList
              webinars={topPerformers}
              variant="success"
              emptyMessage="No webinars to display"
              activeTagFilters={tagFilters}
              onTagToggle={(tag) => setTagFilters(prev =>
                prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
              )}
            />
          </CardContent>
        </Card>

        {/* Needs Improvement */}
        <Card>
          <CardHeader className="border-l-4 border-l-ansell-dark">
            <CardTitle className="text-ansell-dark">Needs Improvement</CardTitle>
          </CardHeader>
          <CardContent>
            <WebinarList
              webinars={poorPerformers}
              variant="warning"
              emptyMessage="No webinars to display"
              activeTagFilters={tagFilters}
              onTagToggle={(tag) => setTagFilters(prev =>
                prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
              )}
            />
          </CardContent>
        </Card>
      </div>

      {/* Full Webinar List */}
      {dashboardData && filteredWebinars.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              All Webinars ({filteredWebinars.length})
              {filteredWebinars.length !== dashboardData.webinars.length && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  (filtered from {dashboardData.webinars.length})
                </span>
              )}
            </CardTitle>
            <Button
              onClick={() => setShowExportModal(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            <WebinarList
              webinars={filteredWebinars}
              showDetails
              sortable
              activeTagFilters={tagFilters}
              onTagToggle={(tag) => setTagFilters(prev =>
                prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
              )}
            />
          </CardContent>
        </Card>
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        webinars={filteredWebinars}
      />
    </div>
  );
}
