import { NextRequest, NextResponse } from 'next/server';
import PostgresService from '@/services/postgres-service';

// API endpoint to check database connection status
export async function GET(req: NextRequest) {
  try {
    const dbService = PostgresService.getInstance();
    const client = await dbService.getPool().connect();
    
    try {
      // Test the connection with a simple query
      const result = await client.query('SELECT NOW() as current_time');
      
      // Check if the users table exists
      const tableCheckResult = await client.query(
        `SELECT EXISTS (
           SELECT FROM information_schema.tables 
           WHERE table_schema = 'public' 
           AND table_name = 'users'
         )`
      );
      
      const usersTableExists = tableCheckResult.rows[0].exists;
      
      // Get database connection info
      const connectionInfo = {
        host: process.env.DATABASE_URL || 'Not configured',
        usersTableExists,
        serverTime: result.rows[0].current_time
      };
      
      return NextResponse.json({
        status: 'connected',
        message: 'Database connection successful',
        info: connectionInfo
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database connection error:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}