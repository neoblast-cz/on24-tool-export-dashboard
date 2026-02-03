'use client';

interface RecommendationsProps {
  recommendations: string[];
}

export function Recommendations({ recommendations }: RecommendationsProps) {
  if (recommendations.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="mt-2 text-gray-500">No recommendations at this time.</p>
        <p className="text-sm text-gray-400">Your webinars are performing well!</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {recommendations.map((recommendation, index) => (
        <li key={index} className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-xs font-medium text-blue-600">{index + 1}</span>
            </div>
          </div>
          <p className="text-sm text-gray-600">{recommendation}</p>
        </li>
      ))}
    </ul>
  );
}
