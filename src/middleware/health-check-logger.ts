import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware to suppress logs for health check requests
 * This helps reduce log spam from frequent ALB health checks
 */
export function middleware(request: NextRequest) {
  // Check if the request path is /api/health or /health
  if (request.nextUrl.pathname === '/api/health' || request.nextUrl.pathname === '/health') {
    // Don't log anything for health checks
    // We're letting the request continue without modification
    // The lack of console output here is what reduces the log spam
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/health', '/health'],
};