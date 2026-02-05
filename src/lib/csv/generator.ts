import { WebinarSummary } from '@/types/webinar';

export interface CSVColumn {
  key: string;
  header: string;
  description?: string;
  defaultSelected?: boolean;
}

// All available columns for export
export const ALL_CSV_COLUMNS: CSVColumn[] = [
  // Core fields
  { key: 'eventId', header: 'Event ID', description: 'On24 Event ID', defaultSelected: true },
  { key: 'date', header: 'Date', description: 'Webinar date', defaultSelected: true },
  { key: 'campaignName', header: 'Campaign Name', description: 'Campaign code/name', defaultSelected: true },
  { key: 'webinarName', header: 'Webinar Name', description: 'Webinar title', defaultSelected: true },
  { key: 'description', header: 'Description', description: 'Webinar description', defaultSelected: false },
  { key: 'startDateTime', header: 'Start DateTime', description: 'Full start date and time', defaultSelected: true },
  // Event details
  { key: 'eventType', header: 'Event Type', description: 'Type of event', defaultSelected: false },
  { key: 'status', header: 'Event Status', description: 'Live/On-demand/Upcoming', defaultSelected: false },
  { key: 'language', header: 'Language', description: 'Webinar language', defaultSelected: false },
  { key: 'duration', header: 'Duration (min)', description: 'Duration in minutes', defaultSelected: false },
  { key: 'timezone', header: 'Timezone', description: 'Event timezone', defaultSelected: false },
  { key: 'tags', header: 'Tags', description: 'Event tags', defaultSelected: false },
  // Metrics
  { key: 'totalRegistrations', header: 'Total Registrations', description: 'Number of registrations', defaultSelected: true },
  { key: 'totalAttendees', header: 'Total Attendees', description: 'Number of attendees', defaultSelected: true },
  { key: 'attendanceRate', header: 'Attendance Rate %', description: 'Attendees / Registrations', defaultSelected: true },
  { key: 'avgMinutesViewed', header: 'Avg Minutes Viewed', description: 'Average viewing time in minutes', defaultSelected: true },
  { key: 'engagementScore', header: 'Engagement Score', description: 'Average engagement score (0-10)', defaultSelected: true },
  { key: 'uniqueUsers', header: 'Unique Users', description: 'Unique users/viewers', defaultSelected: true },
  { key: 'newUsers', header: 'New Users', description: 'New users count', defaultSelected: false },
  // Interaction metrics
  { key: 'surveyResponses', header: 'Survey Responses', description: 'Number of survey responses', defaultSelected: true },
  { key: 'questionsAsked', header: 'Questions Asked', description: 'Number of Q&A questions', defaultSelected: true },
  { key: 'resourcesDownloaded', header: 'Resources Downloaded', description: 'Number of resource downloads', defaultSelected: true },
  { key: 'ctaContactRequests', header: 'CTA Contact Requests', description: 'Contact CTA clicks', defaultSelected: true },
  { key: 'pollQuestions', header: 'Poll Questions', description: 'Number of poll questions', defaultSelected: false },
  { key: 'pollResponses', header: 'Poll Responses', description: 'Total poll responses', defaultSelected: false },
  // Status & flags
  { key: 'performanceRating', header: 'Performance Rating', description: 'Rating (excellent/good/average/poor)', defaultSelected: false },
  { key: 'workStatus', header: 'Work Status', description: 'Needs attention if missing campaign/test', defaultSelected: true },
  { key: 'isTest', header: 'Is Test', description: 'Whether this is a test webinar', defaultSelected: false },
  { key: 'hasCampaignCode', header: 'Has Campaign Code', description: 'Whether campaign code is set', defaultSelected: false },
  // Links
  { key: 'on24Url', header: 'On24 Edit URL', description: 'Direct link to edit in On24', defaultSelected: false },
];

// Default columns (for backward compatibility)
const DEFAULT_COLUMNS = ALL_CSV_COLUMNS.filter(c => c.defaultSelected).map(c => c.key);

function escapeCSVValue(value: string | number | boolean): string {
  const stringValue = String(value);
  // Escape quotes by doubling them and wrap in quotes if needed
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

// Get value for a column (including computed fields)
function getColumnValue(webinar: WebinarSummary, key: string): string | number | boolean {
  switch (key) {
    case 'on24Url':
      return `https://wcc.on24.com/webcast/update/${webinar.eventId}`;
    case 'attendanceRate':
      if (webinar.totalRegistrations > 0) {
        return ((webinar.totalAttendees / webinar.totalRegistrations) * 100).toFixed(1);
      }
      return '0.0';
    case 'workStatus':
      const issues: string[] = [];
      if (webinar.isTest) issues.push('Test webinar');
      if (!webinar.hasCampaignCode) issues.push('Missing campaign code');
      return issues.length > 0 ? issues.join('; ') : 'OK';
    default:
      const value = webinar[key as keyof WebinarSummary];
      if (value === undefined || value === null) {
        return '';
      }
      if (Array.isArray(value)) {
        return value.join('; ');
      }
      return value as string | number | boolean;
  }
}

export function generateCSV(data: WebinarSummary[], selectedColumns?: string[]): string {
  // Use selected columns or default
  const columnKeys = selectedColumns || DEFAULT_COLUMNS;
  const columns = columnKeys
    .map(key => ALL_CSV_COLUMNS.find(c => c.key === key))
    .filter((c): c is CSVColumn => c !== undefined);

  // Header row
  const headerRow = columns.map((col) => escapeCSVValue(col.header)).join(',');

  // Data rows
  const dataRows = data.map((webinar) => {
    return columns.map((col) => {
      const value = getColumnValue(webinar, col.key);
      return escapeCSVValue(value);
    }).join(',');
  });

  // Add BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF';
  return BOM + [headerRow, ...dataRows].join('\n');
}

export function getCSVColumns(): CSVColumn[] {
  return ALL_CSV_COLUMNS;
}

export function getDefaultSelectedColumns(): string[] {
  return DEFAULT_COLUMNS;
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
