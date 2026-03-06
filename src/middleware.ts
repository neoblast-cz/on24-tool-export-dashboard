import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'auth_session';

// Paths that don't require authentication
const PUBLIC_PREFIXES = ['/login', '/api/auth'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths through
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = req.cookies.get(COOKIE_NAME)?.value;
  const expected = process.env.AUTH_SESSION_TOKEN;

  if (!expected || session !== expected) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match everything except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
