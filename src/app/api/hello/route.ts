import { NextRequest } from 'next/server';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// A very simple API endpoint without any imports or dependencies
export async function GET(req: NextRequest) {
  return new Response(JSON.stringify({ message: 'Hello World!' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST(req: NextRequest) {
  return new Response(JSON.stringify({ 
    message: 'Hello from POST!',
    time: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}