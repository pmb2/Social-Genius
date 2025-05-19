/**
 * Check Google OAuth Credentials API
 * 
 * Verifies that the required Google OAuth credentials are available in the environment.
 * This is a diagnostic endpoint for testing setup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/services/database';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // Check environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const encryptionKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    
    // Check database tables
    let oauthTablesExist = false;
    
    try {
      // Verify if tables exist
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
      
      oauthTablesExist = result.rows[0].exists;
    } catch (error) {
      console.error('Error verifying Google OAuth tables:', error);
      oauthTablesExist = false;
    }
    
    // Build response
    const response = {
      success: true,
      credentials: {
        clientId: clientId ? 'Set' : 'Not set',
        clientSecret: clientSecret ? 'Set' : 'Not set',
        redirectUri: redirectUri || 'Not set',
        encryptionKey: encryptionKey ? 'Set' : 'Not set',
      },
      database: {
        oauthTables: oauthTablesExist ? 'Exist' : 'Do not exist',
      },
      isConfigured: Boolean(clientId && clientSecret && redirectUri && encryptionKey && oauthTablesExist)
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error checking Google OAuth credentials:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}