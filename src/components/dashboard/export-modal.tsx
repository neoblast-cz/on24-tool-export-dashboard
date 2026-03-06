'use client';

import { useState, useEffect, useMemo } from 'react';
import { WebinarSummary } from '@/types/webinar';
import { ALL_CSV_COLUMNS, getDefaultSelectedColumns, generateCSV } from '@/lib/csv/generator';
import { Button } from '@/components/ui/button';
import { useWebinarStore } from '@/store/webinar-store';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  webinars: WebinarSummary[];
}

// Helper to get preview value for a field
function getPreviewValue(webinar: WebinarSummary, key: string): string {
  switch (key) {
    case 'on24Url':
      return `https://wcc.on24.com/webcast/update/${webinar.eventId}`;
    case 'attendanceRate':
      if (webinar.totalRegistrations > 0) {
        return ((webinar.totalAttendees / webinar.totalRegistrations) * 100).toFixed(1) + '%';
      }
      return '0.0%';
    case 'workStatus':
      const issues: string[] = [];
      if (webinar.isTest) issues.push('Test webinar');
      if (!webinar.hasCampaignCode) issues.push('Missing campaign code');
      return issues.length > 0 ? issues.join('; ') : 'OK';
    default:
      // Attendee-derived metrics
      if (key.startsWith('am_')) {
        const am = webinar.attendeeMetrics;
        if (!am?.loaded) return '(loading...)';
        switch (key) {
          case 'am_attendeeCount': return am.attendeeCount.toString();
          case 'am_avgEngagementScore': return am.avgEngagementScore.toFixed(1);
          case 'am_totalLiveHours': return (am.totalLiveMinutes / 60).toFixed(2);
          case 'am_totalArchiveHours': return (am.totalArchiveMinutes / 60).toFixed(2);
          case 'am_totalViewingHours': return (am.totalViewingMinutes / 60).toFixed(2);
          case 'am_avgLiveMinutes': return am.avgLiveMinutes.toFixed(1);
          case 'am_avgArchiveMinutes': return am.avgArchiveMinutes.toFixed(1);
          case 'am_totalQuestionsAsked': return am.totalQuestionsAsked.toString();
          case 'am_totalResourcesDownloaded': return am.totalResourcesDownloaded.toString();
          case 'am_totalPollsAnswered': return am.totalPollsAnswered.toString();
          case 'am_totalSurveysAnswered': return am.totalSurveysAnswered.toString();
          default: return '-';
        }
      }
      const value = webinar[key as keyof WebinarSummary];
      if (value === undefined || value === null) return '-';
      if (Array.isArray(value)) return value.join(', ') || '-';
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      if (typeof value === 'number') return value.toString();
      return String(value) || '-';
  }
}

export function ExportModal({ isOpen, onClose, webinars }: ExportModalProps) {
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  const attendeeMetricsLoading = useWebinarStore((s) => s.attendeeMetricsLoading);

  // Check if any am_ fields are selected and metrics aren't fully loaded
  const hasAmFields = selectedFields.some((f) => f.startsWith('am_'));
  const metricsNotFullyLoaded = hasAmFields && (
    attendeeMetricsLoading || webinars.some((w) => !w.attendeeMetrics?.loaded)
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedFields(getDefaultSelectedColumns());
      setPreviewIndex(0);
    }
  }, [isOpen]);

  const previewWebinar = useMemo(() => {
    return webinars[previewIndex] || null;
  }, [webinars, previewIndex]);

  const handleToggle = (key: string) => {
    if (selectedFields.includes(key)) {
      setSelectedFields(selectedFields.filter((k) => k !== key));
    } else {
      setSelectedFields([...selectedFields, key]);
    }
  };

  const handleSelectAll = () => {
    setSelectedFields(ALL_CSV_COLUMNS.map((c) => c.key));
  };

  const handleSelectDefault = () => {
    setSelectedFields(getDefaultSelectedColumns());
  };

  const handleDeselectAll = () => {
    setSelectedFields([]);
  };

  const handleExport = () => {
    if (webinars.length === 0 || selectedFields.length === 0) return;

    const csv = generateCSV(webinars, selectedFields);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webinars-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onClose();
  };

  if (!isOpen) return null;

  const selectedColumns = ALL_CSV_COLUMNS.filter(c => selectedFields.includes(c.key));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-ansell-dark">
          <div>
            <h2 className="text-lg font-semibold text-white">Export to Excel/CSV</h2>
            <p className="text-sm text-gray-300">
              {webinars.length} webinar{webinars.length !== 1 ? 's' : ''} will be exported
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col lg:flex-row max-h-[calc(90vh-140px)]">
          {/* Fields Selection */}
          <div className="flex-1 px-6 py-4 overflow-y-auto border-r border-gray-200">
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-100">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-3 py-1.5 text-xs font-medium text-ansell-teal hover:text-ansell-teal-dark hover:bg-ansell-gray-100 transition-colors"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleSelectDefault}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
              >
                Reset to Default
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
              >
                Deselect All
              </button>
              <span className="ml-auto text-sm text-gray-500">
                {selectedFields.length} of {ALL_CSV_COLUMNS.length} fields
              </span>
            </div>

            {/* Field Checkboxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_CSV_COLUMNS.map((column) => (
                <label
                  key={column.key}
                  className={`flex items-start gap-3 p-2 cursor-pointer transition-colors border ${
                    selectedFields.includes(column.key)
                      ? 'bg-ansell-teal/10 border-ansell-teal'
                      : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(column.key)}
                    onChange={() => handleToggle(column.key)}
                    className="mt-0.5 h-4 w-4 text-ansell-teal border-gray-300 focus:ring-ansell-teal"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-gray-900">
                      {column.header}
                    </span>
                    {column.description && (
                      <span className="block text-xs text-gray-500">
                        {column.description}
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Preview Panel */}
          <div className="w-full lg:w-80 bg-gray-50 overflow-y-auto">
            <div className="sticky top-0 bg-gray-100 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Preview {showPreview ? '▼' : '▶'}
                </button>
              </div>
              {showPreview && webinars.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                    disabled={previewIndex === 0}
                    className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-xs text-gray-500">
                    {previewIndex + 1} / {webinars.length}
                  </span>
                  <button
                    onClick={() => setPreviewIndex(Math.min(webinars.length - 1, previewIndex + 1))}
                    disabled={previewIndex >= webinars.length - 1}
                    className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {showPreview && previewWebinar && (
              <div className="p-4">
                <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide">
                  Selected fields preview:
                </p>
                {selectedColumns.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No fields selected</p>
                ) : (
                  <div className="space-y-2">
                    {selectedColumns.map((column) => (
                      <div key={column.key} className="text-sm">
                        <span className="text-gray-500 text-xs">{column.header}</span>
                        <p className="text-gray-900 font-medium truncate" title={getPreviewValue(previewWebinar, column.key)}>
                          {getPreviewValue(previewWebinar, column.key)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <p className="text-xs text-gray-500">
              File will open directly in Excel (UTF-8 compatible)
            </p>
            {metricsNotFullyLoaded && (
              <p className="text-xs text-amber-600 mt-1">
                Attendee metrics still loading — computed fields may be incomplete
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={selectedFields.length === 0}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export {selectedFields.length} Fields
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
