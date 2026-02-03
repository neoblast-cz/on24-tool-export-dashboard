'use client';

const EXPORT_COLUMNS = [
  { name: 'Date', type: 'Date' },
  { name: 'Campaign Name', type: 'String' },
  { name: 'Webinars Name', type: 'String' },
  { name: 'Total Registration', type: 'Number' },
  { name: 'Total Attendance', type: 'Number' },
  { name: 'Webinars Start datetime', type: 'Date' },
  { name: 'Avg minute view (Average Video Watched Time)', type: 'Number' },
  { name: 'Engagement Score', type: 'Number' },
  { name: 'Survey Responses', type: 'Number' },
  { name: 'Questions Asked', type: 'Number' },
  { name: 'Resources Downloaded', type: 'Number' },
  { name: 'User', type: 'Number' },
  { name: 'New User', type: 'Number' },
  { name: 'CTA ("I would like to be contacted")', type: 'Number' },
  { name: 'Poll Question', type: 'Number' },
  { name: 'Poll Response', type: 'Number' },
];

export function ColumnReference() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        The exported CSV will include the following {EXPORT_COLUMNS.length} columns:
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {EXPORT_COLUMNS.map((col, index) => (
          <div
            key={col.name}
            className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md text-sm"
          >
            <span className="text-gray-400 font-mono text-xs">{index + 1}.</span>
            <span className="text-gray-700">{col.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
