import { NextRequest, NextResponse } from 'next/server';

// Global dynamic API route configuration
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// This is a catch-all route to ensure all API routes are properly handled
export async function GET(req: NextRequest, { params }: { params: { route: string[] } }) {
  return NextResponse.json({
    status: 'Redirecting',
    path: `/${params.route.join('/')}`,
    timestamp: new Date().toISOString()
  });
}

export async function POST(req: NextRequest, { params }: { params: { route: string[] } }) {
  return NextResponse.json({
    status: 'Redirecting',
    path: `/${params.route.join('/')}`,
    timestamp: new Date().toISOString()
  });
}