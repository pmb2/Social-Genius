/**
 * Initialize OAuth Database Tables API
 * 
 * This endpoint initializes the Google OAuth database tables if they don't exist.
 * It's called by the client before initiating the OAuth flow to ensure the database is ready.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { DatabaseService } from '@/services/database';
import { AuthService } from '@/services/auth';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

/**
 * Initializes Google OAuth database tables
 */
export async function POST(req: NextRequest) {
  try {
  try {
    console.log('POST /api/init-oauth-db - Initializing Google OAuth database tables');
    
    // Verify authentication if required in production
    if (process.env.NODE_ENV === 'production') {
      // Get session cookie
      const cookieHeader = req.headers.get('cookie');
      const authService = AuthService.getInstance();
      const cookies = authService.parseCookies(cookieHeader || '');
      const sessionId = cookies.session || cookies.sessionId;
      
      if (!sessionId) {
        console.error('No session cookie found');
        return NextResponse.json({ 
          success: false, 
          error: 'Authentication required' 
        }, { status: 401 });
      }
      
      // Verify that the session is valid
      const session = await authService.verifySession(sessionId);
      if (!session) {
        console.error('Invalid or expired session');
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid or expired session' 
        }, { status: 401 });
      }
    }
    
    // First check if tables already exist
    console.log('Checking if OAuth tables already exist...');
    
    // Check if the Google OAuth tables exist
    const tablesExist = await verifyGoogleOAuthTables();
    
    if (tablesExist) {
      console.log('OAuth tables already exist, no initialization needed');
      return NextResponse.json({ 
        success: true, 
        message: 'OAuth tables already exist',
        status: 'no_action_needed'
      });
    }
    
    // Initialize the OAuth tables
    console.log('Initializing OAuth tables...');
    const initialized = await initializeGoogleOAuth();
    
    if (!initialized) {
      console.error('Failed to initialize OAuth tables');
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to initialize OAuth tables' 
      }, { status: 500 });
    }
    
    console.log('OAuth tables initialized successfully');
    return NextResponse.json({ 
      success: true, 
      message: 'OAuth tables initialized successfully',
      status: 'initialized'
    });
  } catch (error) {
    console.error('Error initializing OAuth tables:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error initializing OAuth tables'
    }, { status: 500 });
  }
  } catch (error) {
    console.error('Error initializing OAuth database:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Checks if Google OAuth tables exist
 */
export async function GET(req: NextRequest) {
  try {
    console.log('GET /api/init-oauth-db - Checking Google OAuth database tables');
    
    // Check if tables exist
    const tablesExist = await verifyGoogleOAuthTables();
    
    return NextResponse.json({ 
      success: true, 
      exists: tablesExist
    });
  } catch (error) {
    console.error('Error checking OAuth tables:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error checking OAuth tables'
    }, { status: 500 });
  }
}

/**
 * Verifies if the Google OAuth tables already exist
 */
async function verifyGoogleOAuthTables(): Promise<boolean> {
  try {
    const db = DatabaseService.getInstance();
    
    // Check if the tokens table exists
    const result = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'google_oauth_tokens'
      );
    `);
    
    return result.rows[0].exists;
  } catch (error) {
    console.error('Error verifying Google OAuth tables:', error);
    return false;
  }
}

/**
 * Initializes the Google OAuth database tables
 */
async function initializeGoogleOAuth(): Promise<boolean> {
  console.log('Initializing Google OAuth tables...');
  
  try {
    const db = DatabaseService.getInstance();
    
    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'src', 'services', 'database', 'migrations', 'google_oauth_schema.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found: ${migrationPath}`);
      return false;
    }
    
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the migration into individual statements
    const statements = migrationSql
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    // Execute each statement with proper transaction management
    const client = await db.getPool().connect();
    
    try {
      await client.query('BEGIN');
      
      for (const statement of statements) {
        await client.query(statement);
      }
      
      await client.query('COMMIT');
      
      console.log('Google OAuth tables initialized successfully');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error initializing Google OAuth tables:', error);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to initialize Google OAuth tables:', error);
    return false;
  }
}
