import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that don't require authentication
const publicRoutes = [
  '/auth',
  '/api/auth',
  '/',
  '/api/init-db',
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
  
  if (isPublicRoute) {
    return NextResponse.next();
  }
  
  // Get session cookie
  const sessionCookie = request.cookies.get('session')?.value;
  
  // If there's no session cookie and it's not a public route, redirect to auth page
  if (!sessionCookie) {
    const url = new URL('/auth', request.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }
  
  // Session exists, allow the request to proceed
  // The actual validation happens in the API routes
  return NextResponse.next();
}

// Paths to apply middleware to
export const config = {
  matcher: [
    // Skip all internal paths (_next) and other public paths
    '/((?!_next|api/auth|favicon.ico).*)',
    // Optional: Protect API routes except auth-related ones and utility routes
    '/api/((?!auth|test-db|init-db|db-status|env-check|debug-auth|direct-db-test).*)',
  ],
};