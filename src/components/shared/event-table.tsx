'use client';

import { Fragment, useState, useMemo } from 'react';

// ── Public types ──────────────────────────────────────────────────────────────

export interface ExpandedPollAnswer { answer: string; percentage: number; }
export interface ExpandedPoll { question: string; totalVotes: number; type: string; answers: ExpandedPollAnswer[]; }
export interface ExpandedSurveyQuestion { question: string; responses: number; type: string; answers: ExpandedPollAnswer[]; }
export interface ExpandedResource { name: string; uniqueDownloads: number; totalDownloads: number; }
export interface ExpandedCTA { name: string; actionType: string; totalClicks: number; uniqueClicks: number; }
export interface ExpandedPartnerRef { code: string; registrants: number; attendees: number; }

export interface EventTableRow {
  // Identity
  eventId: number;
  webinarName: string;
  displayDate: string;       // pre-formatted for display
  startDateTimeRaw?: string; // ISO for sort

  // Type
  eventType: string;
  isTest: boolean;

  // Name details
  campaignCode?: string;
  hasCampaignCode: boolean;
  tags: string[];
  speakers: { name: string; title?: string; company?: string }[];

  // Meta
  duration?: number;
  language?: string;
  category?: string;
  timezone?: string;

  // Core numbers
  registrants: number;
  attendees: number;
  engagementScore: number; // 0–10 scale

  // Engagement metrics
  qa: number;
  polls: number;
  surveys: number;
  cta?: number;
  dl: number;

  // Expanded: viewing detail
  liveAttendees?: number;
  ondemandAttendees?: number;
  noShows?: number;
  totalLiveMinutes?: number;
  totalArchiveMinutes?: number;
  totalMinutes?: number;
  avgLiveMinutes?: number;
  avgArchiveMinutes?: number;
  avgEngagementScore?: number;

  // State
  metricsLoading?: boolean;
  detailLoading?: boolean;
  hasError?: boolean;

  // Links
  audienceUrl?: string;
  reportUrl?: string;

  // Rich detail (export only)
  pollDetails?: ExpandedPoll[];
  surveyDetails?: ExpandedSurveyQuestion[];
  resourceDetails?: ExpandedResource[];
  ctaDetails?: ExpandedCTA[];
  partnerRefStats?: ExpandedPartnerRef[];

  // Actions (export only)
  onExportImage?: () => void;
  onPrint?: () => void;

  // Content
  promotionalSummary?: string;

  // Extra note (dashboard)
  expandedNote?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const getOn24EditUrl = (eventId: number) =>
  `https://wcc.on24.com/webcast/update/${eventId}`;

/** Format a numeric value, returning '—' when undefined/null. */
function fmtVal(val: number | undefined | null, decimals = 0): string {
  if (val === undefined || val === null) return '—';
  return decimals > 0 ? val.toFixed(decimals) : String(Math.round(val));
}

// ── Type badge / row color system ─────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; text: string; row: string; dot: string }> = {
  'webcast':              { bg: 'bg-emerald-50',  text: 'text-emerald-700', row: '',                               dot: 'bg-emerald-500' },
  'on demand':            { bg: 'bg-emerald-50',  text: 'text-emerald-700', row: '',                               dot: 'bg-emerald-500' },
  'live video and audio': { bg: 'bg-emerald-50',  text: 'text-emerald-700', row: '',                               dot: 'bg-emerald-500' },
  'webpage':              { bg: 'bg-orange-100',  text: 'text-orange-800',  row: 'border-l-4 border-l-orange-400', dot: 'bg-orange-400'  },
  'video':                { bg: 'bg-sky-100',     text: 'text-sky-800',     row: 'border-l-4 border-l-sky-400',    dot: 'bg-sky-400'     },
  'experience':           { bg: 'bg-pink-100',    text: 'text-pink-800',    row: 'border-l-4 border-l-pink-400',   dot: 'bg-pink-400'    },
};
const TEST_COLOR   = { bg: 'bg-amber-100',  text: 'text-amber-800',  row: 'border-l-4 border-l-amber-400',  dot: 'bg-amber-400'  };
const DEFAULT_TYPE = { bg: 'bg-violet-100', text: 'text-violet-800', row: 'border-l-4 border-l-violet-400', dot: 'bg-violet-400' };

function getTypeColor(eventType: string, isTest: boolean) {
  if (isTest) return TEST_COLOR;
  return TYPE_COLORS[(eventType || '').toLowerCase()] ?? DEFAULT_TYPE;
}

function engBadgeClass(score: number) {
  if (score >= 6) return 'bg-emerald-100 text-emerald-800';
  if (score >= 3) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-700';
}

// ── Expanded row ──────────────────────────────────────────────────────────────

function ExpandedRowContent({
  row,
  activeTagFilters,
  onTagToggle,
}: {
  row: EventTableRow;
  activeTagFilters: string[];
  onTagToggle?: (tag: string) => void;
}) {
  const [showSummary, setShowSummary] = useState(false);

  const attRate =
    row.registrants > 0
      ? `${((row.attendees / row.registrants) * 100).toFixed(0)}%`
      : '—';

  return (
    <div className="ml-8 mr-4 my-3 border-l-4 border-ansell-teal pl-4 space-y-3">
      {/* Title */}
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{row.webinarName}</h3>
        <span className="text-xs text-gray-500 font-mono shrink-0">#{row.eventId}</span>
        <span className="text-xs text-gray-500 shrink-0">{row.displayDate}</span>
      </div>

      {/* Meta + links */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
          {row.hasCampaignCode && row.campaignCode ? (
            <span className="font-mono text-ansell-teal">{row.campaignCode}</span>
          ) : (
            <a
              href={getOn24EditUrl(row.eventId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs hover:bg-amber-200 transition-colors"
              title="Click to add campaign code in On24"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Missing campaign — Add
            </a>
          )}
          {row.eventType && <span>{row.eventType}</span>}
          {row.category  && <span>{row.category}</span>}
          {row.language  && <span>{row.language}</span>}
          {row.timezone  && <span>{row.timezone}</span>}
        </div>
        <div className="flex gap-2 shrink-0">
          {row.audienceUrl && (
            <a href={row.audienceUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-ansell-teal text-white text-[11px] hover:bg-ansell-teal-dark transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Registration
            </a>
          )}
          {row.reportUrl && (
            <a href={row.reportUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-ansell-dark text-white text-[11px] hover:bg-gray-700 transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Report
            </a>
          )}
          {(row.onExportImage || row.onPrint) && (
            <span className="w-px h-4 bg-gray-300 self-center" />
          )}
          {row.onExportImage && (
            <button
              onClick={row.onExportImage}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 text-[11px] hover:bg-gray-200 transition-colors border border-gray-300"
              title="Save as image (PNG)">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Image
            </button>
          )}
          {row.onPrint && (
            <button
              onClick={row.onPrint}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 text-[11px] hover:bg-gray-200 transition-colors border border-gray-300"
              title="Print / Save as PDF">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              PDF
            </button>
          )}
        </div>
      </div>

      {/* Audience metrics */}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Audience</p>
        <div className="grid grid-cols-5 gap-1.5">
          {([
            ['Registrants', String(row.registrants)],
            ['Attendees',   String(row.attendees)],
            ['Live',        fmtVal(row.liveAttendees)],
            ['On-Demand',   fmtVal(row.ondemandAttendees)],
            ['No-Shows',    fmtVal(row.noShows)],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="bg-white px-1.5 py-1.5 border border-gray-200 text-center">
              <p className="text-sm font-semibold text-gray-800">{value}</p>
              <p className="text-[9px] text-gray-500 uppercase">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Engagement metrics */}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-ansell-teal mb-1">Engagement</p>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-1.5">
          {([
            ['Eng Score', fmtVal(row.avgEngagementScore, 1), 'rgba(0,162,143,0.05)',    'border-ansell-teal/20',  'text-ansell-teal'  ],
            ['Q&A',       String(row.qa),                   'rgba(245,158,11,0.06)',   'border-amber-200',      'text-amber-600'    ],
            ['Polls',     String(row.polls),                 'rgba(0,162,143,0.05)',    'border-ansell-teal/20',  'text-ansell-teal'  ],
            ['Surveys',   String(row.surveys),               'rgba(59,130,246,0.05)',   'border-blue-200',       'text-blue-600'     ],
            ['CTAs',      fmtVal(row.cta),                   'rgba(236,72,153,0.05)',   'border-pink-200',       'text-pink-600'     ],
            ['DL',        String(row.dl),                    'rgba(139,92,246,0.05)',   'border-violet-200',     'text-violet-600'   ],
          ] as [string, string, string, string, string][]).map(([label, value, bg, border, text]) => (
            <div key={label} className={`px-1.5 py-1.5 text-center border ${border}`} style={{ background: bg }}>
              <p className={`text-sm font-semibold ${text}`}>{value}</p>
              <p className="text-[9px] text-ansell-gray uppercase">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Viewing detail */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-1.5">
        {([
          ['Total Live Min',    fmtVal(row.totalLiveMinutes)],
          ['Total Archive Min', fmtVal(row.totalArchiveMinutes)],
          ['Total Min',         fmtVal(row.totalMinutes)],
          ['Avg Live Min',      fmtVal(row.avgLiveMinutes, 1)],
          ['Avg Archive Min',   fmtVal(row.avgArchiveMinutes, 1)],
          ['Att Rate',          attRate],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} className="bg-gray-50 px-1.5 py-1 border border-gray-100">
            <p className="text-[10px] text-gray-500">{label}</p>
            <p className="text-xs font-medium text-gray-800">{value}</p>
          </div>
        ))}
      </div>

      {/* Promotional Summary toggle */}
      {row.promotionalSummary && (
        <div>
          <button
            onClick={() => setShowSummary(s => !s)}
            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-ansell-dark transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform duration-150 ${showSummary ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Promotional Summary
          </button>
          {showSummary && (
            <div
              className="mt-1.5 bg-white border border-gray-100 px-3 py-2.5 text-[12px] text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: row.promotionalSummary }}
            />
          )}
        </div>
      )}

      {/* Speakers */}
      {row.speakers.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 uppercase mb-1">Speakers</p>
          <div className="flex flex-wrap gap-1.5">
            {row.speakers.map((speaker, i) => (
              <span key={i} className="bg-white px-2 py-1 border border-gray-200 text-xs">
                <span className="font-medium text-gray-800">{speaker.name}</span>
                {speaker.title   && <span className="text-gray-500 ml-1">{speaker.title}</span>}
                {speaker.company && <span className="text-ansell-teal ml-1">{speaker.company}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {row.tags.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 uppercase mb-1">Tags</p>
          <div className="flex flex-wrap gap-1">
            {row.tags.map((tag, i) => (
              <button key={i} onClick={() => onTagToggle?.(tag)}
                className={`px-1.5 py-0.5 text-[10px] transition-colors ${
                  activeTagFilters.includes(tag) ? 'bg-ansell-teal text-white' : 'bg-ansell-dark text-white hover:bg-ansell-teal'
                }`}
                title={activeTagFilters.includes(tag) ? `Remove "${tag}" filter` : `Filter by "${tag}"`}
              >{tag}</button>
            ))}
          </div>
        </div>
      )}

      {/* Detail loading spinner */}
      {row.detailLoading && (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
          <span className="inline-block h-3 w-3 border-2 border-ansell-teal border-t-transparent rounded-full animate-spin" />
          Loading interaction data…
        </div>
      )}

      {/* Polls & Surveys */}
      {!row.detailLoading && ((row.pollDetails && row.pollDetails.length > 0) || (row.surveyDetails && row.surveyDetails.length > 0)) && (
        <div className="grid grid-cols-2 gap-3">
          {row.pollDetails && row.pollDetails.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase mb-1">Polls ({row.pollDetails.length})</p>
              <div className="space-y-1.5">
                {row.pollDetails.map((poll, i) => (
                  <div key={i} className="bg-white p-2 border border-gray-100">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-[11px] font-medium text-gray-800">{poll.question}</p>
                      <span className="text-[9px] text-gray-500 whitespace-nowrap ml-2">{poll.totalVotes} votes</span>
                    </div>
                    <div className="space-y-0.5">
                      {poll.answers.map((a, j) => (
                        <div key={j} className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-700 w-[35%] min-w-[60px] truncate shrink-0" title={a.answer}>{a.answer}</span>
                          <div className="flex-1 bg-gray-200 h-3 overflow-hidden relative">
                            <div className="bg-ansell-teal h-full" style={{ width: `${a.percentage}%` }} />
                          </div>
                          <span className="text-[9px] text-gray-500 w-8 text-right shrink-0">{a.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {row.surveyDetails && row.surveyDetails.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase mb-1">Surveys ({row.surveyDetails.length})</p>
              <div className="space-y-1.5">
                {row.surveyDetails.map((sq, i) => (
                  <div key={i} className="bg-white p-2 border border-gray-100">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-[11px] font-medium text-gray-800">{sq.question}</p>
                      <span className="text-[9px] text-gray-500 whitespace-nowrap ml-2">{sq.responses} resp.</span>
                    </div>
                    <div className="space-y-0.5">
                      {sq.answers.map((a, j) => (
                        <div key={j} className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-700 w-[35%] min-w-[60px] truncate shrink-0" title={a.answer}>{a.answer}</span>
                          <div className="flex-1 bg-gray-200 h-3 overflow-hidden relative">
                            <div className="bg-blue-500 h-full" style={{ width: `${a.percentage}%` }} />
                          </div>
                          <span className="text-[9px] text-gray-500 w-8 text-right shrink-0">{a.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resources & CTAs */}
      {!row.detailLoading && ((row.resourceDetails && row.resourceDetails.length > 0) || (row.ctaDetails && row.ctaDetails.length > 0)) && (
        <div className="grid grid-cols-2 gap-3">
          {row.resourceDetails && row.resourceDetails.length > 0 && (() => {
            const maxDl = Math.max(...row.resourceDetails!.map(r => r.totalDownloads));
            const totalDl = row.resourceDetails!.reduce((s, r) => s + r.totalDownloads, 0);
            return (
              <div>
                <p className="text-[10px] text-gray-500 uppercase mb-1">Downloads ({row.resourceDetails!.length} resources)</p>
                <div className="bg-white p-2 border border-gray-100">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-[11px] font-medium text-gray-800">Resource downloads</p>
                    <span className="text-[9px] text-gray-500 whitespace-nowrap ml-2">{totalDl} total</span>
                  </div>
                  <div className="space-y-0.5">
                    {row.resourceDetails!.map((r, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-700 w-[35%] min-w-[60px] truncate shrink-0" title={r.name}>{r.name}</span>
                        <div className="flex-1 bg-gray-200 h-3 overflow-hidden relative">
                          <div className="bg-violet-500 h-full" style={{ width: `${maxDl > 0 ? (r.totalDownloads / maxDl) * 100 : 0}%` }} />
                        </div>
                        <span className="text-[9px] text-gray-500 w-8 text-right shrink-0">{r.totalDownloads}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
          {row.ctaDetails && row.ctaDetails.length > 0 && (() => {
            const maxClicks = Math.max(...row.ctaDetails!.map(c => c.totalClicks));
            const totalClicks = row.ctaDetails!.reduce((s, c) => s + c.totalClicks, 0);
            return (
              <div>
                <p className="text-[10px] text-gray-500 uppercase mb-1">Call to Actions ({row.ctaDetails!.length})</p>
                <div className="bg-white p-2 border border-gray-100">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-[11px] font-medium text-gray-800">CTA clicks</p>
                    <span className="text-[9px] text-gray-500 whitespace-nowrap ml-2">{totalClicks} total</span>
                  </div>
                  <div className="space-y-0.5">
                    {row.ctaDetails!.map((c, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-700 w-[35%] min-w-[60px] truncate shrink-0" title={c.name}>{c.name}</span>
                        <div className="flex-1 bg-gray-200 h-3 overflow-hidden relative">
                          <div className="bg-pink-500 h-full" style={{ width: `${maxClicks > 0 ? (c.totalClicks / maxClicks) * 100 : 0}%` }} />
                        </div>
                        <span className="text-[9px] text-gray-500 w-8 text-right shrink-0">{c.totalClicks}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Registration Sources */}
      {!row.detailLoading && row.partnerRefStats && row.partnerRefStats.length > 0 && (
        <div className="max-w-md">
          <p className="text-[10px] text-gray-500 uppercase mb-1">Registration Sources ({row.partnerRefStats.length})</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-0.5 px-1.5 font-medium text-gray-500">Source</th>
                <th className="text-right py-0.5 px-1.5 font-medium text-gray-500">Reg</th>
                <th className="text-right py-0.5 px-1.5 font-medium text-gray-500">Att</th>
                <th className="text-right py-0.5 px-1.5 font-medium text-gray-500">Conv</th>
              </tr>
            </thead>
            <tbody>
              {[...row.partnerRefStats]
                .sort((a, b) => b.registrants - a.registrants)
                .map((p, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-0.5 px-1.5 font-mono text-gray-700">{p.code}</td>
                    <td className="py-0.5 px-1.5 text-right font-medium text-gray-900">{p.registrants}</td>
                    <td className="py-0.5 px-1.5 text-right font-medium text-ansell-teal">{p.attendees}</td>
                    <td className="py-0.5 px-1.5 text-right text-gray-500">
                      {p.registrants > 0 ? `${((p.attendees / p.registrants) * 100).toFixed(0)}%` : '-'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state for events with no interaction data */}
      {!row.detailLoading &&
        row.pollDetails !== undefined &&
        row.pollDetails.length === 0 &&
        (row.surveyDetails?.length ?? 0) === 0 &&
        (row.resourceDetails?.length ?? 0) === 0 &&
        (row.ctaDetails?.length ?? 0) === 0 && (
          <p className="text-[10px] text-gray-400 italic">No interaction data (polls, surveys, downloads, CTAs)</p>
        )}

      {/* Dashboard loading / note */}
      {row.expandedNote && (
        <p className="text-[10px] text-gray-400 italic">{row.expandedNote}</p>
      )}
    </div>
  );
}

// ── Main EventTable component ─────────────────────────────────────────────────

type SortKey = 'date' | 'type' | 'name' | 'reg' | 'att' | 'eng' | 'qa' | 'polls' | 'surveys' | 'cta' | 'dl';

export interface EventTableProps {
  rows: EventTableRow[];
  activeTagFilters?: string[];
  onTagToggle?: (tag: string) => void;
  emptyMessage?: string;
  onExpand?: (eventId: number) => void;
}

export function EventTable({
  rows,
  activeTagFilters = [],
  onTagToggle,
  emptyMessage = 'No events to display',
  onExpand,
}: EventTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortArrow = ({ col }: { col: SortKey }) =>
    sortKey === col ? <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span> : null;

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    let va: number | string = 0, vb: number | string = 0;
    switch (sortKey) {
      case 'date':
        va = a.startDateTimeRaw ? new Date(a.startDateTimeRaw).getTime() : 0;
        vb = b.startDateTimeRaw ? new Date(b.startDateTimeRaw).getTime() : 0;
        break;
      case 'type':     va = a.eventType.toLowerCase(); vb = b.eventType.toLowerCase(); break;
      case 'name':     va = a.webinarName.toLowerCase(); vb = b.webinarName.toLowerCase(); break;
      case 'reg':      va = a.registrants; vb = b.registrants; break;
      case 'att':      va = a.attendees;   vb = b.attendees;   break;
      case 'eng':      va = a.engagementScore; vb = b.engagementScore; break;
      case 'qa':       va = a.qa;     vb = b.qa;     break;
      case 'polls':    va = a.polls;  vb = b.polls;  break;
      case 'surveys':  va = a.surveys; vb = b.surveys; break;
      case 'cta':      va = a.cta ?? 0; vb = b.cta ?? 0; break;
      case 'dl':       va = a.dl;     vb = b.dl;     break;
    }
    if (typeof va === 'string' && typeof vb === 'string') {
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
  }), [rows, sortKey, sortDir]);

  const toggleExpand = (id: number) => {
    const willExpand = !expandedIds.has(id);
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    if (willExpand) onExpand?.(id);
  };

  if (rows.length === 0) {
    return <p className="text-gray-500 text-center py-4">{emptyMessage}</p>;
  }

  const colSpan = 13;

  const TH = ({ k, label, align = 'right' }: { k: SortKey; label: string; align?: 'left' | 'right' }) => (
    <th
      className={`px-2 py-2 text-${align} text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none`}
      onClick={() => handleSort(k)}
    >
      {label}<SortArrow col={k} />
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          {/* Group labels */}
          <tr className="border-b border-gray-100">
            <th colSpan={4} />
            <th colSpan={2} className="px-2 py-1 text-left text-[9px] font-semibold uppercase tracking-wider text-gray-400 border-l border-gray-200">
              Audience
            </th>
            <th colSpan={6} className="px-2 py-1 text-left text-[9px] font-semibold uppercase tracking-wider text-ansell-teal border-l border-ansell-teal/20">
              Engagement
            </th>
            <th />
          </tr>
          {/* Column headers */}
          <tr>
            <TH k="type"    label="Type"    align="left" />
            <TH k="date"    label="Date"    align="left" />
            <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
            <TH k="name"    label="Webinar" align="left" />
            <TH k="reg"     label="Reg" />
            <TH k="att"     label="Att" />
            <TH k="eng"     label="Eng" />
            <TH k="qa"      label="Q&A" />
            <TH k="polls"   label="Polls" />
            <TH k="surveys" label="Surv" />
            <TH k="cta"     label="CTA" />
            <TH k="dl"      label="DL" />
            <th className="px-2 py-2 w-8" />
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sorted.map(row => {
            const isExpanded    = expandedIds.has(row.eventId);
            const colors        = getTypeColor(row.eventType, row.isTest);
            const isWebinarType = ['webcast', 'on demand', 'live video and audio'].includes(row.eventType.toLowerCase());
            const needsAccent   = row.isTest || !isWebinarType;
            const loading       = row.metricsLoading ?? false;

            return (
              <Fragment key={row.eventId}>
                <tr className={`hover:bg-gray-50 ${row.hasError ? 'bg-red-50' : ''} ${isExpanded ? 'bg-ansell-teal/5' : ''} ${needsAccent ? colors.row : ''}`}>
                  {/* Type badge */}
                  <td className="px-2 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 ${colors.bg} ${colors.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                      {row.isTest ? 'test' : (row.eventType || '?')}
                    </span>
                  </td>
                  {/* Date */}
                  <td className="px-2 py-2 text-gray-600 whitespace-nowrap text-xs">{row.displayDate}</td>
                  {/* ID */}
                  <td className="px-2 py-2 text-gray-500 font-mono text-xs">
                    <a href={getOn24EditUrl(row.eventId)} target="_blank" rel="noopener noreferrer"
                      className="hover:text-blue-600 hover:underline" title="Open in On24">
                      {row.eventId}
                    </a>
                  </td>
                  {/* Name + campaign + tags */}
                  <td className="px-2 py-2 max-w-[260px]">
                    <div className="text-gray-900 truncate text-sm" title={row.webinarName}>
                      {row.webinarName || `Event ${row.eventId}`}
                    </div>
                    {row.hasCampaignCode && row.campaignCode ? (
                      <div className="text-[10px] text-gray-500 font-mono truncate">{row.campaignCode}</div>
                    ) : (
                      <a href={getOn24EditUrl(row.eventId)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 hover:text-amber-900"
                        title="Missing campaign code — click to add in On24">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Missing campaign
                      </a>
                    )}
                    {row.tags.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {row.tags.map((tag, i) => (
                          <button key={i}
                            onClick={e => { e.stopPropagation(); onTagToggle?.(tag); }}
                            className={`px-1 py-0 text-[9px] leading-tight transition-colors ${
                              activeTagFilters.includes(tag) ? 'bg-ansell-teal text-white' : 'bg-ansell-dark text-white hover:bg-ansell-teal'
                            }`}
                            title={activeTagFilters.includes(tag) ? `Remove "${tag}" filter` : `Filter by "${tag}"`}
                          >{tag}</button>
                        ))}
                      </div>
                    )}
                  </td>
                  {/* Reg */}
                  <td className="px-2 py-2 text-right text-xs text-gray-600 border-l border-gray-200">{row.registrants}</td>
                  {/* Att */}
                  <td className="px-2 py-2 text-right text-xs text-gray-600">{row.attendees}</td>
                  {/* Eng */}
                  <td className="px-2 py-2 text-right border-l border-ansell-teal/20">
                    {loading ? (
                      <span className="text-xs text-gray-300">·</span>
                    ) : (
                      <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium ${engBadgeClass(row.engagementScore)}`}>
                        {row.engagementScore.toFixed(1)}
                      </span>
                    )}
                  </td>
                  {/* Q&A */}
                  <td className="px-2 py-2 text-right text-xs text-gray-600">
                    {loading ? <span className="text-gray-300">·</span> : row.qa}
                  </td>
                  {/* Polls */}
                  <td className="px-2 py-2 text-right text-xs text-gray-600">
                    {loading ? <span className="text-gray-300">·</span> : row.polls}
                  </td>
                  {/* Surv */}
                  <td className="px-2 py-2 text-right text-xs text-gray-600">
                    {loading ? <span className="text-gray-300">·</span> : row.surveys}
                  </td>
                  {/* CTA */}
                  <td className="px-2 py-2 text-right text-xs text-gray-600">
                    {row.cta === undefined ? <span className="text-gray-300">—</span> : row.cta}
                  </td>
                  {/* DL */}
                  <td className="px-2 py-2 text-right text-xs text-gray-600">
                    {loading ? <span className="text-gray-300">·</span> : row.dl}
                  </td>
                  {/* Expand */}
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => toggleExpand(row.eventId)}
                      className="p-1 hover:bg-gray-200 transition-colors"
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      <svg
                        className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={colSpan} className="p-0 bg-gray-50/50">
                      <div id={`event-details-${row.eventId}`}>
                        <ExpandedRowContent
                          row={row}
                          activeTagFilters={activeTagFilters}
                          onTagToggle={onTagToggle}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
