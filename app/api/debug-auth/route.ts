import { NextRequest, NextResponse } from 'next/server';
import PostgresService from '@/services/postgres-service';

export async function GET(request: NextRequest) {
  try {
    // Mock session for now
    const session = null;
    
    // Get database service
    const dbService = PostgresService.getInstance();
    
    // Test database connection
    const dbConnected = await dbService.testConnection();
    
    // Check tables
    let usersTableExists = false;
    let sessionsTableExists = false;
    
    try {
      const pool = dbService.getPool();
      const client = await pool.connect();
      try {
        const usersResult = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
          )
        `);
        usersTableExists = usersResult.rows[0].exists;
        
        const sessionsResult = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'sessions'
          )
        `);
        sessionsTableExists = sessionsResult.rows[0].exists;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error checking tables:', error);
    }

    // Return all the debug information
    return NextResponse.json({
      session,
      environment: {
        nextauthSecret: process.env.NEXTAUTH_SECRET ? 'Set (hidden)' : 'Not set',
        nextauthUrl: process.env.NEXTAUTH_URL,
        databaseUrl: process.env.DATABASE_URL ? 'Set (hidden)' : 'Not set',
        nodeEnv: process.env.NODE_ENV || 'development'
      },
      database: {
        connected: dbConnected,
        usersTableExists,
        sessionsTableExists
      }
    });
  } catch (error) {
    console.error('Auth debug error:', error);
    return NextResponse.json({
      error: 'Auth debug error',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}