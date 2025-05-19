/**
 * Google OAuth Database Initialization
 * 
 * Functions for initializing and verifying Google OAuth database tables.
 */

import fs from 'fs';
import path from 'path';
import DatabaseService from './postgres-service';

/**
 * Verifies if the Google OAuth tables exist in the database
 */
export async function verifyGoogleOAuthTables(): Promise<boolean> {
  try {
    const db = DatabaseService.getInstance();
    const pool = db.getPool();
    
    // Check if the tokens table exists
    const result = await pool.query(`
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
export async function initializeGoogleOAuth(): Promise<boolean> {
  console.log('Initializing Google OAuth tables...');
  
  try {
    const db = DatabaseService.getInstance();
    const pool = db.getPool();
    
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
    const client = await pool.connect();
    
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