'use client';

import { useState } from 'react';
import { WebinarSummary } from '@/types/webinar';
import { PerformanceBadge } from '@/components/ui/badge';

interface WebinarListProps {
  webinars: WebinarSummary[];
  variant?: 'default' | 'success' | 'warning';
  emptyMessage?: string;
  showDetails?: boolean;
  sortable?: boolean;
}

type SortKey = 'webinarName' | 'engagementScore' | 'totalAttendees' | 'date';
type SortOrder = 'asc' | 'desc';

export function WebinarList({
  webinars,
  variant = 'default',
  emptyMessage = 'No webinars to display',
  showDetails = false,
  sortable = false,
}: WebinarListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('engagementScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  if (webinars.length === 0) {
    return <p className="text-gray-500 text-center py-4">{emptyMessage}</p>;
  }

  const sortedWebinars = sortable
    ? [...webinars].sort((a, b) => {
        let aVal = a[sortKey];
        let bVal = b[sortKey];
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      })
    : webinars;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${sortable ? 'cursor-pointer hover:bg-gray-100' : ''}`}
      onClick={() => sortable && handleSort(sortKeyName)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortable && sortKey === sortKeyName && (
          <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );

  const variantBorder = {
    default: 'border-gray-200',
    success: 'border-green-200',
    warning: 'border-orange-200',
  };

  if (showDetails) {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortHeader label="Webinar" sortKeyName="webinarName" />
              <SortHeader label="Date" sortKeyName="date" />
              <SortHeader label="Engagement" sortKeyName="engagementScore" />
              <SortHeader label="Attendees" sortKeyName="totalAttendees" />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedWebinars.map((webinar) => (
              <tr key={webinar.eventId} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <div>
                    <div className="font-medium text-gray-900">{webinar.webinarName}</div>
                    <div className="text-sm text-gray-500">{webinar.campaignName}</div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-500">{webinar.date}</td>
                <td className="px-4 py-4">
                  <span className="text-lg font-semibold">{webinar.engagementScore.toFixed(1)}</span>
                </td>
                <td className="px-4 py-4 text-sm text-gray-500">
                  {webinar.totalAttendees} / {webinar.totalRegistrations}
                </td>
                <td className="px-4 py-4">
                  <PerformanceBadge rating={webinar.performanceRating} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedWebinars.map((webinar) => (
        <div
          key={webinar.eventId}
          className={`p-4 rounded-lg border ${variantBorder[variant]} bg-white hover:shadow-sm transition-shadow`}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 truncate">{webinar.webinarName}</h4>
              <p className="text-sm text-gray-500">{webinar.campaignName}</p>
            </div>
            <div className="ml-4 flex items-center gap-3">
              <div className="text-right">
                <p className="text-lg font-semibold">{webinar.engagementScore.toFixed(1)}</p>
                <p className="text-xs text-gray-500">Engagement</p>
              </div>
              <PerformanceBadge rating={webinar.performanceRating} />
            </div>
          </div>
          {webinar.recommendations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Recommendation:</p>
              <p className="text-sm text-gray-600">{webinar.recommendations[0]}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
