import { NextRequest, NextResponse } from 'next/server';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Make sure route is always handled dynamically and never statically generated
export const dynamic = 'force-dynamic';
export const revalidate = 0; // Never cache this route

// Route to simply redirect to the login page without errors
export async function GET(req: NextRequest) {
  try {
    // Create a response that redirects to the auth page
    return NextResponse.redirect(new URL('/auth', req.url));
  } catch (error) {
    console.error('Error in redirect route:', error);
    // If there's an error, still try to redirect
    return NextResponse.redirect(new URL('/auth', req.url));
  }
}