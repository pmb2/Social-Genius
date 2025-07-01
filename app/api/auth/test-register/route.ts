import { NextRequest } from 'next/server';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Extremely simplified register endpoint for testing
export async function POST(req: NextRequest) {
  console.log('Test register endpoint called');
  
  // Return a simple JSON response
  return new Response(JSON.stringify({
    success: true,
    message: 'Test register endpoint working',
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}