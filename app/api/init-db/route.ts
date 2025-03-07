import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/init-db';
import PostgresService from '@/services/postgres-service';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Allow both GET and POST for easier initialization during development
export async function GET(req: NextRequest) {
  return initDb(req);
}

// API endpoint to manually trigger database initialization
export async function POST(req: NextRequest) {
  return initDb(req);
}

async function initDb(req: NextRequest) {
  try {
    // Force a reset of the PostgreSQL connection first
    const dbService = PostgresService.getInstance();
    await dbService.resetConnection('postgresql://postgres:postgres@localhost:5432/socialgenius');
    
    // Then initialize the database
    const success = await initializeDatabase();
    
    if (success) {
      // Test that we can perform basic DB operations
      const testConn = await dbService.testConnection();
      
      if (testConn) {
        return NextResponse.json(
          { success: true, message: 'Database initialized and tested successfully' },
          { status: 200 }
        );
      } else {
        return NextResponse.json(
          { success: false, error: 'Database initialized but connection test failed' },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Database initialization failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in initialize database endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}