import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Extract headers
  const url = request.nextUrl.clone();
  const proto = request.headers.get('x-forwarded-proto') || url.protocol;

  // 1. Redirect HTTP to HTTPS in production
  if (process.env.NODE_ENV === 'production' && !proto.includes('https')) {
    url.protocol = 'https:';
    return NextResponse.redirect(url, 301);
  }

  // 2. Add Security Headers
  const response = NextResponse.next();

  // Enforce HTTPS natively (HSTS)
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  
  // Prevent MIME-type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // Basic XSS protection
  response.headers.set('X-XSS-Protection', '1; mode=block');

  return response;
}

export const config = {
  // Apply middleware to all routes except static assets and api
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
