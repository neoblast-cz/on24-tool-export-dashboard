import { NextRequest, NextResponse } from 'next/server';
import { getOn24Client } from '@/lib/on24/client';

const MAX_BATCH_SIZE = 25;
const MAX_CONCURRENT = 5;
const DELAY_MS = 150;

async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  delayMs: number,
  fn: (item: T) => Promise<R>,
): Promise<Map<number, R>> {
  const results = new Map<number, R>();
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      if (delayMs > 0 && i > 0) await new Promise(r => setTimeout(r, delayMs));
      try { results.set(i, await fn(items[i])); } catch { /* skip */ }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventIds: number[] = body?.eventIds;

    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json({ success: false, error: 'eventIds array is required' }, { status: 400 });
    }

    const cappedIds = eventIds.slice(0, MAX_BATCH_SIZE);
    const client = getOn24Client();
    const counts: Record<number, number> = {};

    await processWithConcurrency(cappedIds, MAX_CONCURRENT, DELAY_MS, async (eventId: number) => {
      try {
        const ctas = await client.getCTAClicks(eventId);
        counts[eventId] = ctas.reduce((sum, c) => sum + (c.totalclicks ?? 0), 0);
      } catch {
        counts[eventId] = 0;
      }
    });

    return NextResponse.json({ success: true, counts });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
