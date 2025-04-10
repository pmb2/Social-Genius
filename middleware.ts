import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Add global type for our auth log tracking
declare global {
  var __lastAuthLog: Record<string, number>;
}

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
  
  // Create the response object
  let response;
  
  if (isPublicRoute) {
    response = NextResponse.next();
  } else {
    // Get session cookie (check both 'session' and 'sessionId' for compatibility)
    const sessionCookie = request.cookies.get('session')?.value || request.cookies.get('sessionId')?.value;
    
    // Debug cookie information - only log this in development with debug flag and throttle frequency
    if (process.env.NODE_ENV === 'development' && 
        process.env.DEBUG_AUTH === 'true' &&
        (pathname.endsWith('/dashboard') || pathname.includes('/api/businesses') || !pathname.includes('/_next'))) {
      
      // We'll create a timestamp-based throttling system here to avoid excessive logs
      const now = Date.now();
      const authLogKey = 'last_auth_middleware_log'; 
      
      // Only log once every 3 minutes per path (or use global storage in actual code)
      // Note: In middleware, we have limited storage options, so this is simplified
      if (!global.__lastAuthLog) {
        global.__lastAuthLog = {};
      }
      
      const pathKey = pathname.split('?')[0];
      const lastLog = global.__lastAuthLog[pathKey] || 0;
      
      // Log only if we haven't logged this path in the last 3 minutes
      if (now - lastLog > 3 * 60 * 1000) {
        // Use a session hash to identify without logging the actual session value
        const sessionHash = sessionCookie ? sessionCookie.substring(0, 8) : 'none';
        const timestamp = new Date().toISOString().split('T')[1].substring(0, 8);
        console.log(`[AUTH ${timestamp}] Check for ${pathKey} with session: ${sessionHash}...`);
        
        // Update the last log time for this path
        global.__lastAuthLog[pathKey] = now;
      }
    }
    
    // If there's no session cookie and it's not a public route, redirect to auth page
    if (!sessionCookie) {
      const url = new URL('/auth', request.url);
      url.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(url);
    }
    
    // Session exists, allow the request to proceed
    response = NextResponse.next();
  }
  
  // Add cache control headers and security headers
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
  
  // Add security headers to all responses
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Add a more permissive Content-Security-Policy for non-API routes during development
  if (!pathname.startsWith('/api/')) {
    const cspValue = process.env.NODE_ENV === 'production' 
      ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.stripe.com https://*.openai.com https://*.groq.com https://*.amazonaws.com"
      : "default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline'";
    
    response.headers.set('Content-Security-Policy', cspValue);
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