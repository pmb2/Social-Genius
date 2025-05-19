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

export async function GET(req: NextRequest) {
  try {
    // Get database service
    const db = DatabaseService.getInstance();
    
    // Check if the Google OAuth tables exist
    const tablesExist = await verifyGoogleOAuthTables();
    
    if (tablesExist) {
      return NextResponse.json({
        success: true,
        message: 'Google OAuth tables already exist',
        initialized: false
      });
    }
    
    // Tables don't exist, initialize them
    const initialized = await initializeGoogleOAuth();
    
    return NextResponse.json({
      success: true,
      message: initialized 
        ? 'Google OAuth tables initialized successfully' 
        : 'Failed to initialize Google OAuth tables',
      initialized
    });
  } catch (error) {
    console.error('Error initializing OAuth database:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
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
