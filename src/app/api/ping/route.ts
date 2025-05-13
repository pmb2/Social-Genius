import { NextRequest, NextResponse } from 'next/server';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Super simple ping endpoint for testing API functionality
export async function GET(req: NextRequest) {
  return new Response(JSON.stringify({ 
    success: true, 
    message: 'API is working',
    time: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}