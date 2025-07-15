import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { cookies } from 'next/headers';

// Specify server-side runtime for this middleware
export const runtime = 'nodejs';

// Public routes that don't require authentication
const publicRoutes = [
  '/auth',
  '/api/auth',
  '/api/compliance',
  '/',
  '/api/init-db',
  '/api/init-compliance-db',
  '/api/env-check',
  '/api/db-status',
  '/api/direct-db-test',
  '/check-db',
  '/debug',
  '/_next',
  '/api/businesses'
];

export async function middleware(request: NextRequest) {
  // Get path
  const pathname = request.nextUrl.pathname;
  console.log('Middleware executing for path:', pathname);
  
  // Check if the pathname starts with any of the public routes
  const isPublicRoute = publicRoutes.some((route) => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
  console.log(`Middleware: Pathname: ${pathname}, IsPublicRoute: ${isPublicRoute}`);
  
  // Get session from iron-session
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  console.log(`Middleware: Raw Cookie Header: ${request.headers.get('cookie')}`);
  console.log(`Middleware: Session isLoggedIn: ${session.isLoggedIn}`);
  console.log(`Middleware: Session ID: ${session.id}`);

  // Enhanced logging for session and protocol debugging
  const enableMiddlewareLogging = process.env.DEBUG_MIDDLEWARE === 'true' || process.env.DEBUG_SESSION === 'true';
  const timestamp = new Date().toISOString();
  
  // Detect protocol for cookie security settings
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const isHttps = protocol === 'https';
  
  // Create the response object
  let response;
  
  if (isPublicRoute) {
    // Public route - no need to log
    response = NextResponse.next();
  } else {
    // If there's no session and it's not a public route, redirect to auth page
    if (!session.isLoggedIn) {
      const url = new URL('/auth', request.url);
      url.searchParams.set('callbackUrl', pathname);
      url.searchParams.set('reason', 'no_session');
      return NextResponse.redirect(url);
    }
    response = NextResponse.next();
  }
  
  // Add protocol and session information to all responses
  // This helps internal components correctly set cookie security settings
  // Reuse the protocol and isHttps variables from above
  
  // Apply protocol detection headers to help with cookie settings
  response.headers.set('X-Request-Protocol', protocol);
  response.headers.set('X-Secure-Cookie', isHttps || process.env.NODE_ENV === 'production' ? 'true' : 'false');
  response.headers.set('X-SameSite-Policy', isHttps ? 'none' : 'lax');
  
  // We can't modify process.env directly in middleware, so we'll use the header approach instead
  // Adding a header that can be read by the API routes
  
  // Add session debugging headers for API routes
  if (pathname.startsWith('/api/')) {
    response.headers.set('X-Session-Debug', 'enabled');
    
    // API endpoints - default no caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  } 
  // Cache static assets
  else if (
    pathname.includes('/_next/static') || 
    pathname.includes('/static/') ||
    pathname.includes('/images/') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico')
  ) {
    // Static assets - cache for 30 days
    response.headers.set('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=86400');
  } 
  // Public routes caching
  else if (isPublicRoute && pathname !== '/auth') {
    // Public routes (except auth) - cache for a short time with revalidation
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=59');
  }
  
  return response;
}

// Paths to apply middleware to
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}