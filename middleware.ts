import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// Remove the database initialization from the middleware
// import { initializeDatabase } from '@/lib/init-db';

// We need to make sure the database is initialized once at application startup
let dbInitialized = false;

export async function middleware(request: NextRequest) {
  // Database initialization moved to API routes with nodejs runtime
  
  // Get path
  const path = request.nextUrl.pathname;
  
  // Let NextAuth handle authentication
  // The protected routes will be handled by client-side redirects
  
  // Continue with the request
  return NextResponse.next();
}

// Paths to apply middleware to - exclude auth paths to avoid Edge runtime issues
export const config = {
  matcher: [
    // Exclude auth endpoints from middleware to avoid Edge runtime issues
    '/api/((?!auth|test-db|init-db|groq).*)',
  ],
};