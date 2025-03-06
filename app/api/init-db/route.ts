import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/init-db';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// API endpoint to manually trigger database initialization
export async function POST(req: NextRequest) {
  try {
    const success = await initializeDatabase();
    
    if (success) {
      return NextResponse.json(
        { success: true, message: 'Database initialized successfully' },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { success: false, error: 'Database initialization failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in initialize database endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}