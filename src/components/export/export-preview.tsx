'use client';

import { WebinarSummary } from '@/types/webinar';

interface ExportPreviewProps {
  data: WebinarSummary[];
}

export function ExportPreview({ data }: ExportPreviewProps) {
  if (data.length === 0) {
    return (
      <p className="text-gray-500 text-center py-4">No data to preview</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Webinar Name</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reg</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Attend</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Avg Min</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Engagement</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Surveys</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Q&A</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row) => (
            <tr key={row.eventId} className="hover:bg-gray-50">
              <td className="px-3 py-2 whitespace-nowrap">{row.date}</td>
              <td className="px-3 py-2 whitespace-nowrap">{row.campaignName}</td>
              <td className="px-3 py-2">
                <span className="block max-w-xs truncate" title={row.webinarName}>
                  {row.webinarName}
                </span>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{row.totalRegistrations}</td>
              <td className="px-3 py-2 whitespace-nowrap">{row.totalAttendees}</td>
              <td className="px-3 py-2 whitespace-nowrap">{row.avgMinutesViewed.toFixed(1)}</td>
              <td className="px-3 py-2 whitespace-nowrap font-medium">{row.engagementScore.toFixed(1)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{row.surveyResponses}</td>
              <td className="px-3 py-2 whitespace-nowrap">{row.questionsAsked}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-gray-500">
        Showing preview with limited columns. Full export includes all 16 columns.
      </p>
    </div>
  );
}
