import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'auth_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(req: NextRequest) {
  const { username, password } = await req.json() as { username: string; password: string };

  const validUser  = process.env.AUTH_USERNAME;
  const validPass  = process.env.AUTH_PASSWORD;
  const sessionToken = process.env.AUTH_SESSION_TOKEN;

  if (!validUser || !validPass || !sessionToken) {
    return NextResponse.json({ success: false, error: 'Auth not configured' }, { status: 500 });
  }

  if (username === validUser && password === validPass) {
    const res = NextResponse.json({ success: true });
    res.cookies.set(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
    return res;
  }

  return NextResponse.json({ success: false, error: 'Invalid username or password' }, { status: 401 });
}
