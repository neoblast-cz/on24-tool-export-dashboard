'use client';

import { useState } from 'react';
import { WebinarSummary } from '@/types/webinar';
import { PerformanceBadge } from '@/components/ui/badge';

// Helper to generate On24 edit URL
const getOn24EditUrl = (eventId: number) => `https://wcc.on24.com/webcast/update/${eventId}`;

// Format date for display
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'No date';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Invalid date';
  }
}

// Campaign code display component
function CampaignDisplay({ webinar }: { webinar: WebinarSummary }) {
  if (webinar.hasCampaignCode && webinar.campaignName) {
    return <span>{webinar.campaignName}</span>;
  }

  return (
    <a
      href={getOn24EditUrl(webinar.eventId)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-md hover:bg-amber-200 transition-colors"
      title="Click to add campaign code in On24"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      Missing - Add
    </a>
  );
}

// Expanded details component
function WebinarDetails({ webinar, onTagClick, activeTagFilters = [] }: { webinar: WebinarSummary; onTagClick?: (tag: string) => void; activeTagFilters?: string[] }) {
  return (
    <div className="p-4 bg-ansell-gray-50 border-t border-ansell-gray-200">
      {/* Event Analytics from API - moved to top */}
      {webinar.eventAnalytics && (
        <div className="mb-4 pb-4 border-b border-ansell-gray-200">
          <p className="text-xs text-ansell-gray-500 uppercase mb-2">Event Analytics</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-2 rounded border border-ansell-gray-200">
              <p className="text-xs text-ansell-gray-500">Registrations</p>
              <p className="text-lg font-semibold text-ansell-gray-800">{webinar.eventAnalytics.totalRegistrants ?? 0}</p>
            </div>
            <div className="bg-white p-2 rounded border border-ansell-gray-200">
              <p className="text-xs text-ansell-gray-500">Attendees</p>
              <p className="text-lg font-semibold text-ansell-gray-800">{webinar.eventAnalytics.totalAttendees ?? 0}</p>
            </div>
            <div className="bg-white p-2 rounded border border-ansell-gray-200">
              <p className="text-xs text-ansell-gray-500">Attendance Rate</p>
              <p className="text-lg font-semibold text-ansell-teal">
                {webinar.eventAnalytics.totalRegistrants && webinar.eventAnalytics.totalRegistrants > 0
                  ? `${Math.min(((webinar.eventAnalytics.totalAttendees ?? 0) / webinar.eventAnalytics.totalRegistrants) * 100, 100).toFixed(0)}%`
                  : '0%'}
              </p>
            </div>
            <div className="bg-white p-2 rounded border border-ansell-gray-200">
              <p className="text-xs text-ansell-gray-500">Live Hours</p>
              <p className="text-lg font-semibold text-ansell-gray-800">{((webinar.eventAnalytics.totalCumulativeLiveMinutes ?? 0) / 60).toFixed(1)}</p>
            </div>
            <div className="bg-white p-2 rounded border border-ansell-gray-200">
              <p className="text-xs text-ansell-gray-500">Archive Hours</p>
              <p className="text-lg font-semibold text-ansell-gray-800">{((webinar.eventAnalytics.totalCumulativeArchiveMinutes ?? 0) / 60).toFixed(1)}</p>
            </div>
            <div className="bg-white p-2 rounded border border-ansell-gray-200">
              <p className="text-xs text-ansell-gray-500">Total Hours</p>
              <p className="text-lg font-semibold text-ansell-gray-800">{((webinar.eventAnalytics.totalMediaPlayerMinutes ?? 0) / 60).toFixed(1)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Speakers */}
      {webinar.speakers && webinar.speakers.length > 0 && (
        <div className="mb-4 pb-4 border-b border-ansell-gray-200">
          <p className="text-xs text-ansell-gray-500 uppercase mb-2">Speakers</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {webinar.speakers.map((speaker, i) => (
              <div key={i} className="bg-white p-2 border border-ansell-gray-200 rounded">
                <p className="font-medium text-sm text-ansell-gray-800">{speaker.name}</p>
                {speaker.title && (
                  <p className="text-xs text-ansell-gray-600">{speaker.title}</p>
                )}
                {speaker.company && (
                  <p className="text-xs text-ansell-teal">{speaker.company}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event Info Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-4 pb-4 border-b border-ansell-gray-200">
        <div>
          <p className="text-xs text-ansell-gray-500 uppercase">Event Type</p>
          <p className="font-medium text-ansell-gray-800">{webinar.eventType || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-ansell-gray-500 uppercase">Language</p>
          <p className="font-medium text-ansell-gray-800">{webinar.language || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-ansell-gray-500 uppercase">Duration (min)</p>
          <p className="font-medium text-ansell-gray-800">{webinar.duration || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-ansell-gray-500 uppercase">Timezone</p>
          <p className="font-medium text-ansell-gray-800">{webinar.timezone || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-ansell-gray-500 uppercase">Status</p>
          <p className="font-medium text-ansell-gray-800">{webinar.status || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-ansell-gray-500 uppercase">Start Time</p>
          <p className="font-medium text-sm text-ansell-gray-800">{webinar.startDateTime ? new Date(webinar.startDateTime).toLocaleString() : 'N/A'}</p>
        </div>
      </div>

      {/* Tags */}
      {webinar.tags && webinar.tags.length > 0 && (
        <div className="mb-4 pb-4 border-b border-ansell-gray-200">
          <p className="text-xs text-ansell-gray-500 uppercase mb-2">Tags</p>
          <div className="flex flex-wrap gap-2">
            {webinar.tags.map((tag, i) => (
              <button
                key={i}
                onClick={() => onTagClick?.(tag)}
                className={`px-2 py-1 text-xs transition-colors cursor-pointer ${
                  activeTagFilters.includes(tag)
                    ? 'bg-ansell-teal text-white'
                    : 'bg-ansell-dark text-white hover:bg-ansell-teal'
                }`}
                title={activeTagFilters.includes(tag) ? `Remove "${tag}" filter` : `Add "${tag}" filter`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* URLs */}
      <div className="mt-4 pt-4 border-t border-ansell-gray-200">
        <p className="text-xs text-ansell-gray-500 uppercase mb-2">Links</p>
          <div className="flex flex-wrap gap-3">
            {webinar.audienceUrl && (
              <a
                href={webinar.audienceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ansell-teal text-white text-sm hover:bg-ansell-teal-dark transition-colors rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Registration Page
              </a>
            )}
            {webinar.reportUrl && (
              <a
                href={webinar.reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ansell-dark text-white text-sm hover:bg-gray-700 transition-colors rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Report
              </a>
            )}
          </div>
        </div>

      {/* Recommendations */}
      {webinar.recommendations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-ansell-gray-200">
          <p className="text-xs text-ansell-gray-500 uppercase mb-1">Recommendations</p>
          <ul className="text-sm text-ansell-gray-600 list-disc list-inside">
            {webinar.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface WebinarListProps {
  webinars: WebinarSummary[];
  variant?: 'default' | 'success' | 'warning';
  emptyMessage?: string;
  showDetails?: boolean;
  sortable?: boolean;
  activeTagFilters?: string[];
  onTagToggle?: (tag: string) => void;
}

type SortKey = 'webinarName' | 'engagementScore' | 'totalAttendees' | 'startDateTime' | 'eventId';
type SortOrder = 'asc' | 'desc';

export function WebinarList({
  webinars,
  variant = 'default',
  emptyMessage = 'No webinars to display',
  showDetails = false,
  sortable = false,
  activeTagFilters = [],
  onTagToggle,
}: WebinarListProps) {
  // Default sort by date descending (newest first)
  const [sortKey, setSortKey] = useState<SortKey>('startDateTime');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const handleTagClick = (tag: string) => {
    if (onTagToggle) {
      onTagToggle(tag);
    }
  };

  if (webinars.length === 0) {
    return <p className="text-gray-500 text-center py-4">{emptyMessage}</p>;
  }

  const toggleRow = (eventId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedRows(newExpanded);
  };

  const sortedWebinars = sortable
    ? [...webinars].sort((a, b) => {
        let aVal: string | number | Date = a[sortKey] as string | number;
        let bVal: string | number | Date = b[sortKey] as string | number;

        // Handle date sorting properly
        if (sortKey === 'startDateTime') {
          aVal = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
          bVal = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
        } else if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = (bVal as string).toLowerCase();
        }

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

  const SortHeader = ({ label, sortKeyName, className = '' }: { label: string; sortKeyName: SortKey; className?: string }) => (
    <th
      className={`px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${sortable ? 'cursor-pointer hover:bg-gray-100' : ''} ${className}`}
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
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-1 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                {/* Expand column */}
              </th>
              <SortHeader label="ID" sortKeyName="eventId" />
              <SortHeader label="Webinar" sortKeyName="webinarName" />
              <SortHeader label="Date" sortKeyName="startDateTime" />
              <SortHeader label="Att %" sortKeyName="totalAttendees" />
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Live h</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Arch h</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total h</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Perf
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedWebinars.map((webinar) => {
              const isExpanded = expandedRows.has(webinar.eventId);
              const liveHours = ((webinar.eventAnalytics?.totalCumulativeLiveMinutes ?? 0) / 60).toFixed(1);
              const archiveHours = ((webinar.eventAnalytics?.totalCumulativeArchiveMinutes ?? 0) / 60).toFixed(1);
              const totalHours = ((webinar.eventAnalytics?.totalMediaPlayerMinutes ?? 0) / 60).toFixed(1);
              return (
                <>
                  <tr key={webinar.eventId} className={`hover:bg-gray-50 ${webinar.isTest ? 'bg-gray-50' : ''}`}>
                    <td className="px-1 py-2">
                      <button
                        onClick={() => toggleRow(webinar.eventId)}
                        className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                        title={isExpanded ? 'Collapse details' : 'Expand details'}
                      >
                        <svg
                          className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </td>
                    <td className="px-2 py-2 text-xs text-gray-500 font-mono">
                      <a
                        href={getOn24EditUrl(webinar.eventId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 hover:underline"
                        title="Open in On24"
                      >
                        {webinar.eventId}
                      </a>
                    </td>
                    <td className="px-2 py-2">
                      <div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="font-medium text-gray-900 text-sm">
                            {webinar.webinarName || `Event ${webinar.eventId}`}
                          </span>
                          {webinar.isTest && (
                            <span className="px-1 py-0.5 text-[10px] bg-gray-300 text-gray-700 font-medium">TEST</span>
                          )}
                          {webinar.tags && webinar.tags.length > 0 && webinar.tags.slice(0, 2).map((tag, i) => (
                            <button
                              key={i}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTagClick(tag);
                              }}
                              className={`px-1 py-0.5 text-[10px] transition-colors ${
                                activeTagFilters.includes(tag)
                                  ? 'bg-ansell-teal text-white'
                                  : 'bg-ansell-dark text-white hover:bg-ansell-teal'
                              }`}
                              title={activeTagFilters.includes(tag) ? `Remove "${tag}" filter` : `Add "${tag}" filter`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500">
                          <CampaignDisplay webinar={webinar} />
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-xs text-gray-500">{formatDate(webinar.startDateTime)}</td>
                    <td className="px-2 py-2 text-xs">
                      <div className="font-semibold text-gray-900">
                        {webinar.totalRegistrations > 0
                          ? `${Math.min((webinar.totalAttendees / webinar.totalRegistrations) * 100, 100).toFixed(0)}%`
                          : '0%'}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {webinar.totalAttendees}/{webinar.totalRegistrations}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-xs text-gray-600">{liveHours}</td>
                    <td className="px-2 py-2 text-xs text-gray-600">{archiveHours}</td>
                    <td className="px-2 py-2 text-xs font-medium text-gray-800">{totalHours}</td>
                    <td className="px-2 py-2">
                      <PerformanceBadge rating={webinar.performanceRating} />
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${webinar.eventId}-details`}>
                      <td colSpan={9} className="p-0">
                        <WebinarDetails webinar={webinar} onTagClick={handleTagClick} activeTagFilters={activeTagFilters} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
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
          className={`p-4 rounded-lg border ${variantBorder[variant]} bg-white hover:shadow-sm transition-shadow ${webinar.isTest ? 'opacity-60' : ''}`}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900">
                  {webinar.webinarName || `Event ${webinar.eventId}`}
                </span>
                {webinar.isTest && (
                  <span className="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600">TEST</span>
                )}
                {webinar.tags && webinar.tags.length > 0 && webinar.tags.map((tag, i) => (
                  <button
                    key={i}
                    onClick={() => handleTagClick(tag)}
                    className={`px-1.5 py-0.5 text-xs transition-colors ${
                      activeTagFilters.includes(tag)
                        ? 'bg-ansell-teal text-white'
                        : 'bg-ansell-dark text-white hover:bg-ansell-teal'
                    }`}
                    title={activeTagFilters.includes(tag) ? `Remove "${tag}" filter` : `Add "${tag}" filter`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                <CampaignDisplay webinar={webinar} />
              </div>
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
