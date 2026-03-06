import { NextRequest, NextResponse } from 'next/server';
import { getOn24Client } from '@/lib/on24/client';

export const dynamic = 'force-dynamic';

const CONCURRENCY = 4;
const DELAY_MS = 250;

const FIELDS = ['auto', 'partnerref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;
type Field = typeof FIELDS[number];

type RegRaw = {
  partnerref?: string;
  email?: string;
  utm_source?: string; utmsource?: string;
  utm_medium?: string; utmmedium?: string;
  utm_campaign?: string; utmcampaign?: string;
  utm_content?: string;
  customFields?: Record<string, string>;
  [key: string]: unknown;
};

function pickUtm(reg: RegRaw, key: string): string {
  const noUnderscore = key.replace('_', '');
  return (
    (reg[key] as string | undefined) ||
    (reg[noUnderscore] as string | undefined) ||
    reg.customFields?.[key] ||
    reg.customFields?.[noUnderscore] ||
    ''
  ).trim();
}

function getCode(reg: RegRaw, field: Field): string | null {
  switch (field) {
    case 'auto': {
      const utmSrc = pickUtm(reg, 'utm_source');
      return utmSrc || (reg.partnerref || '').trim() || '(direct)';
    }
    case 'partnerref':
      return (reg.partnerref || '').trim() || '(direct)';
    case 'utm_source':
      return pickUtm(reg, 'utm_source') || null;   // null = no data
    case 'utm_medium':
      return pickUtm(reg, 'utm_medium') || null;
    case 'utm_campaign':
      return pickUtm(reg, 'utm_campaign') || null;
    case 'utm_content':
      return pickUtm(reg, 'utm_content') || null;
  }
}

async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let idx = 0;
  const worker = async () => {
    while (idx < items.length) {
      const i = idx++;
      if (DELAY_MS > 0 && i > 0) await new Promise(r => setTimeout(r, DELAY_MS));
      await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export async function POST(request: NextRequest) {
  try {
    const { eventIds } = await request.json() as { eventIds: number[] };
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No event IDs provided' }, { status: 400 });
    }

    const client = getOn24Client();

    type SrcEntry = { registrants: number; attendees: number; qa: number; dl: number; polls: number; surveys: number; reactions: number; reactionsByType: Record<string, number> };

    // Per-field: code -> { registrants, attendees, engagement counts }
    const aggregates: Record<Field, Map<string, SrcEntry>> = {
      auto: new Map(), partnerref: new Map(),
      utm_source: new Map(), utm_medium: new Map(),
      utm_campaign: new Map(), utm_content: new Map(),
    };
    // How many registrants have a non-empty value for each UTM field
    const coverage: Record<Field, number> = {
      auto: 0, partnerref: 0,
      utm_source: 0, utm_medium: 0, utm_campaign: 0, utm_content: 0,
    };
    let totalReg = 0, totalAtt = 0;

    await withConcurrency(eventIds, CONCURRENCY, async (eventId) => {
      try {
        const [registrants, attendees] = await Promise.all([
          client.listRegistrants(eventId).catch(() => []),
          client.listAttendees(eventId).catch(() => []),
        ]);

        // Build email → engagement map from attendees
        type AttEng = { qa: number; dl: number; polls: number; surveys: number; reactions: number; reactionsByType: Record<string, number> };
        const attEngMap = new Map<string, AttEng>();
        for (const a of attendees as (RegRaw & { askedquestions?: number; resourcesdownloaded?: number; answeredpolls?: number; answeredsurveys?: number; reactions?: Array<{ type: string }> })[]) {
          if (a.email) {
            const reactionsByType: Record<string, number> = {};
            if (Array.isArray(a.reactions)) {
              for (const r of a.reactions) { if (r.type) reactionsByType[r.type] = (reactionsByType[r.type] || 0) + 1; }
            }
            attEngMap.set((a.email as string).toLowerCase(), {
              qa:             Number(a.askedquestions)      || 0,
              dl:             Number(a.resourcesdownloaded) || 0,
              polls:          Number(a.answeredpolls)        || 0,
              surveys:        Number(a.answeredsurveys)      || 0,
              reactions:      Array.isArray(a.reactions) ? a.reactions.length : 0,
              reactionsByType,
            });
          }
        }

        const attendeeEmails = new Set(attEngMap.keys());

        for (const reg of registrants as RegRaw[]) {
          const emailLower = (reg.email as string | undefined || '').toLowerCase();
          const isAttendee = !!(emailLower && attendeeEmails.has(emailLower));
          const attEng = isAttendee ? attEngMap.get(emailLower) : undefined;
          totalReg++;
          if (isAttendee) totalAtt++;

          for (const field of FIELDS) {
            const code = getCode(reg, field);
            if (code === null) continue; // field has no data for this registrant
            const agg = aggregates[field];
            const entry = agg.get(code) || { registrants: 0, attendees: 0, qa: 0, dl: 0, polls: 0, surveys: 0, reactions: 0, reactionsByType: {} };
            entry.registrants++;
            if (isAttendee) {
              entry.attendees++;
              if (attEng) {
                entry.qa       += attEng.qa;
                entry.dl       += attEng.dl;
                entry.polls    += attEng.polls;
                entry.surveys  += attEng.surveys;
                entry.reactions += attEng.reactions;
                for (const [t, c] of Object.entries(attEng.reactionsByType)) {
                  entry.reactionsByType[t] = (entry.reactionsByType[t] || 0) + c;
                }
              }
            }
            agg.set(code, entry);
            if (field !== 'auto' && field !== 'partnerref' && code !== '(direct)') coverage[field]++;
          }
          // Coverage for partnerref = has non-empty partnerref
          if ((reg.partnerref || '').trim()) coverage.partnerref++;
          // Auto coverage = all registrants (always produces a code)
          coverage.auto++;
        }
      } catch (err) {
        console.error(`[registration-sources] Event ${eventId} failed:`, err);
      }
    });

    const toSources = (agg: Map<string, SrcEntry>) =>
      Array.from(agg.entries())
        .map(([code, c]) => ({ code, registrants: c.registrants, attendees: c.attendees, qa: c.qa, dl: c.dl, polls: c.polls, surveys: c.surveys, reactions: c.reactions, reactionsByType: c.reactionsByType }))
        .sort((a, b) => b.registrants - a.registrants);

    const breakdowns: Record<Field, { sources: ReturnType<typeof toSources>; coverage: number }> = {} as never;
    for (const field of FIELDS) {
      breakdowns[field] = { sources: toSources(aggregates[field]), coverage: coverage[field] };
    }

    return NextResponse.json({
      success: true,
      breakdowns,
      totalRegistrants: totalReg,
      totalAttendees: totalAtt,
      // Keep legacy `sources` for backwards compat (= auto breakdown)
      sources: breakdowns.auto.sources,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
