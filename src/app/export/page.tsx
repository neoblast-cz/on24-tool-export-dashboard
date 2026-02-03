'use client';

import { useState } from 'react';
import { EventIdInput } from '@/components/export/event-id-input';
import { ExportPreview } from '@/components/export/export-preview';
import { ColumnReference } from '@/components/export/column-reference';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { WebinarSummary } from '@/types/webinar';

export default function ExportPage() {
  const [eventIds, setEventIds] = useState<number[]>([]);
  const [previewData, setPreviewData] = useState<WebinarSummary[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleEventIdsChange = (ids: number[]) => {
    setEventIds(ids);
    setPreviewData(null);
    setError(null);
    setSuccess(null);
  };

  const handlePreview = async () => {
    if (eventIds.length === 0) {
      setError('Please enter at least one Event ID');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/on24/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds, preview: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch preview data');
      }

      if (data.success) {
        setPreviewData(data.data);
        if (data.errors && data.errors.length > 0) {
          setError(`Some events failed: ${data.errors.map((e: { eventId: number; error: string }) => `${e.eventId}: ${e.error}`).join(', ')}`);
        }
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPreviewData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (eventIds.length === 0) {
      setError('Please enter at least one Event ID');
      return;
    }

    setIsExporting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/on24/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate export');
      }

      // Download the CSV
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `on24-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess(`Successfully exported ${eventIds.length} event(s) to CSV`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Export Webinar Data</h1>
        <p className="text-sm text-gray-500">
          Enter Event IDs to generate a CSV export with comprehensive metrics for external agencies.
        </p>
      </div>

      {/* Event ID Input */}
      <Card>
        <CardHeader>
          <CardTitle>Event IDs</CardTitle>
        </CardHeader>
        <CardContent>
          <EventIdInput
            value={eventIds}
            onChange={handleEventIdsChange}
            placeholder="Enter Event IDs (comma-separated or one per line)&#10;&#10;Example:&#10;123456&#10;789012, 345678"
          />
          <p className="mt-3 text-sm text-gray-500">
            You can find Event IDs in your On24 dashboard URL or event settings.
          </p>
        </CardContent>
      </Card>

      {/* Alerts */}
      {error && (
        <Alert variant="error" title="Error">
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" title="Success">
          {success}
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4">
        <Button
          onClick={handlePreview}
          disabled={isLoading || eventIds.length === 0}
          isLoading={isLoading}
          variant="outline"
        >
          Preview Data
        </Button>
        <Button
          onClick={handleExport}
          disabled={isExporting || eventIds.length === 0}
          isLoading={isExporting}
        >
          Export to CSV ({eventIds.length} event{eventIds.length !== 1 ? 's' : ''})
        </Button>
      </div>

      {/* Preview Table */}
      {previewData && (
        <Card>
          <CardHeader>
            <CardTitle>Preview ({previewData.length} events)</CardTitle>
          </CardHeader>
          <CardContent>
            <ExportPreview data={previewData} />
          </CardContent>
        </Card>
      )}

      {/* Column Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Export Columns Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <ColumnReference />
        </CardContent>
      </Card>
    </div>
  );
}
