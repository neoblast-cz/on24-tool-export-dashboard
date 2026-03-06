import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Temporary debug endpoint - probe raw On24 API endpoints for an event
export async function GET(request: NextRequest) {
  const eventId = Number(request.nextUrl.searchParams.get('eventId'));
  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 });
  }

  const clientId = process.env.ON24_CLIENT_ID;
  const tokenKey = process.env.ON24_TOKEN_KEY;
  const tokenSecret = process.env.ON24_TOKEN_SECRET;
  const baseUrl = process.env.ON24_API_BASE_URL || 'https://api.on24.com/v2';

  if (!clientId || !tokenKey || !tokenSecret) {
    return NextResponse.json({ error: 'API credentials not configured' }, { status: 500 });
  }

  const headers: HeadersInit = {
    accesstokenkey: tokenKey,
    accesstokensecret: tokenSecret,
    accept: 'application/json',
  };

  // Test endpoint paths SEQUENTIALLY to avoid rate limiting
  const paths = [
    'question', 'qa', 'questions',
    'resource', 'resources', 'resourcedownload',
    'reaction', 'reactions', 'engagementactivity',
    'poll', 'survey', 'cta',
  ];

  const results: Record<string, { status: number; preview: string }> = {};

  for (const path of paths) {
    const url = `${baseUrl}/client/${clientId}/event/${eventId}/${path}?pageSize=5`;
    try {
      const response = await fetch(url, { method: 'GET', headers });
      const bodyText = await response.text();
      results[path] = {
        status: response.status,
        preview: bodyText.slice(0, 400),
      };
    } catch (err) {
      results[path] = {
        status: -1,
        preview: err instanceof Error ? err.message : 'error',
      };
    }
    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return NextResponse.json({ eventId, results });
}
