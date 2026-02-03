import { WebinarSummary, PerformanceRating } from '@/types/webinar';

interface RecommendationRule {
  condition: (webinar: WebinarSummary) => boolean;
  message: string;
  priority: 'high' | 'medium' | 'low';
}

const RECOMMENDATION_RULES: RecommendationRule[] = [
  // Engagement Score Rules
  {
    condition: (w) => w.engagementScore < 4,
    message: 'Consider adding more interactive elements like polls and Q&A sessions to boost engagement.',
    priority: 'high',
  },
  {
    condition: (w) => w.engagementScore >= 8,
    message: 'Excellent engagement! Analyze what worked well and replicate in future webinars.',
    priority: 'low',
  },

  // Attendance Rate Rules
  {
    condition: (w) =>
      w.totalRegistrations > 0 && w.totalAttendees / w.totalRegistrations < 0.3,
    message: 'Low attendance rate. Consider sending more reminder emails before the event.',
    priority: 'high',
  },
  {
    condition: (w) =>
      w.totalRegistrations > 0 && w.totalAttendees / w.totalRegistrations > 0.6,
    message: 'Great attendance rate! Your promotion strategy is working well.',
    priority: 'low',
  },

  // Viewing Duration Rules
  {
    condition: (w) => w.avgMinutesViewed < 15,
    message: 'Low average viewing time. Consider shorter, more focused content or better hooks at the start.',
    priority: 'medium',
  },

  // Survey Engagement
  {
    condition: (w) => w.surveyResponses < 5 && w.totalAttendees > 20,
    message: 'Low survey response rate. Make surveys shorter or offer incentives for completion.',
    priority: 'medium',
  },

  // Q&A Engagement
  {
    condition: (w) => w.questionsAsked < 3 && w.totalAttendees > 20,
    message: 'Few questions asked. Encourage Q&A participation or designate Q&A segments.',
    priority: 'medium',
  },

  // Resource Downloads
  {
    condition: (w) => w.resourcesDownloaded < w.totalAttendees * 0.1,
    message: 'Low resource downloads. Promote resources more prominently during the webinar.',
    priority: 'low',
  },

  // CTA Performance
  {
    condition: (w) => w.ctaContactRequests === 0 && w.totalAttendees > 10,
    message: 'No contact requests. Review CTA placement and messaging.',
    priority: 'high',
  },
  {
    condition: (w) => w.ctaContactRequests > w.totalAttendees * 0.05,
    message: 'Strong CTA performance! Your call-to-action is resonating with attendees.',
    priority: 'low',
  },

  // Poll Engagement
  {
    condition: (w) => w.pollResponses < w.totalAttendees * 0.5 && w.pollQuestions > 0,
    message: 'Low poll participation. Make polls more visible or announce them verbally.',
    priority: 'medium',
  },
];

export function generateRecommendations(webinar: WebinarSummary): string[] {
  return RECOMMENDATION_RULES.filter((rule) => rule.condition(webinar))
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, 3)
    .map((rule) => rule.message);
}

export function getOverallRecommendations(webinars: WebinarSummary[]): string[] {
  if (webinars.length === 0) return [];

  const recommendations: string[] = [];

  // Calculate averages
  const avgEngagement =
    webinars.reduce((sum, w) => sum + w.engagementScore, 0) / webinars.length;
  const avgAttendanceRate =
    webinars.reduce(
      (sum, w) =>
        sum + (w.totalRegistrations > 0 ? w.totalAttendees / w.totalRegistrations : 0),
      0
    ) / webinars.length;

  if (avgEngagement < 5) {
    recommendations.push(
      'Overall engagement is below average. Focus on interactive content and audience participation.'
    );
  }

  if (avgAttendanceRate < 0.4) {
    recommendations.push(
      'Attendance rates are low across webinars. Review your registration and reminder processes.'
    );
  }

  // Find patterns in poor performers
  const poorPerformers = webinars.filter((w) => w.engagementScore < 4);
  if (poorPerformers.length > webinars.length * 0.3) {
    recommendations.push(
      `${poorPerformers.length} webinars have low engagement. Consider A/B testing different formats.`
    );
  }

  // Top performer insights
  const topPerformer = webinars.reduce((best, current) =>
    current.engagementScore > best.engagementScore ? current : best
  );
  if (topPerformer.engagementScore >= 7) {
    recommendations.push(
      `"${topPerformer.webinarName}" had the highest engagement (${topPerformer.engagementScore.toFixed(1)}). Study its format for future events.`
    );
  }

  return recommendations.slice(0, 4);
}

export function calculatePerformanceRating(engagementScore: number): PerformanceRating {
  if (engagementScore >= 8) return 'excellent';
  if (engagementScore >= 6) return 'good';
  if (engagementScore >= 4) return 'average';
  return 'poor';
}

export function getPerformanceColor(rating: PerformanceRating): string {
  const colors = {
    excellent: 'text-green-600 bg-green-100',
    good: 'text-blue-600 bg-blue-100',
    average: 'text-yellow-600 bg-yellow-100',
    poor: 'text-red-600 bg-red-100',
  };
  return colors[rating];
}
