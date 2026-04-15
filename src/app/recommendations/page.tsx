'use client';

import { useEffect, useState, useMemo } from 'react';
import { useWebinarStore, isCacheValid } from '@/store/webinar-store';
import { WebinarList } from '@/components/dashboard/webinar-list';
import { Recommendations } from '@/components/dashboard/recommendations';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/spinner';
import { getOverallRecommendations } from '@/lib/analytics/recommendations';

export default function RecommendationsPage() {
  const [mounted, setMounted] = useState(false);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const { dashboardData, isLoading, lastRefreshed } = useWebinarStore();

  useEffect(() => { setMounted(true); }, []);

  const webinars = dashboardData?.webinars ?? [];

  const topPerformers = useMemo(() => {
    return [...webinars]
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 5);
  }, [webinars]);

  const poorPerformers = useMemo(() => {
    return [...webinars]
      .filter(w => w.totalAttendees > 0)
      .sort((a, b) => a.engagementScore - b.engagementScore)
      .slice(0, 5);
  }, [webinars]);

  const overallRecommendations = useMemo(() => {
    return webinars.length > 0 ? getOverallRecommendations(webinars) : [];
  }, [webinars]);

  if (!mounted) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingState message="Loading..." />
      </div>
    );
  }

  if (!dashboardData && !isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium mb-2">No data loaded</p>
          <p className="text-sm">Visit the Dashboard first to load webinar data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Recommendations</h1>

      {/* Performance Chart + Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Engagement Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <PerformanceChart webinars={webinars} />
          </CardContent>
        </Card>

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
    </div>
  );
}
