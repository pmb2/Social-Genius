import { NextRequest, NextResponse } from 'next/server';
import PostgresService from '@/services/postgres-service';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  console.log('*** TEST DB API CALLED ***');
  
  try {
    // Get database service
    const dbService = PostgresService.getInstance();
    
    // Test connection
    const connectionResult = await dbService.testConnection();
    
    if (connectionResult) {
      return NextResponse.json({ 
        success: true, 
        message: 'Database connection successful' 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Database connection failed but no error was thrown' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown database error' 
    }, { status: 500 });
  }
}