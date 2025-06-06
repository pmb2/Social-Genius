/**
 * Google Auth Credentials Check API Route
 * 
 * Diagnostic endpoint for verifying Google OAuth configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/services/database';
import fs from 'fs';
import path from 'path';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

/**
 * Checks if Google OAuth credentials are properly configured
 */
export async function GET(req: NextRequest) {
  try {
    console.log('GET /api/google-auth/check-credentials - Checking Google OAuth configuration');
    
    // Check environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const encryptionKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    
    // Check for OAuth database tables
    let tablesExist = false;
    let oauthTablesCheckError = null;
    
    try {
      // Connect to database
      const db = DatabaseService.getInstance();
      const pool = db.getPool();
      
      // Check if the OAuth tokens table exists
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'google_oauth_tokens'
        );
      `);
      
      tablesExist = result.rows[0].exists;
    } catch (error) {
      console.error('Error checking Google OAuth tables:', error);
      oauthTablesCheckError = error.message;
    }
    
    // Check if schema file exists
    const schemaPath = path.join(process.cwd(), 'src', 'services', 'database', 'migrations', 'google_oauth_schema.sql');
    const schemaFileExists = fs.existsSync(schemaPath);
    
    // Check feature flags
    let oauthFeatureFlagEnabled = false;
    try {
      // Check environment variable for feature flag
      oauthFeatureFlagEnabled = process.env.FEATURE_FLAG_GOOGLE_AUTH_WITH_OAUTH === 'true';
    } catch (error) {
      console.error('Error checking feature flag:', error);
    }
    
    // Return diagnostic information
    return NextResponse.json({
      success: 
        !!clientId && 
        !!clientSecret && 
        !!redirectUri && 
        !!encryptionKey && 
        tablesExist,
      config: {
        clientIdSet: !!clientId,
        clientSecretSet: !!clientSecret,
        redirectUriSet: !!redirectUri,
        encryptionKeySet: !!encryptionKey,
        oauthTablesExist: tablesExist,
        schemaFileExists,
        featureFlagEnabled: oauthFeatureFlagEnabled
      },
      missingVars: {
        clientId: !clientId,
        clientSecret: !clientSecret,
        redirectUri: !redirectUri,
        encryptionKey: !encryptionKey
      },
      dbStatus: {
        error: oauthTablesCheckError,
        oauthTablesReady: tablesExist
      }
    });
  } catch (error) {
    console.error('Error checking Google OAuth credentials:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error checking Google OAuth credentials'
    }, { status: 500 });
  }
}