'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useWebinarStore } from '@/store/webinar-store';
import { WebinarSummary, AttendeeMetrics } from '@/types/webinar';
import { Card } from '@/components/ui/card';
import type { RevenueData, ProgramRevenue } from '@/app/api/revenue/data/route';

// ── Data accessors ─────────────────────────────────────────────────────────────

function getReg(w: WebinarSummary)    { return w.eventAnalytics?.totalRegistrants ?? w.totalRegistrations ?? 0; }
function getAtt(w: WebinarSummary)    {
  const am = w.attendeeMetrics;
  return am?.loaded ? am.attendeeCount : (w.eventAnalytics?.totalAttendees ?? w.totalAttendees ?? 0);
}
function getAttRate(w: WebinarSummary) { const r = getReg(w), a = getAtt(w); return r > 0 ? a / r : 0; }
function getEng(w: WebinarSummary)    { const am = w.attendeeMetrics; return am?.loaded ? am.avgEngagementScore : w.engagementScore; }
function getQA(w: WebinarSummary)     { return w.attendeeMetrics?.loaded ? w.attendeeMetrics.totalQuestionsAsked : 0; }
function getPolls(w: WebinarSummary)  { return w.attendeeMetrics?.loaded ? w.attendeeMetrics.totalPollsAnswered : 0; }
function getSurveys(w: WebinarSummary){ return w.attendeeMetrics?.loaded ? w.attendeeMetrics.totalSurveysAnswered : 0; }
function getDL(w: WebinarSummary)     {
  const am = w.attendeeMetrics;
  return am?.loaded ? am.totalResourcesDownloaded : (w.eventAnalytics?.uniqueAttendeeResourceDownloads ?? w.resourcesDownloaded ?? 0);
}
function getReactions(w: WebinarSummary) { return w.attendeeMetrics?.loaded ? (w.attendeeMetrics.totalReactions ?? 0) : 0; }
function getNoShow(w: WebinarSummary) { return w.eventAnalytics?.noShowCount ?? 0; }
function getLiveMin(w: WebinarSummary) {
  const am = w.attendeeMetrics;
  return am?.loaded ? am.totalLiveMinutes : (w.eventAnalytics?.totalCumulativeLiveMinutes ?? 0);
}
function getArchiveMin(w: WebinarSummary) {
  const am = w.attendeeMetrics;
  return am?.loaded ? am.totalArchiveMinutes : (w.eventAnalytics?.totalCumulativeArchiveMinutes ?? 0);
}

function truncate(s: string, n = 60) { return s.length > n ? s.slice(0, n) + '…' : s; }
function fmtPct(rate: number)         { return `${Math.round(rate * 100)}%`; }
function fmtNum(n: number)            { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)); }
function fmtEng(n: number)            { return n.toFixed(1); }

const METRICS_BATCH = 20;

// Event types considered valid for analysis (same as dashboard)
const ANALYSIS_TYPES = new Set(['webcast', 'on demand', 'live video and audio']);

// ── Source normalisation + decoding ───────────────────────────────────────────

// Exact-match aliases → canonical key
const CANONICAL: Record<string, string> = {
  '': 'direct', direct: 'direct', '(direct)': 'direct',
  ln: 'linkedin', lk: 'linkedin', linkedin: 'linkedin',
  // LinkedIn campaign variants
  acorn_li: 'linkedin',
  post1_li_org: 'linkedin', post2_li_org: 'linkedin', post3_li_org: 'linkedin',
  post1_li_paid: 'linkedin', post2_li_paid: 'linkedin', post3_li_paid: 'linkedin',
  anz_li_post1: 'linkedin', anz_li_post2: 'linkedin', anz_li_post3: 'linkedin', anz_li_post4: 'linkedin',
  fb: 'facebook', facebook: 'facebook',
  // Facebook campaign variants
  acorn_fb: 'facebook',
  anz_fb_post1: 'facebook', anz_fb_post2: 'facebook', anz_fb_post3: 'facebook', anz_fb_post4: 'facebook',
  // Email routes through Marketo
  em: 'marketo', email: 'marketo', on_demand_nurture: 'marketo', ondemandmarketo: 'marketo',
  tw: 'twitter',  twitter: 'twitter', x: 'twitter',
  ig: 'instagram', instagram: 'instagram',
  yt: 'youtube',  youtube: 'youtube',
  gg: 'google',   ggl: 'google', google: 'google',
  org: 'organic', organic: 'organic',
  web: 'website', website: 'website',
  // Blog posts
  blogpostanc1: 'blog', blogpostanc2: 'blog',
  // Distributors
  fastenal: 'distributor', sibsa: 'distributor', dist_cust_inv: 'distributor',
  vinssa: 'distributor', redpanda: 'distributor', rayhsa: 'distributor',
  munseg: 'distributor', ohsbanners: 'distributor',
  dist_email_marketo_: 'distributor', pei_dist_email_invite: 'distributor',
};

// Prefix → canonical (longest prefixes first to avoid false positives)
const PREFIX_MAP: [string, string][] = [
  ['salesforce', 'salesforce'], ['instagram',  'instagram'],
  ['facebook',   'facebook'],  ['linkedin',   'linkedin'],
  ['marketo',    'marketo'],   ['hubspot',    'hubspot'],
  ['pardot',     'pardot'],    ['eloqua',     'eloqua'],
  ['twitter',    'twitter'],   ['youtube',    'youtube'],
  ['organic',    'organic'],   ['website',    'website'],
  ['google',     'google'],    ['email',      'marketo'],
  ['blog',       'blog'],
  // EMEA regional social codes (hyphens normalised to underscores)
  ['emea_li', 'linkedin'],
  ['emea_fb', 'facebook'],
  ['ln', 'linkedin'], ['lk', 'linkedin'],
  ['fb', 'facebook'],
  ['ig', 'instagram'],
  ['yt', 'youtube'],
  ['tw', 'twitter'],
  // 'em' removed from prefix list — handled by CANONICAL exact match only,
  // so it no longer greedily catches emea_* codes
  ['gg', 'google'],
];

// Canonical key → human-readable label
const SOURCE_DISPLAY: Record<string, string> = {
  linkedin: 'LinkedIn', facebook: 'Facebook', email: 'Email',
  twitter: 'Twitter / X', instagram: 'Instagram', youtube: 'YouTube',
  google: 'Google', organic: 'Organic', website: 'Website', direct: 'Direct',
  marketo: 'Marketo', hubspot: 'HubSpot', salesforce: 'Salesforce',
  pardot: 'Pardot', eloqua: 'Eloqua',
  distributor: 'Distributor', blog: 'Blog',
};

/** Strip trailing punctuation, lowercase, try exact match then prefix match */
function normalizeSourceCode(raw: string): string {
  const cleaned = raw.trim().replace(/[?!.]+$/, '').toLowerCase().replace(/[\s\-]+/g, '_');
  if (CANONICAL[cleaned] !== undefined) return CANONICAL[cleaned];
  for (const [prefix, canonical] of PREFIX_MAP) {
    if (cleaned.startsWith(prefix)) return canonical;
  }
  return cleaned;
}

/** Return a human-readable label for any raw or canonical code */
function decodeSource(code: string): string {
  const canonical = normalizeSourceCode(code);
  return SOURCE_DISPLAY[canonical] ?? SOURCE_DISPLAY[code.toLowerCase()] ?? code;
}

/** Green ≥50%, amber ≥35%, red below */
function attRateColor(rate: number): string {
  if (rate >= 0.5) return '#059669';
  if (rate >= 0.35) return '#D97706';
  return '#DC2626';
}

interface MergedSource {
  code: string; registrants: number; attendees: number;
  qa: number; dl: number; polls: number; surveys: number;
  reactions: number; reactionsByType: Record<string, number>;
  subSources: RegSource[];
  utmSubs?: RegSource[];  // auto mode: entries from utm_source breakdown
  refSubs?: RegSource[];  // auto mode: entries from partnerref breakdown
}

/** Merge raw API sources: group by canonical key, store per-sub stats, separate "no source" */
function mergeSources(raw: RegSource[]): {
  tracked: MergedSource[];
  directReg: number;
  directAtt: number;
} {
  const map = new Map<string, { registrants: number; attendees: number; qa: number; dl: number; polls: number; surveys: number; reactions: number; reactionsByType: Record<string, number>; subSources: RegSource[] }>();
  let directReg = 0, directAtt = 0;
  for (const s of raw) {
    const key = normalizeSourceCode(s.code);
    if (key === 'direct') { directReg += s.registrants; directAtt += s.attendees; continue; }
    const entry = map.get(key) || { registrants: 0, attendees: 0, qa: 0, dl: 0, polls: 0, surveys: 0, reactions: 0, reactionsByType: {} as Record<string,number>, subSources: [] };
    entry.registrants += s.registrants;
    entry.attendees   += s.attendees;
    entry.qa          += s.qa ?? 0;
    entry.dl          += s.dl ?? 0;
    entry.polls       += s.polls ?? 0;
    entry.surveys     += s.surveys ?? 0;
    entry.reactions   += s.reactions ?? 0;
    for (const [t, c] of Object.entries(s.reactionsByType ?? {})) {
      entry.reactionsByType[t] = (entry.reactionsByType[t] || 0) + c;
    }
    entry.subSources.push({ code: s.code, registrants: s.registrants, attendees: s.attendees });
    map.set(key, entry);
  }
  const tracked = Array.from(map.entries())
    .map(([code, c]) => ({ code, registrants: c.registrants, attendees: c.attendees, qa: c.qa, dl: c.dl, polls: c.polls, surveys: c.surveys, reactions: c.reactions, reactionsByType: c.reactionsByType, subSources: c.subSources }))
    .sort((a, b) => b.registrants - a.registrants);
  return { tracked, directReg, directAtt };
}

// ── InfoTip ────────────────────────────────────────────────────────────────────

function InfoTip({ text }: { text: string }) {
  return (
    <div className="relative group inline-block">
      <div className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 text-[8px] font-bold flex items-center justify-center cursor-help hover:bg-ansell-teal hover:text-white transition-colors select-none leading-none">
        i
      </div>
      <div className="absolute left-0 top-5 z-50 w-64 bg-gray-900 text-white text-[10px] leading-relaxed px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl" style={{ minWidth: '220px' }}>
        <div className="absolute -top-1 left-1.5 w-2 h-2 bg-gray-900 rotate-45" />
        {text}
      </div>
    </div>
  );
}

// ── Visual primitives ──────────────────────────────────────────────────────────

function SectionLabel({ children, tip }: { children: React.ReactNode; tip?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ansell-gray">{children}</p>
      {tip && <InfoTip text={tip} />}
    </div>
  );
}

function InsightCallout({ label, value, sub, accent, tip, benchmark }: {
  label: string; value: string; sub?: string;
  accent: 'blue' | 'teal' | 'gray' | 'purple' | 'amber' | 'violet';
  tip?: string;
  benchmark?: { ours: number; reference: number; refLabel: string };
}) {
  const colors = { blue: '#0063AC', teal: '#00A28F', gray: '#75787B', purple: '#7030A0', amber: '#D97706', violet: '#7C3AED' };
  const bm = benchmark && benchmark.reference > 0 && benchmark.ours > 0 ? benchmark : null;
  const bmAbove = bm ? bm.ours >= bm.reference : false;
  const bmPct   = bm ? Math.round(Math.abs(bm.ours / bm.reference - 1) * 100) : 0;
  return (
    <Card accent={accent} className="px-4 py-3">
      <div className="flex items-start justify-between gap-1 mb-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-ansell-gray leading-tight">{label}</p>
        {tip && <InfoTip text={tip} />}
      </div>
      <p className="text-[22px] font-bold leading-tight" style={{ color: colors[accent] }}>{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{sub}</p>}
      {bm && (
        <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-gray-100">
          <span className={`text-[9px] font-bold ${bmAbove ? 'text-emerald-600' : 'text-red-500'}`}>
            {bmAbove ? '▲' : '▼'} {bmAbove ? '+' : '-'}{bmPct}%
          </span>
          <span className="text-[9px] text-gray-400">vs {bm.refLabel}</span>
        </div>
      )}
    </Card>
  );
}

const REACTION_COLORS: Record<string, string> = {
  like:      '#3B82F6',
  heart:     '#EF4444',
  celebrate: '#F59E0B',
  clap:      '#F59E0B',
  laugh:     '#10B981',
  wow:       '#8B5CF6',
  surprised: '#8B5CF6',
};
const REACTION_EMOJI: Record<string, string> = {
  like: '👍', heart: '❤️', celebrate: '🎉', clap: '👏', laugh: '😄', wow: '😮', surprised: '😮',
};

function StackedReactionBar({ byType, total }: { byType: Record<string, number>; total: number }) {
  if (total === 0) return null;
  const entries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  return (
    <div className="mt-1">
      <div className="flex h-1.5 w-full overflow-hidden">
        {entries.map(([type, count]) => (
          <div key={type} className="h-full" title={`${REACTION_EMOJI[type] ?? type}: ${count}`}
            style={{ width: `${(count / total) * 100}%`, backgroundColor: REACTION_COLORS[type] ?? '#94A3B8' }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-2 mt-0.5">
        {entries.slice(0, 4).map(([type, count]) => (
          <span key={type} className="text-[8px] text-gray-400">
            <span style={{ color: REACTION_COLORS[type] ?? '#94A3B8' }}>■</span> {REACTION_EMOJI[type] ?? type} {count}
          </span>
        ))}
      </div>
    </div>
  );
}

function EventNamePopover({ eventId, name, campaignName, display }: {
  eventId: number; name: string; campaignName: string; display: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };
  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <button onClick={e => { e.stopPropagation(); copy(text, id); }}
      className="shrink-0 text-gray-300 hover:text-ansell-teal transition-colors ml-1"
      title="Copy to clipboard">
      {copied === id
        ? <span className="text-[8px] text-emerald-600 font-semibold">✓</span>
        : <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path d="M8 2a2 2 0 00-2 2v1H5a2 2 0 00-2 2v9a2 2 0 002 2h8a2 2 0 002-2v-1h1a2 2 0 002-2V7l-4-5H8zm0 2h5l3 4v7h-1V7a2 2 0 00-2-2H8V4zM5 7h8v10H5V7z"/></svg>}
    </button>
  );
  return (
    <div className="relative inline-block max-w-full" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="text-left w-full hover:text-ansell-blue transition-colors" title={name}>
        {display}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 shadow-lg p-3 w-72 text-[11px]" style={{ minWidth: '220px' }}>
          <div className="absolute -top-1 left-3 w-2 h-2 bg-white border-l border-t border-gray-200 rotate-45" />
          <div className="flex items-start gap-1 mb-2">
            <p className="font-semibold text-gray-800 leading-snug flex-1">{name}</p>
            <CopyBtn text={name} id="name" />
          </div>
          {campaignName && (
            <div className="flex items-center gap-1 pt-1.5 border-t border-gray-100">
              <span className="text-[9px] uppercase tracking-wide text-gray-400 shrink-0">Campaign</span>
              <span className="text-gray-600 font-mono text-[10px] flex-1 truncate">{campaignName}</span>
              <CopyBtn text={campaignName} id="campaign" />
            </div>
          )}
          <div className="flex items-center gap-1 pt-1.5 border-t border-gray-100 mt-1.5">
            <span className="text-[9px] uppercase tracking-wide text-gray-400 shrink-0">Event ID</span>
            <span className="text-gray-600 font-mono text-[10px]">{eventId}</span>
            <CopyBtn text={String(eventId)} id="id" />
          </div>
        </div>
      )}
    </div>
  );
}

function HBar({ label, labelTitle, value, max, color, sub, suffix = '' }: {
  label: React.ReactNode; labelTitle?: string; value: number; max: number; color: string; sub?: string; suffix?: string;
}) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const display = suffix === '%' ? fmtPct(value) : Number.isInteger(value) ? fmtNum(value) : value.toFixed(2);
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="text-[11px] text-gray-800 truncate max-w-[65%]" title={labelTitle}>{label}</span>
        <span className="text-[11px] font-semibold shrink-0 ml-1" style={{ color }}>{display}{suffix !== '%' ? suffix : ''}</span>
      </div>
      <div className="h-1.5 bg-gray-100 w-full overflow-hidden">
        <div className="h-full" style={{ width: `${w}%`, backgroundColor: color }} />
      </div>
      {sub && <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">{sub}</p>}
    </div>
  );
}

function DistributionBar({ segments }: {
  segments: { label: string; count: number; pct: number; color: string }[];
}) {
  return (
    <div>
      <div className="flex h-5 w-full overflow-hidden mb-2">
        {segments.filter(s => s.pct > 0).map(s => (
          <div key={s.label} style={{ width: `${s.pct}%`, backgroundColor: s.color }}
            className="flex items-center justify-center"
            title={`${s.label}: ${s.count} (${Math.round(s.pct)}%)`}>
            {s.pct >= 9 && <span className="text-[9px] font-bold text-white">{Math.round(s.pct)}%</span>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-[10px] text-gray-600">{s.label} <strong className="text-gray-800">{s.count}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CrossFinding({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-[15px] shrink-0 leading-none mt-0.5">{icon}</span>
      <p className="text-[11px] text-gray-700 leading-relaxed">{text}</p>
    </div>
  );
}

function PageSectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-ansell-gray">{children}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

// ── Registration sources ───────────────────────────────────────────────────────

interface RegSource { code: string; registrants: number; attendees: number; qa?: number; dl?: number; polls?: number; surveys?: number; reactions?: number; reactionsByType?: Record<string, number>; }

type SourceField = 'auto' | 'partnerref' | 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content';
type BreakdownEntry = { sources: RegSource[]; coverage: number };

function ExpandableSourceBar({ source, maxReg, expanded, onToggle }: {
  source: MergedSource; maxReg: number; expanded: boolean; onToggle: () => void;
}) {
  const { registrants, attendees, subSources, utmSubs, refSubs } = source;
  const label    = decodeSource(source.code);
  const rate     = registrants > 0 ? attendees / registrants : 0;
  const barColor = attRateColor(rate);
  const totalW   = maxReg > 0 ? Math.min(100, (registrants / maxReg) * 100) : 0;
  const attW     = rate * totalW;
  const noAttW   = totalW - attW;
  const attRate  = Math.round(rate * 100);

  // In auto mode: expanded view shows utm + ref breakdown separately
  const hasAutoSubs = (utmSubs?.length ?? 0) > 0 || (refSubs?.length ?? 0) > 0;
  const allExpanded = hasAutoSubs ? [...(utmSubs ?? []), ...(refSubs ?? [])] : subSources;
  const hasMulti    = allExpanded.length > 1;
  const subMax      = hasMulti ? Math.max(...allExpanded.map(s => s.registrants)) : 1;

  const renderSubRow = (sub: RegSource) => {
    const subRate  = sub.registrants > 0 ? sub.attendees / sub.registrants : 0;
    const subColor = attRateColor(subRate);
    const sw  = subMax > 0 ? Math.min(100, (sub.registrants / subMax) * 100) : 0;
    const saW = subRate * sw;
    const snW = sw - saW;
    const sr  = Math.round(subRate * 100);
    return (
      <div key={sub.code}>
        <div className="flex items-baseline justify-between mb-0.5">
          <span className="text-[10px] text-gray-500 font-mono truncate max-w-[65%]">{sub.code}</span>
          <span className="text-[10px] text-gray-500 shrink-0 ml-1">{fmtNum(sub.registrants)} reg</span>
        </div>
        <div className="h-1.5 bg-gray-100 w-full flex overflow-hidden">
          <div className="h-full" style={{ width: `${saW}%`, backgroundColor: subColor }} />
          <div className="h-full" style={{ width: `${snW}%`, backgroundColor: subColor, opacity: 0.2 }} />
        </div>
        <p className="text-[8px] text-gray-400 mt-0.5">
          {fmtNum(sub.attendees)} att ·{' '}
          <span className="font-semibold" style={{ color: subColor }}>{sr}% att rate</span>
        </p>
      </div>
    );
  };

  return (
    <div className="mb-3 last:mb-0">
      {/* Header row */}
      <div
        className={`flex items-center justify-between mb-0.5 ${hasMulti ? 'cursor-pointer select-none' : ''}`}
        onClick={hasMulti ? onToggle : undefined}
      >
        <span className="flex items-center gap-1 text-[11px] text-gray-800 truncate max-w-[62%]" title={label}>
          {hasMulti && (
            <svg className={`w-3 h-3 shrink-0 text-gray-400 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          {label}
        </span>
        <span className="text-[11px] font-semibold text-ansell-blue shrink-0 ml-1">{fmtNum(registrants)} reg</span>
      </div>
      {/* Group bar */}
      <div className="h-2 bg-gray-100 w-full flex overflow-hidden">
        <div className="h-full" style={{ width: `${attW}%`,   backgroundColor: barColor }} />
        <div className="h-full" style={{ width: `${noAttW}%`, backgroundColor: barColor, opacity: 0.2 }} />
      </div>
      <p className="text-[9px] text-gray-400 mt-0.5">
        {fmtNum(attendees)} attended ·{' '}
        <span className="font-semibold" style={{ color: barColor }}>{attRate}% att rate</span>
        {hasMulti && !expanded && <span className="ml-1 text-gray-300">· click to expand</span>}
      </p>
      {/* Expanded sub-codes */}
      {expanded && hasMulti && (
        <div className="mt-2 pl-4 border-l-2 border-gray-100 space-y-2">
          {hasAutoSubs ? (
            <>
              {utmSubs && utmSubs.length > 0 && (
                <>
                  {refSubs && refSubs.length > 0 && (
                    <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400 mb-1">UTM Source</p>
                  )}
                  {utmSubs.map(renderSubRow)}
                </>
              )}
              {refSubs && refSubs.length > 0 && (
                <>
                  {utmSubs && utmSubs.length > 0 && (
                    <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400 mb-1 mt-2">Partner Ref</p>
                  )}
                  {refSubs.map(renderSubRow)}
                </>
              )}
            </>
          ) : (
            [...subSources].sort((a, b) => b.registrants - a.registrants).map(renderSubRow)
          )}
        </div>
      )}
    </div>
  );
}

function RegistrationSources({ sources, status, totalReg, totalAtt, sourceField, breakdowns }: {
  sources: RegSource[];
  status: 'idle' | 'loading' | 'done' | 'error';
  totalReg: number;
  totalAtt: number;
  sourceField: SourceField;
  breakdowns: Partial<Record<SourceField, BreakdownEntry>>;
}) {
  const { tracked, directReg, directAtt } = useMemo(() => mergeSources(sources), [sources]);

  // In auto mode: enrich each canonical group with sub-codes from both utm_source and partnerref
  const enrichedTracked = useMemo(() => {
    if (sourceField !== 'auto') return tracked;
    const utmSources = breakdowns.utm_source?.sources ?? [];
    const refSources = breakdowns.partnerref?.sources ?? [];
    return tracked.map(item => {
      const utmSubs = utmSources
        .filter(s => normalizeSourceCode(s.code) === item.code)
        .sort((a, b) => b.registrants - a.registrants);
      const refSubs = refSources
        .filter(s => normalizeSourceCode(s.code) === item.code && s.code !== '(direct)')
        .sort((a, b) => b.registrants - a.registrants);
      return {
        ...item,
        utmSubs: utmSubs.length > 0 ? utmSubs : undefined,
        refSubs: refSubs.length > 0 ? refSubs : undefined,
      };
    });
  }, [tracked, sourceField, breakdowns]);

  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const maxReg       = Math.max(...enrichedTracked.map(s => s.registrants), 1);
  const trackedTotal = enrichedTracked.reduce((s, x) => s + x.registrants, 0);
  const directPct    = totalReg > 0 ? directReg / totalReg : 0;
  const SHOW_LIMIT   = 12;
  const visibleTracked = showAll ? enrichedTracked : enrichedTracked.slice(0, SHOW_LIMIT);

  const qualified    = enrichedTracked.filter(s => s.registrants >= 5);
  const byRate       = [...qualified].sort((a, b) => (b.attendees / b.registrants) - (a.attendees / a.registrants));

  const toggleExpand = (code: string) =>
    setExpandedCodes(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; });

  return (
    <div>
      <SectionLabel tip="Aggregates partner-ref codes across all events and merges similar variants (e.g. 'MARKETO' and 'MARKETO?' become one, 'lkmx'/'lkper' roll up to LinkedIn). Click a grouped bar to see individual sub-code rates. 'No source tracked' shown separately to avoid skewing the chart.">
        Registration Sources
      </SectionLabel>
      {status === 'loading' && (
        <div className="flex items-center gap-2 py-4 text-[11px] text-gray-400">
          <span className="inline-block h-3 w-3 border-2 border-ansell-teal border-t-transparent rounded-full animate-spin" />
          Fetching registrant data…
        </div>
      )}
      {status === 'error' && <p className="text-[11px] text-red-500 py-2">Failed to load registration sources.</p>}
      {status === 'done' && enrichedTracked.length === 0 && directReg === 0 && (
        <p className="text-[11px] text-gray-400 py-2">No registration source data found.</p>
      )}
      {status === 'done' && (enrichedTracked.length > 0 || directReg > 0) && (
        <>
          {/* ── Funnel ──────────────────────────────────────────────────────── */}
          <div className="mb-6 bg-gray-50 border border-gray-200 p-4">
            {/* Stage 1 — Total Registrants (split: tracked + untracked) */}
            <div className="flex items-center gap-3 mb-0.5">
              <div className="w-28 shrink-0 text-right pr-2">
                <p className="text-[13px] font-bold text-gray-800">{fmtNum(totalReg)}</p>
                <p className="text-[9px] uppercase text-gray-400 leading-tight">Total Reg</p>
              </div>
              <div className="flex-1 h-9 flex overflow-hidden">
                {/* Tracked */}
                <div className="h-full flex items-center justify-center overflow-hidden"
                  style={{ width: `${totalReg > 0 ? (trackedTotal / totalReg) * 100 : 0}%`, backgroundColor: '#0063AC' }}>
                  {trackedTotal / totalReg > 0.12 && (
                    <span className="text-white text-[10px] font-semibold px-1 whitespace-nowrap">{fmtNum(trackedTotal)} tracked</span>
                  )}
                </div>
                {/* Untracked */}
                {directReg > 0 && (
                  <div className="h-full flex items-center justify-center overflow-hidden"
                    style={{ width: `${totalReg > 0 ? (directReg / totalReg) * 100 : 0}%`, backgroundColor: '#94A3B8' }}>
                    {directReg / totalReg > 0.1 && (
                      <span className="text-white text-[10px] px-1 whitespace-nowrap">{fmtNum(directReg)} no-source</span>
                    )}
                  </div>
                )}
              </div>
              <div className="w-12 shrink-0 text-[11px] font-bold text-gray-500">100%</div>
            </div>

            {/* Connector */}
            <div className="flex items-center gap-3 py-1.5">
              <div className="w-28 shrink-0" />
              <div className="flex-1 flex items-center gap-2 pl-1">
                <div className="flex flex-col items-center" style={{ marginLeft: `${totalReg > 0 ? (trackedTotal / totalReg) * 50 : 25}%` }}>
                  <div className="w-px h-3 bg-gray-300" />
                  <svg width="10" height="6" viewBox="0 0 10 6" className="text-gray-300" fill="currentColor">
                    <path d="M5 6L0 0h10z" />
                  </svg>
                </div>
                <span className="text-[10px] text-gray-400 ml-2">
                  <span className="font-semibold text-emerald-600">{fmtPct(totalReg > 0 ? totalAtt / totalReg : 0)}</span> attendance rate
                  {directReg > 0 && (
                    <span className="ml-2 text-gray-300">·</span>
                  )}
                  {directReg > 0 && (
                    <span className="ml-2 text-gray-400">
                      <span className="font-semibold text-gray-500">{fmtPct(directPct)}</span> without source
                    </span>
                  )}
                </span>
              </div>
              <div className="w-12 shrink-0" />
            </div>

            {/* Stage 2 — Attended + No-show (combined split bar) */}
            {(() => {
              const attPct  = totalReg > 0 ? (totalAtt / totalReg) * 100 : 0;
              const nsPct   = totalReg > 0 ? ((totalReg - totalAtt) / totalReg) * 100 : 0;
              const noShow  = totalReg - totalAtt;
              return (
                <div className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-right pr-2 flex flex-col gap-0.5 justify-center">
                    <div className="flex items-center justify-end gap-1">
                      <p className="text-[12px] font-bold leading-tight" style={{ color: '#059669' }}>{fmtNum(totalAtt)}</p>
                      <p className="text-[8px] uppercase text-gray-400 leading-tight">att</p>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <p className="text-[12px] font-bold leading-tight text-gray-400">{fmtNum(noShow)}</p>
                      <p className="text-[8px] uppercase text-gray-400 leading-tight">no-show</p>
                    </div>
                  </div>
                  <div className="flex-1 h-9 flex overflow-hidden">
                    <div className="h-full flex items-center pl-2 overflow-hidden"
                      style={{ width: `${Math.max(attPct, 2)}%`, backgroundColor: '#059669' }}>
                      {attPct > 12 && <span className="text-white text-[10px] font-semibold whitespace-nowrap">{fmtPct(attPct / 100)} attended</span>}
                    </div>
                    {noShow > 0 && (
                      <div className="h-full flex items-center pl-2 overflow-hidden"
                        style={{ width: `${Math.max(nsPct, 2)}%`, backgroundColor: '#E2E8F0' }}>
                        {nsPct > 12 && <span className="text-gray-500 text-[10px] whitespace-nowrap">{fmtPct(nsPct / 100)} no-show</span>}
                      </div>
                    )}
                  </div>
                  <div className="w-12 shrink-0 flex flex-col items-start gap-0.5">
                    <span className="text-[10px] font-bold leading-tight" style={{ color: '#059669' }}>{fmtPct(attPct / 100)}</span>
                    <span className="text-[10px] font-bold leading-tight text-gray-400">{fmtPct(nsPct / 100)}</span>
                  </div>
                </div>
              );
            })()}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200 text-[9px] text-gray-500">
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2" style={{ backgroundColor: '#0063AC' }} /> Tracked source</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2" style={{ backgroundColor: '#94A3B8' }} /> No source</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2" style={{ backgroundColor: '#059669' }} /> Attended · <span className="inline-block w-3 h-2 bg-gray-200 ml-1" /> No-show</span>
              <span className="ml-auto text-gray-400">{enrichedTracked.length} unique sources · {fmtPct(totalReg > 0 ? trackedTotal / totalReg : 0)} tracking coverage</span>
            </div>
          </div>

          {/* ── Detail grid ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left — expandable bars */}
            <div>
              {visibleTracked.map(s => (
                <ExpandableSourceBar key={s.code}
                  source={s} maxReg={maxReg}
                  expanded={expandedCodes.has(s.code)}
                  onToggle={() => toggleExpand(s.code)} />
              ))}
              {enrichedTracked.length > SHOW_LIMIT && (
                <button
                  onClick={() => setShowAll(v => !v)}
                  className="mt-2 text-[10px] text-ansell-teal hover:underline"
                >
                  {showAll ? 'Show less' : `Show all ${enrichedTracked.length} sources`}
                </button>
              )}
              <div className="flex items-center gap-4 mt-3 text-[9px] text-gray-400">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm" style={{ backgroundColor: '#059669' }} /> ≥50% att</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm" style={{ backgroundColor: '#D97706' }} /> 35–49%</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm" style={{ backgroundColor: '#DC2626' }} /> &lt;35%</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-gray-200" /> No-show</span>
              </div>
            </div>

            {/* Right — best/worst att rate */}
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-600 mb-1.5">Best Attendance Rate (min 5 reg)</p>
              {byRate.slice(0, 5).map((s, i) => (
                <div key={s.code} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                  <span className="text-[10px] font-bold text-gray-400 w-4">{i + 1}</span>
                  <span className="text-[11px] text-gray-700 flex-1 truncate">{decodeSource(s.code)}</span>
                  <span className="text-[11px] font-bold text-emerald-600">{fmtPct(s.attendees / s.registrants)}</span>
                </div>
              ))}

              {byRate.length >= 3 && (
                <>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-red-500 mt-4 mb-1.5">Worst Attendance Rate (min 5 reg)</p>
                  {[...byRate].reverse().slice(0, 5).map((s, i) => (
                    <div key={s.code} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                      <span className="text-[10px] font-bold text-gray-400 w-4">{i + 1}</span>
                      <span className="text-[11px] text-gray-700 flex-1 truncate">{decodeSource(s.code)}</span>
                      <span className="text-[11px] font-bold text-red-500">{fmtPct(s.attendees / s.registrants)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

        </>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const { liveWebinars, liveCtaCounts, filterStartDate, filterEndDate, filterVersion, setLiveWebinars } = useWebinarStore();

  // Local attendee metrics — loaded here if not already in liveWebinars
  const [localMetrics, setLocalMetrics] = useState<Map<number, AttendeeMetrics>>(new Map());
  const [metricsProgress, setMetricsProgress] = useState({ loaded: 0, total: 0 });
  const loadingRef = useRef(false);
  const insightsMountedRef = useRef(false);

  // Registration sources (auto-loaded)
  const [breakdowns, setBreakdowns] = useState<Partial<Record<SourceField, BreakdownEntry>>>({});
  const [sourceField, setSourceField] = useState<SourceField>('auto');
  const [sourcesStatus, setSourcesStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [sourcesRegTotal, setSourcesRegTotal] = useState(0);
  const [sourcesAttTotal, setSourcesAttTotal] = useState(0);
  const sourcesRef = useRef(false);

  const [showEventIds, setShowEventIds] = useState(false);
  const [activeSection, setActiveSection] = useState<'registration' | 'attendance' | 'engagement' | 'revenue' | null>(null);

  // Revenue attribution
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [revenueStatus, setRevenueStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [revenueError, setRevenueError] = useState('');
  const [uploading, setUploading] = useState(false);
  const revenueRef = useRef(false);
  const [revAttribution, setRevAttribution] = useState<'mt' | 'ft'>('mt');
  const [revShowAll, setRevShowAll] = useState(false);

  const [expandedLeaders, setExpandedLeaders] = useState<Set<string>>(new Set());
  const toggleLeader = (key: string) => setExpandedLeaders(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const [resourcesExpanded, setResourcesExpanded] = useState(false);
  const [expandedWebinars, setExpandedWebinars] = useState<Set<number>>(new Set());
  const toggleWebinarExpand = (id: number) => setExpandedWebinars(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const toggleTagExpand = (tag: string) => setExpandedTags(prev => {
    const next = new Set(prev); next.has(tag) ? next.delete(tag) : next.add(tag); return next;
  });

  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const toggleTag = (tag: string) => setSelectedTags(prev => {
    const next = new Set(prev);
    next.has(tag) ? next.delete(tag) : next.add(tag);
    return next;
  });

  const SOURCE_FIELD_LABELS: Record<SourceField, string> = {
    auto:         'Auto',
    partnerref:   'Partner Ref',
    utm_source:   'UTM Source',
    utm_medium:   'UTM Medium',
    utm_campaign: 'UTM Campaign',
    utm_content:  'UTM Content',
  };
  const SOURCE_FIELDS: SourceField[] = ['auto', 'partnerref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];

  const sources: RegSource[] = breakdowns[sourceField]?.sources ?? [];

  const baseWebinars = useMemo(() =>
    liveWebinars.filter(w => !w.isTest && ANALYSIS_TYPES.has((w.eventType || '').toLowerCase())),
    [liveWebinars],
  );

  const excluded = useMemo(() => {
    const tests = liveWebinars.filter(w => w.isTest).length;
    const otherMap = new Map<string, number>();
    for (const w of liveWebinars) {
      if (!w.isTest && !ANALYSIS_TYPES.has((w.eventType || '').toLowerCase())) {
        const t = w.eventType || 'Unknown';
        otherMap.set(t, (otherMap.get(t) || 0) + 1);
      }
    }
    const otherTypes = Array.from(otherMap.entries());
    const otherTotal = otherTypes.reduce((s, [, c]) => s + c, 0);
    return { tests, otherTypes, otherTotal, total: tests + otherTotal };
  }, [liveWebinars]);

  // Key that changes whenever the set of event IDs changes (more reliable than just .length)
  const eventIdsKey = useMemo(() => baseWebinars.map(w => w.eventId).join(','), [baseWebinars]);

  // Merge store + locally-loaded attendee metrics
  const webinars = useMemo(() =>
    baseWebinars.map(w => ({
      ...w,
      attendeeMetrics: w.attendeeMetrics?.loaded ? w.attendeeMetrics : localMetrics.get(w.eventId),
    })),
    [baseWebinars, localMetrics],
  );

  // Merged sources for engagement-by-source table (used in Engagement section)
  const qualifiedSources = useMemo(() => {
    const { tracked } = mergeSources(sources);
    return tracked.filter(s => s.registrants >= 5);
  }, [sources]);

  // All unique tags across all loaded events (unfiltered — always show all options)
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const w of webinars) for (const t of (w.tags || [])) set.add(t);
    return [...set].sort();
  }, [webinars]);

  // Events filtered by selected tags (empty = show all)
  const filteredWebinars = useMemo(() =>
    selectedTags.size === 0
      ? webinars
      : webinars.filter(w => (w.tags || []).some(t => selectedTags.has(t))),
    [webinars, selectedTags],
  );

  // Auto-load metrics for events that don't have them yet
  useEffect(() => {
    if (loadingRef.current) return;
    const missing = baseWebinars.filter(w => !w.attendeeMetrics?.loaded);
    if (missing.length === 0) return;

    loadingRef.current = true;
    setMetricsProgress({ loaded: 0, total: missing.length });

    let loaded = 0;
    const ids = missing.map(w => w.eventId);

    const run = async () => {
      for (let i = 0; i < ids.length; i += METRICS_BATCH) {
        const batch = ids.slice(i, i + METRICS_BATCH);
        try {
          const res = await fetch('/api/on24/attendee-metrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventIds: batch }),
          });
          if (res.ok) {
            const { metrics } = await res.json() as { metrics: Record<string, AttendeeMetrics> };
            setLocalMetrics(prev => {
              const next = new Map(prev);
              for (const [id, m] of Object.entries(metrics)) next.set(Number(id), m);
              return next;
            });
          }
        } catch { /* continue */ }
        loaded += batch.length;
        setMetricsProgress({ loaded: Math.min(loaded, missing.length), total: missing.length });
      }
      loadingRef.current = false;
    };

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIdsKey]);

  const eventIds = useMemo(() => webinars.map(w => w.eventId), [webinars]);

  // Auto-load registration sources when events are known
  useEffect(() => {
    if (sourcesRef.current || eventIds.length === 0) return;
    sourcesRef.current = true;
    setSourcesStatus('loading');
    fetch('/api/on24/registration-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventIds }),
    })
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error(json.error || 'Failed');
        setBreakdowns(json.breakdowns || {});
        setSourcesRegTotal(json.totalRegistrants || 0);
        setSourcesAttTotal(json.totalAttendees || 0);
        setSourcesStatus('done');
      })
      .catch(() => setSourcesStatus('error'))
      .finally(() => { sourcesRef.current = false; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIdsKey]);

  // When the date filter is applied while the user is on this tab (Dashboard isn't mounted
  // to do the re-fetch), Insights re-fetches events itself and resets all derived data.
  useEffect(() => {
    // Skip the initial mount — Dashboard already loaded events for the current filter.
    if (!insightsMountedRef.current) { insightsMountedRef.current = true; return; }

    // Reset all derived state so effects above re-run for the new events.
    setLiveWebinars([]);
    setLocalMetrics(new Map());
    loadingRef.current = false;
    sourcesRef.current = false;
    setSourcesStatus('idle');
    setBreakdowns({});

    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; })();
    const start = filterStartDate || thirtyDaysAgo;
    const end   = filterEndDate   || today;

    fetch(`/api/on24/events?startDate=${start}&endDate=${end}`)
      .then(r => r.json())
      .then(result => { if (result.success) setLiveWebinars(result.data?.webinars || []); })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterVersion]);

  // Load revenue data once
  useEffect(() => {
    if (revenueRef.current) return;
    revenueRef.current = true;
    setRevenueStatus('loading');
    fetch('/api/revenue/data')
      .then(r => r.json())
      .then(data => {
        if (data.error) { setRevenueError(data.error); setRevenueStatus('error'); }
        else { setRevenueData(data); setRevenueStatus('done'); }
      })
      .catch(e => { setRevenueError(String(e)); setRevenueStatus('error'); });
  }, []);

  const metricsLoadedCount  = webinars.filter(w => w.attendeeMetrics?.loaded).length;
  const metricsStillLoading = metricsLoadedCount < webinars.length && metricsProgress.total > 0;

  // ── Aggregate totals ────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let reg = 0, att = 0, noShow = 0, qa = 0, polls = 0, surveys = 0, dl = 0, reactions = 0;
    let liveMin = 0, archiveMin = 0, ctaTotal = 0;
    for (const w of filteredWebinars) {
      reg        += getReg(w);
      att        += getAtt(w);
      noShow     += getNoShow(w);
      qa         += getQA(w);
      polls      += getPolls(w);
      surveys    += getSurveys(w);
      dl         += getDL(w);
      reactions  += getReactions(w);
      liveMin    += getLiveMin(w);
      archiveMin += getArchiveMin(w);
      ctaTotal   += liveCtaCounts[w.eventId] ?? 0;
    }
    const viewHours  = Math.round((liveMin + archiveMin) / 60);
    const attRate    = reg > 0 ? att / reg : 0;
    const noShowRate = (att + noShow) > 0 ? noShow / (att + noShow) : 0;
    const livePct    = (liveMin + archiveMin) > 0 ? liveMin / (liveMin + archiveMin) : 0;
    return { reg, att, noShow, qa, polls, surveys, dl, reactions, ctaTotal, viewHours, attRate, noShowRate, livePct };
  }, [filteredWebinars, liveCtaCounts]);

  // ── Performance distribution (relative to best in selection) ─────────────────
  const maxEng = useMemo(() => Math.max(...filteredWebinars.map(getEng), 0.01), [filteredWebinars]);
  const distribution = useMemo(() => {
    const t75 = maxEng * 0.75;
    const t50 = maxEng * 0.50;
    const t25 = maxEng * 0.25;
    const bins = { top: 0, good: 0, average: 0, low: 0 };
    for (const w of filteredWebinars) {
      const s = getEng(w);
      if (s >= t75)      bins.top++;
      else if (s >= t50) bins.good++;
      else if (s >= t25) bins.average++;
      else               bins.low++;
    }
    const total = filteredWebinars.length || 1;
    return [
      { label: `Top ≥${t75.toFixed(1)}`,     count: bins.top,     pct: (bins.top     / total) * 100, color: '#059669' },
      { label: `Good ≥${t50.toFixed(1)}`,    count: bins.good,    pct: (bins.good    / total) * 100, color: '#0063AC' },
      { label: `Average ≥${t25.toFixed(1)}`, count: bins.average, pct: (bins.average / total) * 100, color: '#D97706' },
      { label: `Low <${t25.toFixed(1)}`,     count: bins.low,     pct: (bins.low     / total) * 100, color: '#DC2626' },
    ];
  }, [filteredWebinars, maxEng]);

  // ── Top / bottom ────────────────────────────────────────────────────────────
  const topEngagers    = useMemo(() => [...filteredWebinars].sort((a, b) => getEng(b) - getEng(a)).slice(0, 7), [filteredWebinars]);
  const bottomEngagers = useMemo(() => [...filteredWebinars].filter(w => getAtt(w) > 0).sort((a, b) => getEng(a) - getEng(b)).slice(0, 7), [filteredWebinars]);

  // ── Engagement leaders ──────────────────────────────────────────────────────
  const topQA      = useMemo(() => [...filteredWebinars].filter(w => getAtt(w) > 0 && getQA(w) > 0).sort((a, b) => getQA(b) / getAtt(b) - getQA(a) / getAtt(a)), [filteredWebinars]);
  const topPolls   = useMemo(() => [...filteredWebinars].filter(w => getAtt(w) > 0 && getPolls(w) > 0).sort((a, b) => getPolls(b) / getAtt(b) - getPolls(a) / getAtt(a)), [filteredWebinars]);
  const topSurveys = useMemo(() => [...filteredWebinars].filter(w => getAtt(w) > 0 && getSurveys(w) > 0).sort((a, b) => getSurveys(b) / getAtt(b) - getSurveys(a) / getAtt(a)), [filteredWebinars]);
  const topDL      = useMemo(() => [...filteredWebinars].filter(w => getAtt(w) > 0 && getDL(w) > 0).sort((a, b) => getDL(b) - getDL(a)), [filteredWebinars]);
  const topCTA       = useMemo(() => [...filteredWebinars].filter(w => getAtt(w) > 0 && (liveCtaCounts[w.eventId] ?? 0) > 0).sort((a, b) => (liveCtaCounts[b.eventId] ?? 0) / getAtt(b) - (liveCtaCounts[a.eventId] ?? 0) / getAtt(a)), [filteredWebinars, liveCtaCounts]);
  const topReactions = useMemo(() => [...filteredWebinars].filter(w => getAtt(w) > 0 && getReactions(w) > 0).sort((a, b) => getReactions(b) / getAtt(b) - getReactions(a) / getAtt(a)), [filteredWebinars]);
  const topResources = useMemo(() => {
    const byName: Record<string, number> = {};
    for (const w of filteredWebinars) {
      const rb = w.attendeeMetrics?.resourceBreakdown;
      if (rb) {
        for (const [name, count] of Object.entries(rb)) {
          byName[name] = (byName[name] || 0) + count;
        }
      }
    }
    return Object.entries(byName).sort((a, b) => b[1] - a[1]);
  }, [filteredWebinars]);
  const topAtt     = useMemo(() => [...filteredWebinars].filter(w => getReg(w) >= 10).sort((a, b) => getAttRate(b) - getAttRate(a)).slice(0, 6), [filteredWebinars]);

  // ── Tag analysis ────────────────────────────────────────────────────────────
  const tagStats = useMemo(() => {
    const map = new Map<string, { count: number; eng: number; attRate: number; qa: number }>();
    for (const w of filteredWebinars) {
      for (const tag of (w.tags || [])) {
        const s = map.get(tag) || { count: 0, eng: 0, attRate: 0, qa: 0 };
        s.count++; s.eng += getEng(w); s.attRate += getAttRate(w); s.qa += getQA(w);
        map.set(tag, s);
      }
    }
    return [...map.entries()]
      .map(([tag, s]) => ({ tag, count: s.count, avgEng: s.eng / s.count, avgAtt: s.attRate / s.count, totalQA: s.qa }))
      .filter(t => t.count >= 2)
      .sort((a, b) => b.avgEng - a.avgEng);
  }, [filteredWebinars]);

  // ── Language analysis ───────────────────────────────────────────────────────
  const langStats = useMemo(() => {
    const map = new Map<string, { count: number; eng: number; att: number; reg: number }>();
    for (const w of filteredWebinars) {
      const lang = w.language || 'en';
      const s = map.get(lang) || { count: 0, eng: 0, att: 0, reg: 0 };
      s.count++; s.eng += getEng(w); s.att += getAtt(w); s.reg += getReg(w);
      map.set(lang, s);
    }
    return [...map.entries()]
      .map(([lang, s]) => ({ lang, count: s.count, avgEng: s.eng / s.count, attRate: s.reg > 0 ? s.att / s.reg : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [filteredWebinars]);

  // ── Day-of-week ─────────────────────────────────────────────────────────────
  const dowStats = useMemo(() => {
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const map = new Map<number, { count: number; eng: number; att: number; reg: number }>();
    for (const w of filteredWebinars) {
      if (!w.startDateTime) continue;
      const day = new Date(w.startDateTime).getDay();
      const s = map.get(day) || { count: 0, eng: 0, att: 0, reg: 0 };
      s.count++; s.eng += getEng(w); s.att += getAtt(w); s.reg += getReg(w);
      map.set(day, s);
    }
    return DAYS.map((name, i) => {
      const s = map.get(i);
      return { name, count: s?.count ?? 0, avgEng: s ? s.eng / s.count : 0, attRate: s && s.reg > 0 ? s.att / s.reg : 0 };
    }).filter(d => d.count > 0);
  }, [filteredWebinars]);

  // ── Cross-findings ──────────────────────────────────────────────────────────
  const crossFindings = useMemo((): { icon: string; text: string }[] => {
    const findings: { icon: string; text: string }[] = [];
    if (filteredWebinars.length < 2) return findings;

    const withPolls = filteredWebinars.filter(w => getPolls(w) > 0);
    const noPolls   = filteredWebinars.filter(w => getPolls(w) === 0 && getAtt(w) > 0);
    if (withPolls.length >= 2 && noPolls.length >= 2) {
      const eW = withPolls.reduce((s, w) => s + getEng(w), 0) / withPolls.length;
      const eN = noPolls.reduce((s, w) => s + getEng(w), 0) / noPolls.length;
      if (Math.abs(eW - eN) >= 0.3)
        findings.push({ icon: '📊', text: `Events with polls had ${eW > eN ? 'higher' : 'lower'} avg engagement (${fmtEng(eW)} vs ${fmtEng(eN)}).` });
    }

    const withQA = filteredWebinars.filter(w => getQA(w) > 0);
    const noQA   = filteredWebinars.filter(w => getQA(w) === 0 && getAtt(w) > 0);
    if (withQA.length >= 2 && noQA.length >= 2) {
      const aW = withQA.reduce((s, w) => s + getAttRate(w), 0) / withQA.length;
      const aN = noQA.reduce((s, w) => s + getAttRate(w), 0) / noQA.length;
      const diff = Math.round((aW - aN) * 100);
      if (Math.abs(diff) >= 3)
        findings.push({ icon: '❓', text: `Events with Q&A had ${diff > 0 ? 'higher' : 'lower'} attendance rates (${Math.abs(diff)} pp difference).` });
    }

    if (totals.livePct > 0) {
      const l = Math.round(totals.livePct * 100);
      findings.push({ icon: l > 50 ? '🔴' : '🎬', text: `${l}% of total viewing is live, ${100 - l}% is on-demand archive replay.` });
    }

    const noCode = filteredWebinars.filter(w => !w.hasCampaignCode).length;
    if (noCode > 0)
      findings.push({ icon: '⚠️', text: `${noCode} event${noCode > 1 ? 's are' : ' is'} missing a campaign code — attribution will be incomplete.` });

    if (dowStats.length >= 2) {
      const sorted = [...dowStats].sort((a, b) => b.attRate - a.attRate);
      const best = sorted[0], worst = sorted[sorted.length - 1];
      if (best.attRate - worst.attRate >= 0.08)
        findings.push({ icon: '📅', text: `${best.name} events averaged the best attendance (${fmtPct(best.attRate)}), vs ${worst.name} (${fmtPct(worst.attRate)}).` });
    }

    if (tagStats.length >= 2) {
      const best = tagStats[0], worst = tagStats[tagStats.length - 1];
      if (best.avgEng - worst.avgEng >= 0.5)
        findings.push({ icon: '🏷️', text: `"${best.tag}" events averaged ${fmtEng(best.avgEng)} engagement vs "${worst.tag}" at ${fmtEng(worst.avgEng)}.` });
    }

    if (langStats.length >= 2) {
      const filtered = langStats.filter(l => l.count >= 2).sort((a, b) => b.attRate - a.attRate);
      if (filtered.length >= 2 && filtered[0].attRate - filtered[filtered.length - 1].attRate >= 0.08)
        findings.push({ icon: '🌍', text: `"${filtered[0].lang.toUpperCase()}" events had the best attendance rate (${fmtPct(filtered[0].attRate)}) vs "${filtered[filtered.length - 1].lang.toUpperCase()}" (${fmtPct(filtered[filtered.length - 1].attRate)}).` });
    }

    // Registration source findings — use merged/normalised sources, exclude "direct"
    if (sources.length >= 2 && sourcesRegTotal > 0) {
      const { tracked, directReg } = mergeSources(sources);
      if (directReg > 0 && sourcesRegTotal > 0)
        findings.push({ icon: '🔍', text: `${fmtPct(directReg / sourcesRegTotal)} of registrants had no UTM / source tracked — improving tracking will reveal true channel mix.` });

      if (tracked.length >= 1) {
        const top = tracked[0];
        const topShare = top.registrants / sourcesRegTotal;
        if (topShare >= 0.25)
          findings.push({ icon: '📢', text: `${decodeSource(top.code)} is the top registration source — ${fmtNum(top.registrants)} reg (${fmtPct(topShare)} of total).` });
      }

      const qualified = tracked.filter(s => s.registrants >= 5);
      if (qualified.length >= 2) {
        const byRate = [...qualified].sort((a, b) => (b.attendees / b.registrants) - (a.attendees / a.registrants));
        const best  = byRate[0];
        const worst = byRate[byRate.length - 1];
        const bestRate  = best.attendees  / best.registrants;
        const worstRate = worst.attendees / worst.registrants;
        findings.push({ icon: '🔗', text: `${decodeSource(best.code)} drives the best attendance rate (${fmtPct(bestRate)} from ${fmtNum(best.registrants)} reg).` });
        if (bestRate - worstRate >= 0.08)
          findings.push({ icon: '⚡', text: `${decodeSource(worst.code)} has a low attendance rate (${fmtPct(worstRate)}) — consider better targeting or follow-up for this channel.` });
      }
    }

    // Revenue cross-findings (always MT as primary attribution model)
    if (revenueData && webinars.length > 0) {
      const campaignMap = new Map<string, WebinarSummary[]>();
      for (const w of webinars) {
        if (!w.campaignName) continue;
        const keys = [w.campaignName, w.campaignName.replace(/\*[^*]*$/, '')];
        for (const k of keys) {
          if (!campaignMap.has(k)) campaignMap.set(k, []);
          campaignMap.get(k)!.push(w);
        }
      }
      const revGetMatches = (name: string) => {
        const stripped = name.replace(/\*[^*]*$/, '');
        return campaignMap.get(name) || campaignMap.get(stripped) || [];
      };
      const revMatched = revenueData.programs.filter(p => revGetMatches(p.programName).length > 0);

      const matchedWebinars = revMatched.flatMap(p => revGetMatches(p.programName));
      const uniqueMatched = Array.from(new Map(matchedWebinars.map(w => [w.eventId, w])).values());
      const avgEngMatched = uniqueMatched.length > 0
        ? uniqueMatched.reduce((s, w) => s + getEng(w), 0) / uniqueMatched.length : null;
      const unmatchedWebinars = webinars.filter(w => !uniqueMatched.find(m => m.eventId === w.eventId) && getAtt(w) > 0);
      const avgEngUnmatched = unmatchedWebinars.length > 0
        ? unmatchedWebinars.reduce((s, w) => s + getEng(w), 0) / unmatchedWebinars.length : null;
      if (avgEngMatched !== null && avgEngUnmatched !== null && Math.abs(avgEngMatched - avgEngUnmatched) >= 0.2) {
        const diff = avgEngMatched - avgEngUnmatched;
        findings.push({ icon: diff > 0 ? '📈' : '📉', text: `Webinars linked to revenue have ${fmtEng(Math.abs(diff))} pt ${diff > 0 ? 'higher' : 'lower'} avg engagement (${fmtEng(avgEngMatched)}) vs non-attributed events (${fmtEng(avgEngUnmatched)}).` });
      }

      const tagRevenue: Record<string, number> = {};
      for (const p of revMatched) {
        for (const w of revGetMatches(p.programName)) {
          for (const tag of (w.tags ?? [])) {
            tagRevenue[tag] = (tagRevenue[tag] || 0) + p.mtWon;
          }
        }
      }
      const topRevTag = Object.entries(tagRevenue).sort((a, b) => b[1] - a[1])[0];
      const fmtRevFinding = (n: number) =>
        n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
        : n >= 1_000   ? `$${(n / 1_000).toFixed(0)}K`
        : `$${Math.round(n)}`;
      if (topRevTag && topRevTag[1] > 0) {
        findings.push({ icon: '🏷️', text: `Tag "${topRevTag[0]}" is associated with the most MT Won revenue (${fmtRevFinding(topRevTag[1])}).` });
      }

      if (uniqueMatched.length >= 3) {
        const avgAtt = uniqueMatched.reduce((s, w) => s + getAttRate(w), 0) / uniqueMatched.length;
        findings.push({ icon: '🎯', text: `Revenue-attributed webinars average a ${fmtPct(avgAtt)} attendance rate across ${uniqueMatched.length} linked events.` });
      }
    }

    return findings;
  }, [filteredWebinars, totals, dowStats, tagStats, langStats, sources, sourcesRegTotal, revenueData, webinars]);

  const maxTagEng = Math.max(...tagStats.map(t => t.avgEng), 1);
  const maxDowAtt = Math.max(...dowStats.map(d => d.attRate), 0.01);

  // ── No data state ───────────────────────────────────────────────────────────
  if (webinars.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-[28px] font-bold text-gray-200 mb-2">No data loaded</p>
        <p className="text-gray-400 text-sm">Load events in the <strong>Dashboard</strong> tab first, then return here.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* Title + metrics loading status */}
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[20px] font-extrabold uppercase tracking-wide text-ansell-dark">
            Key <span className="text-ansell-blue">Insights</span>
          </h1>
          <p className="text-[11px] text-ansell-gray mt-0.5">
            {(() => {
              if (selectedTags.size > 0) {
                return `${filteredWebinars.length} of ${webinars.length} events analysed (filtered by tag)`;
              }
              const base = `${webinars.length} events analysed`;
              if (excluded.total === 0) return base;
              const parts: string[] = [];
              if (excluded.tests > 0) parts.push(`${excluded.tests} test${excluded.tests !== 1 ? 's' : ''}`);
              for (const [type, count] of excluded.otherTypes) parts.push(`${count} ${type}`);
              return `${base} · ${excluded.total} excluded (${parts.join(', ')})`;
            })()}
          </p>
        </div>
        {metricsStillLoading && (
          <span className="text-[10px] text-ansell-teal flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 border-2 border-ansell-teal border-t-transparent rounded-full animate-spin" />
            Loading attendee metrics {metricsProgress.loaded}/{metricsProgress.total} — figures updating…
          </span>
        )}
        {!metricsStillLoading && metricsLoadedCount > 0 && (
          <span className="text-[10px] text-emerald-600">Attendee metrics loaded for {metricsLoadedCount}/{webinars.length} events</span>
        )}
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ansell-gray shrink-0">Filter by tag</span>
          {allTags.map(tag => {
            const active = selectedTags.has(tag);
            const countInTag = webinars.filter(w => (w.tags || []).includes(tag)).length;
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2 py-0.5 text-[11px] border transition-colors ${
                  active
                    ? 'bg-ansell-teal text-white border-ansell-teal'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-ansell-teal hover:text-ansell-teal'
                }`}
              >
                {tag}
                <span className={`ml-1 text-[10px] ${active ? 'opacity-75' : 'text-gray-400'}`}>({countInTag})</span>
              </button>
            );
          })}
          {selectedTags.size > 0 && (
            <button
              onClick={() => setSelectedTags(new Set())}
              className="px-2 py-0.5 text-[11px] text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 hover:border-gray-400 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Event IDs toggle */}
      {webinars.length > 0 && (
        <div>
          <button
            onClick={() => setShowEventIds(v => !v)}
            className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-gray-600 transition-colors select-none"
          >
            <svg className={`w-3 h-3 transition-transform ${showEventIds ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Event IDs ({filteredWebinars.length}{filteredWebinars.length !== webinars.length ? ` of ${webinars.length}` : ''} events{selectedTags.size > 0 ? ' · filtered by tag' : ''})
          </button>
          {showEventIds && (
            <div className="mt-2 border border-gray-200 bg-gray-50 p-3 max-h-64 overflow-y-auto">
              <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-x-4 gap-y-1 text-[10px]">
                <span className="font-bold text-gray-400 uppercase tracking-wider">ID</span>
                <span className="font-bold text-gray-400 uppercase tracking-wider">Name</span>
                <span className="font-bold text-gray-400 uppercase tracking-wider">Campaign</span>
                <span className="font-bold text-gray-400 uppercase tracking-wider">Type</span>
                <span className="font-bold text-gray-400 uppercase tracking-wider">Date</span>
                {filteredWebinars.map(w => (
                  <>
                    <span key={`id-${w.eventId}`} className="font-mono text-ansell-blue shrink-0">{w.eventId}</span>
                    <span key={`name-${w.eventId}`} className="text-gray-700 truncate">
                      <EventNamePopover eventId={w.eventId} name={w.webinarName} campaignName={w.campaignName} display={truncate(w.webinarName, 50)} />
                    </span>
                    <span key={`camp-${w.eventId}`} className="text-gray-500 font-mono text-[9px] truncate" title={w.campaignName}>{w.campaignName || '—'}</span>
                    <span key={`type-${w.eventId}`} className="text-gray-400 shrink-0 capitalize">{w.eventType || '—'}</span>
                    <span key={`date-${w.eventId}`} className="text-gray-400 shrink-0 font-mono">{w.date}</span>
                  </>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Cross-Findings ──────────────────────────────────────────────────── */}
      {crossFindings.length > 0 && (
        <Card className="px-4 py-4" accent="purple">
          <SectionLabel tip="Statistical comparisons computed across all events. Only shown when the difference is ≥3 percentage points (for rates) or ≥0.3 engagement points (out of 10) — to filter noise from small samples.">
            Cross-Findings
          </SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            {crossFindings.map((f, i) => (
              <CrossFinding key={i} icon={f.icon} text={f.text} />
            ))}
          </div>
        </Card>
      )}

      {/* ════════════════════════ SECTION NAVIGATOR ════════════════════════════ */}
      {(() => {
        const ipaTeaser = totals.att > 0
          ? ((totals.qa + totals.polls + totals.surveys + totals.dl + totals.reactions) / totals.att).toFixed(2)
          : '—';
        const revTotals = revenueData?.totals;
        const fmtRevTeaser = (n: number) =>
          n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
          : n >= 1_000   ? `$${(n / 1_000).toFixed(0)}K`
          : n > 0        ? `$${Math.round(n)}`
          : '—';
        const revMatchedMtWon = (() => {
          if (!revenueData) return 0;
          const codes = new Set<string>();
          for (const w of webinars) {
            if (w.campaignName) {
              codes.add(w.campaignName);
              codes.add(w.campaignName.replace(/\*[^*]*$/, ''));
            }
          }
          return revenueData.programs
            .filter(p => codes.has(p.programName) || codes.has(p.programName.replace(/\*[^*]*$/, '')))
            .reduce((s, p) => s + p.mtWon, 0);
        })();
        const SECS = [
          {
            key: 'registration' as const,
            label: 'Registration',
            color: '#0063AC',
            bigStat: sourcesStatus === 'done' ? fmtNum(sourcesRegTotal) : '—',
            bigStatLabel: 'total registrants',
            smallStat: sourcesStatus === 'done' ? `${qualifiedSources.length} sources tracked` : '…',
          },
          {
            key: 'attendance' as const,
            label: 'Attendance',
            color: '#00A28F',
            bigStat: fmtPct(totals.attRate),
            bigStatLabel: 'avg attendance rate',
            smallStat: `${fmtNum(totals.att)} of ${fmtNum(totals.reg)} registered`,
          },
          {
            key: 'engagement' as const,
            label: 'Engagement',
            color: '#7030A0',
            bigStat: ipaTeaser,
            bigStatLabel: 'interactions / attendee',
            smallStat: `${metricsLoadedCount} of ${webinars.length} events with metrics`,
          },
          {
            key: 'revenue' as const,
            label: 'Revenue',
            color: '#059669',
            bigStat: revTotals ? fmtRevTeaser(revMatchedMtWon) : (revenueStatus === 'loading' ? '…' : '—'),
            bigStatLabel: 'MT won revenue',
            smallStat: revTotals ? `${revenueData!.programs.length} programs · ${revenueData!.fileDate}` : (revenueStatus === 'error' ? 'no file found' : 'loading…'),
          },
        ];
        const isActive = activeSection !== null;
        if (!isActive) {
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {SECS.map(s => (
                <button key={s.key} onClick={() => setActiveSection(s.key)}
                  className="text-left p-8 border-2 border-gray-200 bg-white hover:shadow-md hover:border-gray-300 transition-all group">
                  <p className="text-[34px] font-extrabold leading-none mb-2" style={{ color: s.color }}>{s.bigStat}</p>
                  <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-4">{s.bigStatLabel}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-extrabold uppercase tracking-wide text-gray-700">{s.label}</p>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          );
        }
        return (
          <div className="grid grid-cols-4 gap-2">
            {SECS.map(s => {
              const selected = activeSection === s.key;
              return (
                <button key={s.key}
                  onClick={() => setActiveSection(selected ? null : s.key)}
                  className="py-2.5 px-3 border-2 text-left transition-all"
                  style={selected
                    ? { borderColor: s.color, backgroundColor: `${s.color}0D`, color: s.color }
                    : { borderColor: '#E2E8F0', color: '#6B7280', backgroundColor: 'white' }}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide">{s.label}</span>
                    {selected && <span className="text-[8px] opacity-50 shrink-0">▲ close</span>}
                  </div>
                  <p className="text-[10px] opacity-60 mt-0.5 truncate">{s.smallStat}</p>
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* ════════════════════════════ REGISTRATION ══════════════════════════════ */}
      {activeSection === 'registration' && (
      <div className="space-y-6">

      {/* Registration Sources */}
      <Card className="px-4 py-4" accent="blue">
        {sourcesStatus === 'done' && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {SOURCE_FIELDS.map(field => {
              const bd = breakdowns[field];
              const cov = bd?.coverage ?? 0;
              const isUtm = field.startsWith('utm_');
              const noData = isUtm && cov === 0;
              return (
                <button
                  key={field}
                  onClick={() => setSourceField(field)}
                  title={isUtm ? `${cov} registrants have ${field} data` : undefined}
                  className={`px-2.5 py-1 text-xs border transition-colors ${
                    sourceField === field
                      ? 'bg-ansell-teal text-white border-ansell-teal'
                      : noData
                      ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-default'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                  }`}
                >
                  {SOURCE_FIELD_LABELS[field]}
                  {isUtm && (
                    <span className={`ml-1 ${sourceField === field ? 'opacity-75' : noData ? 'text-gray-300' : 'text-gray-400'}`}>
                      ({cov > 0 ? cov : '—'})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <RegistrationSources
          sources={sources}
          status={sourcesStatus}
          totalReg={sourcesRegTotal}
          totalAtt={sourcesAttTotal}
          sourceField={sourceField}
          breakdowns={breakdowns}
        />
      </Card>

      </div>
      )}

      {/* ════════════════════════════ ATTENDANCE ════════════════════════════════ */}
      {activeSection === 'attendance' && (
      <div className="space-y-6">

      {/* Attendance KPIs */}
      <div>
        <SectionLabel tip="Aggregate attendance figures across all events in the loaded date range. Benchmarks from ON24 2025 Webinar Benchmarks Report.">
          Key Metrics
        </SectionLabel>
        {(() => {
          const LIVE_TYPES = new Set(['webcast', 'live video and audio']);
          const liveEvts = filteredWebinars.filter(w => LIVE_TYPES.has((w.eventType || '').toLowerCase()));
          const odEvts   = filteredWebinars.filter(w => (w.eventType || '').toLowerCase() === 'on demand');
          const liveRate = liveEvts.length > 0 ? liveEvts.reduce((s, w) => s + getAttRate(w), 0) / liveEvts.length : null;
          const odRate   = odEvts.length   > 0 ? odEvts.reduce((s, w)   => s + getAttRate(w), 0) / odEvts.length   : null;
          return (
            <div className="grid grid-cols-2 gap-3">
              {/* Combined attendance card */}
              <Card accent="teal" className="px-4 py-3">
                <div className="flex items-start justify-between gap-1 mb-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-ansell-gray leading-tight">Attendance Rate</p>
                  <InfoTip text="Sum of all attendees divided by sum of all registrants across every event. ON24 2025 benchmark: 56% for live events, 45% for on-demand." />
                </div>
                <p className="text-[22px] font-bold leading-tight text-ansell-teal">{fmtPct(totals.attRate)}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{fmtNum(totals.att)} of {fmtNum(totals.reg)} registered</p>
                {(liveRate !== null || odRate !== null) && (
                  <div className="flex gap-4 mt-2 pt-2 border-t border-gray-100">
                    {liveRate !== null && (() => {
                      const above = liveRate >= 0.56;
                      const pct = Math.round(Math.abs(liveRate / 0.56 - 1) * 100);
                      return (
                        <div>
                          <p className="text-[9px] text-gray-400 uppercase tracking-wide">Live ({liveEvts.length})</p>
                          <p className="text-[14px] font-bold text-ansell-teal leading-tight">{fmtPct(liveRate)}</p>
                          <p className={`text-[9px] font-bold ${above ? 'text-emerald-600' : 'text-red-500'}`}>
                            {above ? '▲' : '▼'} {above ? '+' : '-'}{pct}% vs 56%
                          </p>
                        </div>
                      );
                    })()}
                    {odRate !== null && (() => {
                      const above = odRate >= 0.45;
                      const pct = Math.round(Math.abs(odRate / 0.45 - 1) * 100);
                      return (
                        <div>
                          <p className="text-[9px] text-gray-400 uppercase tracking-wide">On-demand ({odEvts.length})</p>
                          <p className="text-[14px] font-bold text-ansell-blue leading-tight">{fmtPct(odRate)}</p>
                          <p className={`text-[9px] font-bold ${above ? 'text-emerald-600' : 'text-red-500'}`}>
                            {above ? '▲' : '▼'} {above ? '+' : '-'}{pct}% vs 45%
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </Card>
              <InsightCallout label="Total Viewing Hours" value={totals.viewHours.toLocaleString()}
                sub={`${Math.round(totals.livePct * 100)}% live · ${Math.round((1 - totals.livePct) * 100)}% on-demand`} accent="blue"
                tip="Cumulative live + archive viewing minutes converted to hours. Split shows proportion of viewers who watched live vs replayed on-demand." />
            </div>
          );
        })()}
      </div>

      {/* Best Attendance Rate */}
      {topAtt.length > 0 && (
        <Card className="px-4 py-4" accent="teal">
          <SectionLabel tip="Attendees ÷ registrants per event, showing only events with 10+ registrants to filter out small-sample outliers. High attendance rate indicates strong pre-event promotion and audience motivation.">
            Best Attendance Rate (min 10 registrants)
          </SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
            {topAtt.map((w, i) => (
              <HBar key={w.eventId}
                label={<EventNamePopover eventId={w.eventId} name={w.webinarName} campaignName={w.campaignName} display={`${i + 1}. ${truncate(w.webinarName, 50)}`} />}
                value={getAttRate(w)} max={1} color="#00A28F" suffix="%"
                sub={`${fmtNum(getAtt(w))} of ${fmtNum(getReg(w))} registered`} />
            ))}
          </div>
        </Card>
      )}

      {/* Day of Week + Language */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {dowStats.length > 0 && (
          <Card className="px-4 py-4" accent="gray">
            <SectionLabel tip="Events grouped by the day of the week they started (based on event start timestamp). Shows avg attendance rate per day — useful for scheduling future events on higher-performing days.">
              Day of Week Performance
            </SectionLabel>
            {[...dowStats].sort((a, b) => b.attRate - a.attRate).map(d => (
              <HBar key={d.name} label={`${d.name} (${d.count} event${d.count > 1 ? 's' : ''})`}
                value={d.attRate} max={maxDowAtt} color="#75787B" suffix="%"
                sub={`avg engagement ${fmtEng(d.avgEng)}`} />
            ))}
          </Card>
        )}

        {langStats.length > 0 && (
          <Card className="px-4 py-4" accent="gray">
            <SectionLabel tip="Events grouped by the language code set in On24 (e.g. 'en', 'de', 'zh'). Bar width shows share of total events. Attendance rate and event count help identify language-specific performance patterns.">
              Language Breakdown
            </SectionLabel>
            {langStats.slice(0, 8).map(l => (
              <div key={l.lang} className="flex items-center gap-2 mb-2 last:mb-0">
                <span className="text-[11px] font-mono font-bold text-ansell-blue w-6 shrink-0 uppercase">{l.lang}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-gray-500">{l.count} event{l.count > 1 ? 's' : ''}</span>
                    <span className="text-gray-600 font-medium">{fmtPct(l.attRate)} att</span>
                  </div>
                  <div className="h-1 bg-gray-100">
                    <div className="h-full bg-ansell-gray" style={{ width: `${Math.min(100, (l.count / filteredWebinars.length) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      </div>
      )}

      {/* ════════════════════════════ ENGAGEMENT ════════════════════════════════ */}
      {activeSection === 'engagement' && (
      <div className="space-y-6">

      {/* Engagement KPIs */}
      <div>
        <SectionLabel tip="Aggregate engagement figures across all events. Requires attendee metrics to be loaded. Benchmarks from ON24 2025 Webinar Benchmarks Report.">
          Key Metrics
        </SectionLabel>
        {(() => {
          const numEngEvents = Math.max(filteredWebinars.filter(w => w.attendeeMetrics?.loaded && getAtt(w) > 0).length, 1);
          const totalInteractions = totals.qa + totals.polls + totals.surveys + totals.dl + totals.reactions;
          const ipa = totals.att > 0 ? totalInteractions / totals.att : 0;
          const qaPerEvent        = totals.qa        / numEngEvents;
          const pollsPerEvent     = totals.polls     / numEngEvents;
          const survPerEvent      = totals.surveys   / numEngEvents;
          const dlPerEvent        = totals.dl        / numEngEvents;
          const reactPerEvent     = totals.reactions / numEngEvents;
          return (
            <>
              {/* Master: Interactions per Attendee */}
              <Card accent="teal" className="px-4 py-3 mb-3">
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-ansell-gray">Interactions per Attendee</p>
                      <InfoTip text="Q&A questions + poll responses + survey responses + resource downloads + reactions, divided by total attendees. Reactions are sourced from the attendee endpoint. ON24 2025 benchmark: 1.7 interactions per attendee (1.9 for personalised experiences)." />
                    </div>
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <p className="text-[28px] font-bold text-ansell-teal leading-tight">
                        {totals.att > 0 ? ipa.toFixed(2) : '—'}
                      </p>
                      {totals.att > 0 && (() => {
                        const above = ipa >= 1.7;
                        const pct   = Math.round(Math.abs(ipa / 1.7 - 1) * 100);
                        return (
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[12px] font-bold ${above ? 'text-emerald-600' : 'text-red-500'}`}>
                              {above ? '▲' : '▼'} {above ? '+' : '-'}{pct}%
                            </span>
                            <span className="text-[10px] text-gray-400">vs ON24 2025 benchmark (1.7)</span>
                          </div>
                        );
                      })()}
                    </div>
                    <p className="text-[9px] text-gray-400 mt-0.5">Q&A + polls + surveys + downloads + reactions per attendee</p>
                  </div>
                  {/* Per-interaction mini breakdown */}
                  <div className="hidden lg:flex items-center gap-5 shrink-0 pr-2">
                    {[
                      { label: 'Q&A',       val: totals.att > 0 ? totals.qa        / totals.att : 0, color: '#D97706' },
                      { label: 'Polls',     val: totals.att > 0 ? totals.polls     / totals.att : 0, color: '#00A28F' },
                      { label: 'Surveys',   val: totals.att > 0 ? totals.surveys   / totals.att : 0, color: '#3B82F6' },
                      { label: 'Downloads', val: totals.att > 0 ? totals.dl        / totals.att : 0, color: '#7C3AED' },
                      { label: 'Reactions', val: totals.att > 0 ? totals.reactions / totals.att : 0, color: '#7030A0' },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="text-center">
                        <p className="text-[17px] font-bold leading-tight" style={{ color }}>{val.toFixed(2)}</p>
                        <p className="text-[8px] text-gray-400 uppercase tracking-wide mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Per-metric grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <InsightCallout label="Total Q&A Questions" value={fmtNum(totals.qa)}
                  sub={totals.att > 0 ? `${(totals.qa / totals.att).toFixed(2)} per att · avg ${qaPerEvent.toFixed(0)}/event` : undefined}
                  benchmark={{ ours: qaPerEvent, reference: 14, refLabel: 'bm: 14/event' }}
                  accent="amber"
                  tip="Sum of all Q&A questions submitted across events. Benchmark: 14 questions per webinar (ON24 2025 report)." />
                <InsightCallout label="Total Poll Responses" value={fmtNum(totals.polls)}
                  sub={totals.att > 0 ? `${(totals.polls / totals.att).toFixed(2)} per att · avg ${pollsPerEvent.toFixed(0)}/event` : undefined}
                  benchmark={{ ours: pollsPerEvent, reference: 130, refLabel: 'bm: 130/event' }}
                  accent="teal"
                  tip="Sum of all poll responses across events. Benchmark: 130 poll responses per webinar (ON24 2025 report)." />
                <InsightCallout label="Total Survey Responses" value={fmtNum(totals.surveys)}
                  sub={totals.att > 0 ? `${(totals.surveys / totals.att).toFixed(2)} per att · avg ${survPerEvent.toFixed(0)}/event` : undefined}
                  benchmark={{ ours: survPerEvent, reference: 19, refLabel: 'bm: 19/event' }}
                  accent="blue"
                  tip="Total post-session survey completions. Benchmark: 19 survey responses per webinar (ON24 2025 report)." />
                <InsightCallout label="Total Downloads" value={fmtNum(totals.dl)}
                  sub={totals.att > 0 ? `${(totals.dl / totals.att).toFixed(2)} per att · avg ${dlPerEvent.toFixed(0)}/event` : undefined}
                  benchmark={{ ours: dlPerEvent, reference: 91, refLabel: 'bm: 91/event' }}
                  accent="violet"
                  tip="Total resource downloads across all events. Benchmark: 91 downloads per webinar (ON24 2025 report)." />
                <InsightCallout label="Total Reactions" value={fmtNum(totals.reactions)}
                  sub={totals.att > 0 ? `${(totals.reactions / totals.att).toFixed(2)} per att · avg ${reactPerEvent.toFixed(0)}/event` : undefined}
                  benchmark={{ ours: reactPerEvent, reference: 37, refLabel: 'bm: 37/event' }}
                  accent="purple"
                  tip="Total emoji reactions (like, heart, celebrate, laugh, etc.) across all events, sourced from the attendee endpoint. Benchmark: 37 reactions per webinar (ON24 2025 report)." />
                <InsightCallout label="Total CTAs Clicked" value={fmtNum(totals.ctaTotal)}
                  sub={totals.att > 0 ? `${fmtPct(totals.ctaTotal / totals.att)} of attendees` : undefined} accent="gray"
                  tip="Sum of all CTA clicks tracked across events. Loaded from the live session data. No industry benchmark available." />
              </div>
            </>
          );
        })()}
      </div>


      {/* Performance Distribution */}
      <Card className="px-4 py-4" accent="blue">
        <SectionLabel tip={`Engagement scores bucketed relative to the best performer in this selection (score ${maxEng.toFixed(2)}). Tiers are Top ≥75%, Good 50–74%, Average 25–49%, Low <25% of the best score — so colours reflect relative performance within your data, not an absolute industry scale.`}>
          Performance Distribution
        </SectionLabel>
        <DistributionBar segments={distribution} />
      </Card>

      {/* Downloaded Resources — 3 panels side-by-side */}
      {topResources.length > 0 && (() => {
        const byWebinar = filteredWebinars
          .map(w => {
            const rb = w.attendeeMetrics?.resourceBreakdown ?? {};
            const total = Object.values(rb).reduce((s, n) => s + n, 0);
            return { w, total };
          })
          .filter(x => x.total > 0)
          .sort((a, b) => b.total - a.total);

        const byTag: Record<string, number> = {};
        const byTagResources: Record<string, Record<string, number>> = {};
        for (const w of filteredWebinars) {
          const rb = w.attendeeMetrics?.resourceBreakdown ?? {};
          const total = Object.values(rb).reduce((s, n) => s + n, 0);
          if (total === 0) continue;
          for (const tag of (w.tags ?? [])) {
            byTag[tag] = (byTag[tag] || 0) + total;
            if (!byTagResources[tag]) byTagResources[tag] = {};
            for (const [res, cnt] of Object.entries(rb)) {
              byTagResources[tag][res] = (byTagResources[tag][res] || 0) + cnt;
            }
          }
        }
        const byTagSorted = Object.entries(byTag).sort((a, b) => b[1] - a[1]);

        const maxResource = topResources[0]?.[1] ?? 1;
        const maxWebinar  = byWebinar[0]?.total ?? 1;
        const maxTag      = byTagSorted[0]?.[1] ?? 1;

        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* ── By Resource ── */}
            <Card className="px-4 py-4" accent="violet">
              <SectionLabel tip="Top downloaded assets across all events, sourced from the ON24 attendee endpoint (resourceviewed field).">
                By Resource
              </SectionLabel>
              <div className="space-y-1.5 mt-3">
                {(resourcesExpanded ? topResources : topResources.slice(0, 5)).map(([name, count], i) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-[10px] text-ansell-gray w-4 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[11px] text-gray-700 truncate" title={name}>{name}</span>
                        <span className="text-[11px] font-semibold text-violet-700 shrink-0">{count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-violet-500" style={{ width: `${(count / maxResource * 100).toFixed(1)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
                {topResources.length > 5 && (
                  <button onClick={() => setResourcesExpanded(v => !v)}
                    className="mt-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors">
                    {resourcesExpanded ? '▲ Show less' : `▼ Show all ${topResources.length} resources`}
                  </button>
                )}
              </div>
            </Card>

            {/* ── By Webinar ── */}
            <Card className="px-4 py-4" accent="violet">
              <SectionLabel tip="Total downloads per webinar. Click a row to expand individual asset breakdown.">
                By Webinar
              </SectionLabel>
              <div className="space-y-2 mt-3">
                {byWebinar.map(({ w, total }, i) => {
                  const isExpanded = expandedWebinars.has(w.eventId);
                  const rb = w.attendeeMetrics?.resourceBreakdown ?? {};
                  const allAssets = Object.entries(rb).sort((a, b) => b[1] - a[1]);
                  return (
                    <div key={w.eventId} className="flex items-start gap-3">
                      <span className="text-[10px] text-ansell-gray w-4 text-right shrink-0 mt-0.5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div
                          className="flex items-center justify-between gap-2 mb-0.5 cursor-pointer select-none"
                          onClick={() => toggleWebinarExpand(w.eventId)}
                        >
                          <span className="flex items-center gap-1 min-w-0">
                            <svg className={`w-3 h-3 shrink-0 text-gray-400 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <EventNamePopover eventId={w.eventId} name={w.webinarName} campaignName={w.campaignName}
                              display={<span className="text-[11px] font-medium text-gray-800 truncate block">{truncate(w.webinarName, 40)}</span>} />
                          </span>
                          <span className="text-[11px] font-semibold text-violet-700 shrink-0">{total}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-0.5">
                          <div className="h-full rounded-full bg-violet-400" style={{ width: `${(total / maxWebinar * 100).toFixed(1)}%` }} />
                        </div>
                        {!isExpanded && allAssets.length > 0 && (
                          <p className="text-[9px] text-gray-400 truncate">{allAssets.slice(0, 2).map(([n, c]) => `${n} (${c})`).join(' · ')}{allAssets.length > 2 ? ` · +${allAssets.length - 2}` : ''}</p>
                        )}
                        {isExpanded && allAssets.length > 0 && (
                          <div className="mt-1.5 pl-3 border-l-2 border-violet-100 space-y-1">
                            {allAssets.map(([name, count]) => (
                              <div key={name} className="flex items-center justify-between gap-2">
                                <span className="text-[10px] text-gray-600 truncate" title={name}>{name}</span>
                                <span className="text-[10px] font-semibold text-violet-600 shrink-0">{count}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* ── By Tag ── */}
            <Card className="px-4 py-4" accent="violet">
              <SectionLabel tip="Total downloads across all webinars sharing each tag. Click a row to expand asset breakdown for that tag.">
                By Tag
              </SectionLabel>
              {byTagSorted.length === 0
                ? <p className="text-[11px] text-gray-400 mt-3">No tag data available.</p>
                : (
                  <div className="space-y-2 mt-3">
                    {byTagSorted.map(([tag, count], i) => {
                      const isExpanded = expandedTags.has(tag);
                      const tagAssets = Object.entries(byTagResources[tag] ?? {}).sort((a, b) => b[1] - a[1]);
                      return (
                        <div key={tag} className="flex items-start gap-3">
                          <span className="text-[10px] text-ansell-gray w-4 text-right shrink-0 mt-0.5">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div
                              className="flex items-center justify-between gap-2 mb-0.5 cursor-pointer select-none"
                              onClick={() => toggleTagExpand(tag)}
                            >
                              <span className="flex items-center gap-1">
                                <svg className={`w-3 h-3 shrink-0 text-gray-400 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span className="text-[11px] text-gray-700">{tag}</span>
                              </span>
                              <span className="text-[11px] font-semibold text-violet-700 shrink-0">{count}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-violet-400" style={{ width: `${(count / maxTag * 100).toFixed(1)}%` }} />
                            </div>
                            {!isExpanded && tagAssets.length > 0 && (
                              <p className="text-[9px] text-gray-400 mt-0.5 truncate">{tagAssets.slice(0, 2).map(([n, c]) => `${n} (${c})`).join(' · ')}{tagAssets.length > 2 ? ` · +${tagAssets.length - 2}` : ''}</p>
                            )}
                            {isExpanded && tagAssets.length > 0 && (
                              <div className="mt-1.5 pl-3 border-l-2 border-violet-100 space-y-1">
                                {tagAssets.map(([name, cnt]) => (
                                  <div key={name} className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] text-gray-600 truncate" title={name}>{name}</span>
                                    <span className="text-[10px] font-semibold text-violet-600 shrink-0">{cnt}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              }
            </Card>

          </div>
        );
      })()}

      {/* Top vs Needs Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="px-4 py-4" accent="teal">
          <SectionLabel tip="Ranked by engagement score. Bar width is relative to the best performer in this selection — the top event always fills 100%. Raw score shown in the sub-label.">
            Top Engagement
          </SectionLabel>
          {topEngagers.map((w, i) => (
            <HBar key={w.eventId}
              label={<EventNamePopover eventId={w.eventId} name={w.webinarName} campaignName={w.campaignName} display={`${i + 1}. ${truncate(w.webinarName, 52)}`} />}
              value={getEng(w)} max={maxEng} color="#00A28F"
              sub={`score ${fmtEng(getEng(w))} · ${fmtNum(getAtt(w))} att · ${fmtPct(getAttRate(w))} rate`} />
          ))}
        </Card>
        <Card className="px-4 py-4" accent="gray">
          <SectionLabel tip="Lowest-scoring events among those with attendees. Bar width is relative to the best performer — so even the lowest bar shows how far below the top they are.">
            Needs Attention
          </SectionLabel>
          {bottomEngagers.map((w, i) => (
            <HBar key={w.eventId}
              label={<EventNamePopover eventId={w.eventId} name={w.webinarName} campaignName={w.campaignName} display={`${i + 1}. ${truncate(w.webinarName, 52)}`} />}
              value={getEng(w)} max={maxEng} color="#DC2626"
              sub={`score ${fmtEng(getEng(w))} · ${fmtNum(getAtt(w))} att · ${fmtPct(getAttRate(w))} rate`} />
          ))}
        </Card>
      </div>

      {/* Engagement Leaders */}
      {(() => {
        const PREVIEW = 5;
        type LeaderCfg = { key: string; title: string; tipText: string; color: string; textCls: string; items: WebinarSummary[]; getValue: (w: WebinarSummary) => number; getMax: (arr: WebinarSummary[]) => number; getSub: (w: WebinarSummary) => string; emptyMsg: string };
        const leaders: LeaderCfg[] = [
          {
            key: 'qa', title: 'Q&A Activity', color: '#D97706', textCls: 'text-amber-600',
            tipText: 'Questions per attendee = total Q&A questions submitted / number of attendees. Higher ratio means the topic generated strong curiosity.',
            items: topQA, getValue: w => parseFloat((getQA(w) / getAtt(w)).toFixed(2)),
            getMax: arr => Math.max(...arr.map(x => getQA(x) / getAtt(x)), 0.01),
            getSub: w => `${getQA(w)} questions · ${fmtNum(getAtt(w))} att`,
            emptyMsg: 'No Q&A data loaded yet',
          },
          {
            key: 'polls', title: 'Poll Participation', color: '#00A28F', textCls: 'text-ansell-teal',
            tipText: 'Poll responses per attendee. A ratio above 1.0 means attendees answered more than one poll on average.',
            items: topPolls, getValue: w => parseFloat((getPolls(w) / getAtt(w)).toFixed(2)),
            getMax: arr => Math.max(...arr.map(x => getPolls(x) / getAtt(x)), 0.01),
            getSub: w => `${getPolls(w)} responses · ${fmtNum(getAtt(w))} att`,
            emptyMsg: 'No poll data loaded yet',
          },
          {
            key: 'surveys', title: 'Survey Responses', color: '#3B82F6', textCls: 'text-blue-600',
            tipText: 'Survey completions per attendee. High rates indicate strong end-of-session engagement.',
            items: topSurveys, getValue: w => parseFloat((getSurveys(w) / getAtt(w)).toFixed(2)),
            getMax: arr => Math.max(...arr.map(x => getSurveys(x) / getAtt(x)), 0.01),
            getSub: w => `${getSurveys(w)} surveys · ${fmtNum(getAtt(w))} att`,
            emptyMsg: 'No survey data loaded yet',
          },
          {
            key: 'dl', title: 'Resource Downloads', color: '#7C3AED', textCls: 'text-violet-700',
            tipText: 'Ranked by total downloads to surface events where content was most in demand.',
            items: topDL, getValue: getDL,
            getMax: arr => Math.max(...arr.map(getDL), 1),
            getSub: w => `${getDL(w)} downloads · ${fmtPct(getDL(w) / getAtt(w))} rate`,
            emptyMsg: 'No download data',
          },
          {
            key: 'reactions', title: 'Reactions', color: '#7030A0', textCls: 'text-purple-700',
            tipText: 'Emoji reactions per attendee (like 👍, heart ❤️, celebrate 🎉, laugh 😄). The stacked bar shows the breakdown by reaction type for each event.',
            items: topReactions, getValue: w => parseFloat((getReactions(w) / getAtt(w)).toFixed(2)),
            getMax: arr => Math.max(...arr.map(x => getReactions(x) / getAtt(x)), 0.01),
            getSub: w => `${getReactions(w)} reactions · ${fmtNum(getAtt(w))} att`,
            emptyMsg: 'No reaction data loaded yet',
          },
          {
            key: 'cta', title: 'CTA Clicks', color: '#75787B', textCls: 'text-ansell-gray',
            tipText: 'CTA clicks per attendee, ranked across events. Loaded from live session data.',
            items: topCTA, getValue: w => liveCtaCounts[w.eventId] ?? 0,
            getMax: arr => Math.max(...arr.map(w => liveCtaCounts[w.eventId] ?? 0), 1),
            getSub: w => `${liveCtaCounts[w.eventId] ?? 0} clicks · ${fmtNum(getAtt(w))} att`,
            emptyMsg: 'No CTA data loaded yet',
          },
        ];
        return (
          <div>
            <SectionLabel tip="Each column shows top events for that engagement type, normalised per attendee where applicable. Requires attendee metrics to be loaded. Use 'Show all' to see every event with data.">
              Engagement Leaders
            </SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {leaders.map(({ key, title, tipText, color, textCls, items, getValue, getMax, getSub, emptyMsg }) => {
                const isExpanded = expandedLeaders.has(key);
                const displayed  = isExpanded ? items : items.slice(0, PREVIEW);
                const maxVal     = getMax(items);
                return (
                  <Card key={key} className="px-4 py-4" style={{ borderTop: `5px solid ${color}` }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className={`text-[9px] font-bold uppercase tracking-wider ${textCls}`}>{title}</p>
                      <InfoTip text={tipText} />
                    </div>
                    {items.length === 0
                      ? <p className="text-[10px] text-gray-400">{emptyMsg}</p>
                      : <>
                          {displayed.map((w, i) => (
                            <div key={w.eventId}>
                              <HBar
                                label={<EventNamePopover eventId={w.eventId} name={w.webinarName} campaignName={w.campaignName} display={`${i + 1}. ${truncate(w.webinarName, 42)}`} />}
                                value={getValue(w)} max={maxVal} color={color} sub={getSub(w)} />
                              {key === 'reactions' && (
                                <StackedReactionBar byType={w.attendeeMetrics?.reactionsByType ?? {}} total={getReactions(w)} />
                              )}
                            </div>
                          ))}
                          {items.length > PREVIEW && (
                            <button
                              onClick={() => toggleLeader(key)}
                              className="mt-2 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              {isExpanded ? '▲ Show less' : `▼ Show all ${items.length} events`}
                            </button>
                          )}
                        </>
                    }
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Engagement by Source */}
      {qualifiedSources.length > 0 && sourcesStatus === 'done' && (() => {
        type EngMetric = { key: string; label: string; color: string; get: (s: MergedSource) => number };
        const allMetrics: EngMetric[] = [
          { key: 'qa',        label: 'Q&A / att',        color: '#D97706', get: (s: MergedSource) => s.attendees > 0 ? s.qa        / s.attendees : 0 },
          { key: 'polls',     label: 'Polls / att',      color: '#00A28F', get: (s: MergedSource) => s.attendees > 0 ? s.polls     / s.attendees : 0 },
          { key: 'surveys',   label: 'Surveys / att',    color: '#3B82F6', get: (s: MergedSource) => s.attendees > 0 ? s.surveys   / s.attendees : 0 },
          { key: 'dl',        label: 'Downloads / att',  color: '#7C3AED', get: (s: MergedSource) => s.attendees > 0 ? s.dl        / s.attendees : 0 },
          { key: 'reactions', label: 'Reactions / att',  color: '#7030A0', get: (s: MergedSource) => s.attendees > 0 ? s.reactions / s.attendees : 0 },
        ];
        const metrics = allMetrics.filter(m => qualifiedSources.some(s => m.get(s) > 0));
        if (metrics.length === 0) return null;
        const maxAttRate    = Math.max(...qualifiedSources.map(s => s.attendees / s.registrants), 0.001);
        const maxPerMetric  = metrics.map(m => Math.max(...qualifiedSources.map(q => m.get(q)), 0.001));
        return (
          <Card className="px-4 py-4" accent="amber">
            <SectionLabel tip="Engagement rates per attendee by registration source. Only sources with ≥5 registrants shown. Bars are relative to the best performer in each column. Reactions column shows stacked breakdown by type.">
              Engagement by Source
            </SectionLabel>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left font-semibold text-gray-500 pb-2 pr-4">Source</th>
                    <th className="text-right font-semibold pb-2 px-3 min-w-[110px]" style={{ color: '#059669' }}>Att Rate</th>
                    {metrics.map(m => (
                      <th key={m.key} className="text-right font-semibold pb-2 px-3 min-w-[120px]" style={{ color: m.color }}>{m.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {qualifiedSources.map(s => {
                    const attRate = s.registrants > 0 ? s.attendees / s.registrants : 0;
                    const attPct  = maxAttRate > 0 ? (attRate / maxAttRate) * 100 : 0;
                    return (
                      <tr key={s.code} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-2 pr-4 text-gray-700 font-medium max-w-[140px] truncate" title={decodeSource(s.code)}>
                          {decodeSource(s.code)}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="w-14 h-1.5 bg-gray-100 overflow-hidden">
                              <div className="h-full" style={{ width: `${attPct}%`, backgroundColor: attRateColor(attRate) }} />
                            </div>
                            <span className="font-semibold w-9 text-right shrink-0" style={{ color: attRateColor(attRate) }}>{fmtPct(attRate)}</span>
                          </div>
                        </td>
                        {metrics.map((m, mi) => {
                          const val  = m.get(s);
                          const barW = maxPerMetric[mi] > 0 ? (val / maxPerMetric[mi]) * 100 : 0;
                          return (
                            <td key={m.key} className="py-2 px-3">
                              <div className="flex items-center gap-2 justify-end">
                                <div className="w-14 h-1.5 bg-gray-100 overflow-hidden">
                                  <div className="h-full" style={{ width: `${barW}%`, backgroundColor: m.color }} />
                                </div>
                                <span className="font-semibold w-9 text-right shrink-0" style={{ color: m.color }}>
                                  {val > 0 ? val.toFixed(2) : '—'}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })()}

      {/* Tag Performance */}
      {tagStats.length > 0 && (
        <Card className="px-4 py-4" accent="blue">
          <SectionLabel tip="For each tag, computes the average engagement score across all events carrying that tag. Only tags used on 2+ events are shown. Useful for identifying which content themes resonate best.">
            Tag Performance (avg engagement · min 2 events)
          </SectionLabel>
          {tagStats.slice(0, 10).map(t => (
            <HBar key={t.tag} label={`${t.tag} (${t.count})`} value={t.avgEng}
              max={maxTagEng} color="#0063AC"
              sub={`${fmtPct(t.avgAtt)} avg att rate · ${t.totalQA} Q&A`} />
          ))}
        </Card>
      )}

      </div>
      )}

      {/* ════════════════════════════ REVENUE ════════════════════════════════════ */}
      {activeSection === 'revenue' && (
      <div className="space-y-6">

      {/* File bar + upload */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-1">
        <div>
          {revenueStatus === 'done' && revenueData && (
            <p className="text-[11px] text-gray-500">
              Loaded: <span className="font-semibold text-gray-700">{revenueData.fileName}</span>
              <span className="ml-2 text-gray-400">· {revenueData.programs.length} programs · {revenueData.totals.opportunityCount.toLocaleString()} opportunities</span>
            </p>
          )}
          {revenueStatus === 'loading' && <p className="text-[11px] text-gray-400">Loading revenue data…</p>}
          {revenueStatus === 'error' && <p className="text-[11px] text-red-500">{revenueError}</p>}
        </div>
        <label className={`px-3 py-1.5 text-[11px] font-semibold border cursor-pointer transition-colors ${uploading ? 'text-gray-300 border-gray-200 cursor-default' : 'text-emerald-700 border-emerald-400 hover:bg-emerald-50'}`}>
          {uploading ? 'Uploading…' : '↑ Upload new report'}
          <input type="file" accept=".xlsx" className="sr-only" disabled={uploading} onChange={async e => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            try {
              const fd = new FormData();
              fd.append('file', file);
              const res = await fetch('/api/revenue/upload', { method: 'POST', body: fd });
              const json = await res.json();
              if (json.success) {
                const r = await fetch('/api/revenue/data');
                const d = await r.json();
                if (!d.error) { setRevenueData(d); setRevenueStatus('done'); }
              }
            } finally { setUploading(false); e.target.value = ''; }
          }} />
        </label>
      </div>

      {revenueData && (() => {
        const t = revenueData.totals;
        const isMT = revAttribution === 'mt';
        const fmtRev = (n: number) =>
          n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
          : n >= 1_000   ? `$${(n / 1_000).toFixed(0)}K`
          : `$${Math.round(n)}`;

        // Build campaign → webinars lookup (all webinars for cross-ref)
        const campaignMap = new Map<string, WebinarSummary[]>();
        for (const w of webinars) {
          if (!w.campaignName) continue;
          const keys = [w.campaignName, w.campaignName.replace(/\*[^*]*$/, '')];
          for (const k of keys) {
            if (!campaignMap.has(k)) campaignMap.set(k, []);
            campaignMap.get(k)!.push(w);
          }
        }
        const getMatches = (programName: string): WebinarSummary[] => {
          const stripped = programName.replace(/\*[^*]*$/, '');
          return campaignMap.get(programName) || campaignMap.get(stripped) || [];
        };

        const getWon     = (p: ProgramRevenue) => isMT ? p.mtWon     : p.ftWon;
        const getCreated = (p: ProgramRevenue) => isMT ? p.mtCreated : p.ftCreated;

        const allPrograms = [...revenueData.programs].sort((a, b) => (getWon(b) + getCreated(b)) - (getWon(a) + getCreated(a)));
        const matched = allPrograms.filter(p => getMatches(p.programName).length > 0);
        const visiblePrograms = revShowAll ? allPrograms : matched;

        const wonTotal     = visiblePrograms.reduce((s, p) => s + getWon(p), 0);
        const createdTotal = visiblePrograms.reduce((s, p) => s + getCreated(p), 0);
        const attrLabel    = isMT ? 'Multi-Touch' : 'First-Touch';

        return (
          <>
            {/* Toggles */}
            <div className="flex flex-wrap gap-4 items-center">
              {/* FT / MT */}
              <div className="flex">
                {(['mt', 'ft'] as const).map(v => (
                  <button key={v} onClick={() => setRevAttribution(v)}
                    className={`px-3 py-1.5 text-[11px] font-semibold border transition-colors first:rounded-l last:rounded-r ${revAttribution === v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                    {v.toUpperCase()}
                  </button>
                ))}
              </div>
              {/* Matched / All */}
              <div className="flex">
                {([false, true] as const).map(v => (
                  <button key={String(v)} onClick={() => setRevShowAll(v)}
                    className={`px-3 py-1.5 text-[11px] font-semibold border transition-colors first:rounded-l last:rounded-r ${revShowAll === v ? 'bg-ansell-blue text-white border-ansell-blue' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                    {v ? 'All programs' : 'Matched only'}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="px-4 py-4" accent="blue">
                <p className="text-[9px] font-bold uppercase tracking-widest text-ansell-gray mb-1">{attrLabel} Created</p>
                <p className="text-[28px] font-extrabold leading-tight text-sky-600">{fmtRev(createdTotal)}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">pipeline created attributed · {visiblePrograms.filter(p => getCreated(p) > 0).length} programs</p>
              </Card>
              <Card className="px-4 py-4" accent="teal">
                <p className="text-[9px] font-bold uppercase tracking-widest text-ansell-gray mb-1">{attrLabel} Won</p>
                <p className="text-[28px] font-extrabold leading-tight text-emerald-600">{fmtRev(wonTotal)}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">closed revenue attributed · {visiblePrograms.filter(p => getWon(p) > 0).length} programs</p>
              </Card>
            </div>

            {/* Programs table */}
            <Card className="px-4 py-4" accent="teal">
              <SectionLabel tip={`${attrLabel} attribution: credit × Amount USD = attributed revenue. ${revShowAll ? 'All programs shown.' : 'Showing only programs matched to ON24 campaign codes.'} Sorted by ${attrLabel} Won + Created.`}>
                {revShowAll ? `All Programs (${visiblePrograms.length})` : `ON24-Matched Programs (${visiblePrograms.length})`}
              </SectionLabel>
              {visiblePrograms.length === 0 ? (
                <p className="text-[11px] text-gray-400 mt-2">No programs matched to ON24 campaign codes.</p>
              ) : (
                <div className="overflow-x-auto -mx-4 px-4">
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="pb-2 text-left text-[9px] font-bold uppercase tracking-wider text-ansell-gray w-6">#</th>
                        <th className="pb-2 text-left text-[9px] font-bold uppercase tracking-wider text-ansell-gray">Program Name</th>
                        <th className="pb-2 text-right text-[9px] font-bold uppercase tracking-wider text-sky-600">{isMT ? 'MT' : 'FT'} Created</th>
                        <th className="pb-2 text-right text-[9px] font-bold uppercase tracking-wider text-emerald-600 pl-4">{isMT ? 'MT' : 'FT'} Won</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePrograms.map((p, i) => {
                        const matches = getMatches(p.programName);
                        const won     = getWon(p);
                        const created = getCreated(p);
                        return (
                          <tr key={p.programName} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-2 pr-2 text-[10px] text-gray-400 text-right">{i + 1}</td>
                            <td className="py-2 pr-4 max-w-0 w-full">
                              <div className="truncate text-[11px] text-gray-800 font-medium" title={p.programName}>
                                {p.programName}
                              </div>
                              {matches.length > 0 && (
                                <div className="text-[9px] text-emerald-600 mt-0.5 flex flex-wrap gap-x-1 items-center">
                                  {matches.slice(0, 2).map((w, mi) => (
                                    <span key={w.eventId} className="inline-flex items-center gap-0.5">
                                      {mi > 0 && <span className="text-emerald-300">·</span>}
                                      <EventNamePopover eventId={w.eventId} name={w.webinarName} campaignName={w.campaignName}
                                        display={<span className="underline decoration-dotted cursor-pointer">{truncate(w.webinarName, 35)}</span>} />
                                    </span>
                                  ))}
                                  {matches.length > 2 && <span className="text-emerald-400">+{matches.length - 2} more</span>}
                                </div>
                              )}
                            </td>
                            <td className="py-2 text-right text-[11px] text-sky-700">{created > 0 ? fmtRev(created) : '—'}</td>
                            <td className="py-2 text-right text-[11px] font-semibold text-emerald-700 pl-4">{won > 0 ? fmtRev(won) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        );
      })()}

      </div>
      )}

    </div>
  );
}
