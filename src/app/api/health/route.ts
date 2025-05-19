import { NextResponse } from 'next/server';

/**
 * Basic health check endpoint for AWS ALB
 * This is a simple endpoint that returns 200 OK when the application is running
 * Configured to suppress logging for health check requests
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Don't log health check requests to reduce spam
    // Simple service availability check
    return new Response('OK', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Service Unavailable',
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }
}