import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Test API is working',
    timestamp: new Date().toISOString()
  });
}