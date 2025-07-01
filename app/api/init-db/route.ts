import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '@/services/database/init-db';
import { PostgresService } from '@/services/database';
import { AuthService } from '@/services/auth';

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
    console.log('============================================');
    console.log('DATABASE INITIALIZATION TRIGGERED VIA API');
    console.log('============================================');
    
    // Force disable native pg
    process.env.NODE_PG_FORCE_NATIVE = '0';
    
    // Enable debug logging
    process.env.DEBUG_DATABASE = 'true';
    process.env.PG_DEBUG = 'true';
    
    
    
    // Check for Docker environment
    const inDocker = process.env.RUNNING_IN_DOCKER === 'true';
    console.log(`Running in Docker: ${inDocker}`);
    
    // Print environment variables for debugging
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
    console.log('DATABASE_URL_DOCKER:', process.env.DATABASE_URL_DOCKER ? 'SET' : 'NOT SET');
    
    // Set explicit connection string based on environment
    if (inDocker) {
      process.env.DATABASE_URL = 'postgresql://postgres:postgres@postgres:5432/socialgenius';
      console.log('Using Docker database connection');
    } else {
      process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5435/socialgenius';
      console.log('Using local database connection');
    }
    
    // Get database service (but don't reset connection - let our improved logic handle it)
    const dbService = PostgresService.getInstance();
    
    // Initialize the database (this will handle environment detection)
    console.log('Initializing database...');
    const success = await initializeDatabase();
    
    if (success) {
      console.log('Database initialized successfully');
      
      // Test that we can perform basic DB operations
      console.log('Performing connection test...');
      const testConn = await dbService.testConnection();
      
      if (testConn) {
        // Also check if we can authenticate
        console.log('Testing auth service...');
        try {
          const authService = AuthService.getInstance();
          await authService.cleanupSessions();
          console.log('Auth service is working properly');
          
          // Check database access with simple query
          console.log('Testing database query...');
          const pool = dbService.getPool();
          const client = await pool.connect();
          try {
            await client.query('SELECT NOW()');
            console.log('Database query successful');
          } finally {
            client.release();
          }
          
          return NextResponse.json(
            { 
              success: true, 
              message: 'Database initialized and tested successfully',
              environment: inDocker ? 'docker' : 'host',
              timestamp: new Date().toISOString()
            },
            { status: 200 }
          );
        } catch (authError) {
          console.error('Auth service test error:', authError);
          return NextResponse.json(
            { success: false, error: 'Database initialized but auth service failed', details: String(authError) },
            { status: 500 }
          );
        }
      } else {
        console.error('Database connection test failed after initialization');
        return NextResponse.json(
          { success: false, error: 'Database initialized but connection test failed' },
          { status: 500 }
        );
      }
    } else {
      console.error('Database initialization failed');
      return NextResponse.json(
        { success: false, error: 'Database initialization failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in initialize database endpoint:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace available'
      },
      { status: 500 }
    );
  }
}