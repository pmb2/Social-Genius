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
    
    // Execute the SQL script in a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // First create the base tables - these statements can be safely split on semicolons
      const baseTableStatements = migrationSql
        .split('DO ')[0] // Split before DO block to handle base tables separately
        .split(';')
        .map(statement => statement.trim())
        .filter(statement => statement.length > 0);
      
      // Execute each base table statement
      for (const statement of baseTableStatements) {
        await client.query(statement);
      }
      
      // Handle the DO block separately since it contains internal semicolons
      // Extract the DO block and execute it as a single statement
      if (migrationSql.includes('DO $$')) {
        const doBlockMatch = migrationSql.match(/DO \$\$([\s\S]*?)\$\$/);
        if (doBlockMatch && doBlockMatch[0]) {
          // Add the trailing semicolon if needed
          const doBlock = doBlockMatch[0].endsWith(';') ? doBlockMatch[0] : doBlockMatch[0] + ';';
          await client.query(doBlock);
        }
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