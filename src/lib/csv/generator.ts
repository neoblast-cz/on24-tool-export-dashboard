import { WebinarSummary } from '@/types/webinar';

const CSV_COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'campaignName', header: 'Campaign Name' },
  { key: 'webinarName', header: 'Webinars Name' },
  { key: 'totalRegistrations', header: 'Total Registration' },
  { key: 'totalAttendees', header: 'Total Attendance' },
  { key: 'startDateTime', header: 'Webinars Start datetime' },
  { key: 'avgMinutesViewed', header: 'Avg minute view (Average Video Watched Time)' },
  { key: 'engagementScore', header: 'Engagement Score' },
  { key: 'surveyResponses', header: 'Survey Responses' },
  { key: 'questionsAsked', header: 'Questions Asked' },
  { key: 'resourcesDownloaded', header: 'Resources Downloaded' },
  { key: 'uniqueUsers', header: 'User' },
  { key: 'newUsers', header: 'New User' },
  { key: 'ctaContactRequests', header: 'CTA ("I would like to be contacted")' },
  { key: 'pollQuestions', header: 'Poll Question' },
  { key: 'pollResponses', header: 'Poll Response' },
] as const;

function escapeCSVValue(value: string | number | boolean): string {
  const stringValue = String(value);
  // Escape quotes by doubling them and wrap in quotes if needed
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function generateCSV(data: WebinarSummary[]): string {
  // Header row
  const headerRow = CSV_COLUMNS.map((col) => escapeCSVValue(col.header)).join(',');

  // Data rows
  const dataRows = data.map((webinar) => {
    return CSV_COLUMNS.map((col) => {
      const value = webinar[col.key as keyof WebinarSummary];
      if (value === undefined || value === null) {
        return '';
      }
      if (Array.isArray(value)) {
        return escapeCSVValue(value.join('; '));
      }
      return escapeCSVValue(value);
    }).join(',');
  });

  // Add BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF';
  return BOM + [headerRow, ...dataRows].join('\n');
}

export function getCSVColumns(): typeof CSV_COLUMNS {
  return CSV_COLUMNS;
}

// Client-side download helper
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
