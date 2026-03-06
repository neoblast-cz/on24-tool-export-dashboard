import { NextRequest, NextResponse } from 'next/server';
import { getOn24Client } from '@/lib/on24/client';
import { aggregateAttendeeMetrics, createErrorMetrics } from '@/lib/analytics/attendee-aggregator';
import { AttendeeMetrics } from '@/types/webinar';

const MAX_BATCH_SIZE = 25;
const MAX_CONCURRENT = 5;
const DELAY_MS = 200;

// Process items with concurrency limit and delay
async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  delayMs: number,
  fn: (item: T) => Promise<R>
): Promise<Map<number, R>> {
  const results = new Map<number, R>();
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      if (delayMs > 0 && currentIndex > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      try {
        const result = await fn(item);
        results.set(currentIndex, result);
      } catch {
        results.set(currentIndex, undefined as unknown as R);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventIds: number[] = body?.eventIds;

    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'eventIds array is required' },
        { status: 400 }
      );
    }

    const cappedIds = eventIds.slice(0, MAX_BATCH_SIZE);
    const client = getOn24Client();
    const metricsMap: Record<number, AttendeeMetrics> = {};

    await processWithConcurrency(
      cappedIds,
      MAX_CONCURRENT,
      DELAY_MS,
      async (eventId: number) => {
        try {
          const attendees = await client.listAttendees(eventId);
          metricsMap[eventId] = aggregateAttendeeMetrics(attendees);
        } catch (err) {
          metricsMap[eventId] = createErrorMetrics(
            err instanceof Error ? err.message : 'Failed to fetch attendees'
          );
        }
      }
    );

    // Response contains ONLY aggregated numeric metrics - no PII
    return NextResponse.json({
      success: true,
      metrics: metricsMap,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
