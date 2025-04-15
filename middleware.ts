import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
  '/favicon.ico',
  '/check-db',
  '/debug',
  '/_next'
];

export async function middleware(request: NextRequest) {
  // Get path
  const pathname = request.nextUrl.pathname;
  
  // Check if the pathname starts with any of the public routes
  const isPublicRoute = publicRoutes.some((route) => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
  
  // Completely disable middleware logging except in special debug mode
  // This is a stronger setting than before to eliminate almost all logging
  const skipLogging = true; 
  
  // Only enable if explicitly turned on with environment variable
  const enableMiddlewareLogging = process.env.DEBUG_MIDDLEWARE === 'true' && process.env.NODE_ENV === 'development';
  
  // Create the response object
  let response;
  
  if (isPublicRoute) {
    // Only log if explicitly enabled with DEBUG_MIDDLEWARE=true
    if (enableMiddlewareLogging) {
      console.log(`[MIDDLEWARE] Public route: ${pathname}`);
    }
    response = NextResponse.next();
  } else {
    // Get session cookie (check both 'session' and 'sessionId' for compatibility)
    const sessionCookie = request.cookies.get('session')?.value || request.cookies.get('sessionId')?.value;
    
    // If there's no session cookie and it's not a public route, redirect to auth page
    if (!sessionCookie) {
      // Only log authentication failures when explicitly enabled
      if (enableMiddlewareLogging) {
        console.log(`[MIDDLEWARE] No session for ${pathname}, redirecting to /auth`);
      }
      const url = new URL('/auth', request.url);
      url.searchParams.set('callbackUrl', pathname);
      url.searchParams.set('reason', 'no_session');
      return NextResponse.redirect(url);
    }
    
    // Only log when explicitly enabled with DEBUG_MIDDLEWARE=true
    if (enableMiddlewareLogging) {
      console.log(`[MIDDLEWARE] Session valid: ${pathname}`);
    }
    response = NextResponse.next();
  }
  
  // Add cache control headers for static assets and optimize caching
  if (
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
  } else if (pathname.startsWith('/api/')) {
    // API endpoints - default no caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  } else if (isPublicRoute && pathname !== '/auth') {
    // Public routes (except auth) - cache for a short time with revalidation
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=59');
  }
  
  return response;
}

// Paths to apply middleware to
export const config = {
  matcher: [
    // Skip all internal paths (_next) and other public paths
    '/((?!_next|api/auth|api/compliance|favicon.ico).*)',
    // Optional: Protect API routes except auth-related ones, compliance-related ones and utility routes
    '/api/((?!auth|compliance|test-db|init-db|db-status|env-check|debug-auth|direct-db-test).*)',
  ],
};