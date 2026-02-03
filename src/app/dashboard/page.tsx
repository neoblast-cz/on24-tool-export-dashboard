'use client';

import { useEffect, useCallback } from 'react';
import { useWebinarStore, isCacheValid, formatRelativeTime } from '@/store/webinar-store';
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

export default function DashboardPage() {
  const {
    dashboardData,
    isLoading,
    error,
    lastRefreshed,
    setDashboardData,
    setLoading,
    setError,
    clearCache,
    getTopPerformers,
    getPoorPerformers,
  } = useWebinarStore();

  const cacheValid = isCacheValid(lastRefreshed);

  const fetchWebinarData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Calculate date range (last 90 days)
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
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

  const topPerformers = getTopPerformers(5);
  const poorPerformers = getPoorPerformers(5);
  const overallRecommendations = dashboardData
    ? getOverallRecommendations(dashboardData.webinars)
    : [];

  // Loading state (no cached data)
  if (isLoading && !dashboardData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingState message="Loading webinar data from On24..." />
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
          <h1 className="text-2xl font-bold text-gray-900">Webinar Dashboard</h1>
          <p className="text-sm text-gray-500">
            {lastRefreshed ? (
              <>
                Last updated: {formatRelativeTime(lastRefreshed)}
                {cacheValid && (
                  <span className="ml-2 text-green-600">(cached)</span>
                )}
              </>
            ) : (
              'No data loaded'
            )}
          </p>
        </div>
        <div className="flex gap-2">
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
          <p className="text-sm">Showing cached data from {formatRelativeTime(lastRefreshed!)}.</p>
        </Alert>
      )}

      {/* Stats Overview */}
      {dashboardData && <StatsOverview stats={dashboardData.overallStats} />}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Engagement Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData ? (
              <PerformanceChart webinars={dashboardData.webinars} />
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
          <CardHeader className="border-l-4 border-l-green-500">
            <CardTitle className="text-green-700">Top Performing Webinars</CardTitle>
          </CardHeader>
          <CardContent>
            <WebinarList
              webinars={topPerformers}
              variant="success"
              emptyMessage="No webinars to display"
            />
          </CardContent>
        </Card>

        {/* Needs Improvement */}
        <Card>
          <CardHeader className="border-l-4 border-l-orange-500">
            <CardTitle className="text-orange-700">Needs Improvement</CardTitle>
          </CardHeader>
          <CardContent>
            <WebinarList
              webinars={poorPerformers}
              variant="warning"
              emptyMessage="No webinars to display"
            />
          </CardContent>
        </Card>
      </div>

      {/* Full Webinar List */}
      {dashboardData && dashboardData.webinars.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Webinars ({dashboardData.webinars.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <WebinarList
              webinars={dashboardData.webinars}
              showDetails
              sortable
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
