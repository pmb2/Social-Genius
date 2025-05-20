/**
 * Google OAuth Callback Route
 * 
 * Handles the OAuth callback from Google and processes the authentication flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleOAuthService } from '@/services/google/oauth-service';
import { GoogleBusinessProfileService } from '@/services/google/business-profile-service';
import { DatabaseService } from '@/services/database';
import { initializeGoogleOAuth, verifyGoogleOAuthTables } from '@/services/database/init-google-oauth';
import fs from 'fs';
import path from 'path';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

/**
 * Handles the OAuth callback from Google
 */
export async function GET(req: NextRequest) {
  console.log('Google OAuth callback received');
  
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  
  // Handle authorization errors from Google
  if (error) {
    console.error(`Google OAuth error: ${error}`);
    
    // Log detailed error information
    const errorReason = searchParams.get('error_reason') || '';
    const errorDescription = searchParams.get('error_description') || '';
    
    console.error('Google OAuth error details:', {
      error,
      error_reason: errorReason,
      error_description: errorDescription
    });
    
    // Redirect with specific error details for troubleshooting
    return NextResponse.redirect(`/dashboard?error=google_auth_error&reason=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription)}`);
  }
  
  // Ensure we have the required parameters
  if (!code || !state) {
    console.error('Missing code or state parameter in OAuth callback');
    return NextResponse.redirect('/dashboard?error=auth_failed');
  }
  
  try {
    // First, ensure Google OAuth tables exist
    try {
      console.log('Checking for required database tables...');
      
      // Verify if tables exist
      const tablesExist = await verifyGoogleOAuthTables();
      
      if (!tablesExist) {
        console.log('Google OAuth tables do not exist, initializing...');
        const initialized = await initializeGoogleOAuth();
        
        if (!initialized) {
          console.error('Failed to initialize Google OAuth tables');
          return NextResponse.redirect('/dashboard?error=database_setup_failed');
        }
        
        console.log('Google OAuth tables initialized successfully');
      }
      
      // Check if the business tables exist
      const db = DatabaseService.getInstance();
      const pool = db.getPool();
      const businessTableResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'businesses'
        );
      `);
      
      const businessTablesExist = businessTableResult.rows[0].exists;
      
      if (!businessTablesExist) {
        console.log('Business tables do not exist, initializing...');
        
        const migrationsPath = path.join(process.cwd(), 'src', 'services', 'database', 'migrations');
        const businessSchemaPath = path.join(migrationsPath, 'business_schema.sql');
        
        if (fs.existsSync(businessSchemaPath)) {
          const businessSchemaSql = fs.readFileSync(businessSchemaPath, 'utf8');
          
          // Execute schema in a transaction
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            
            // Split on semicolons to execute each statement
            const statements = businessSchemaSql
              .split(';')
              .map(stmt => stmt.trim())
              .filter(stmt => stmt.length > 0);
            
            for (const statement of statements) {
              await client.query(statement);
            }
            
            await client.query('COMMIT');
            console.log('Successfully initialized business tables');
          } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error initializing business tables:', error);
            return NextResponse.redirect('/dashboard?error=database_setup_failed');
          } finally {
            client.release();
          }
        } else {
          console.error('Business schema file not found:', businessSchemaPath);
          return NextResponse.redirect('/dashboard?error=database_setup_failed');
        }
      }
      
      console.log('All required database tables exist or have been initialized');
    } catch (error) {
      console.error('Error checking or initializing database tables:', error);
      return NextResponse.redirect('/dashboard?error=database_setup_failed');
    }
    
    // Decode the state parameter to extract user ID and business name
    let stateData: { 
      userId: string; 
      businessName: string; 
      businessType?: string;
      timestamp: number 
    };
    
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      console.log('Decoded state data:', stateData);
    } catch (parseError) {
      console.error('Failed to parse state parameter:', parseError);
      return NextResponse.redirect('/dashboard?error=invalid_state');
    }
    
    const { userId, businessName, timestamp, businessType = 'local' } = stateData;
    
    // Validate state to prevent CSRF attacks
    // Check timestamp is not too old (10 minute expiry)
    const now = Date.now();
    if (now - timestamp > 1000 * 60 * 10) {
      console.error('State parameter expired:', { timestamp, now, diff: now - timestamp });
      return NextResponse.redirect('/dashboard?error=auth_expired');
    }
    
    // Exchange the code for tokens
    console.log('Creating OAuth service instance...');
    const oauthService = new GoogleOAuthService();
    
    console.log('Exchanging code for tokens...');
    const tokens = await oauthService.getTokensFromCode(code);
    console.log('Tokens received successfully');
    
    // Create a temporary business ID for token storage
    // We'll update this to the real business ID after creation
    const tempBusinessId = `temp_${Date.now()}`;
    
    // Store the tokens temporarily
    console.log('Storing tokens temporarily with ID:', tempBusinessId);
    await oauthService.storeTokens(userId, tempBusinessId, tokens);
    
    // Get Google Business Profile accounts and locations
    console.log('Creating BusinessProfileService...');
    const profileService = new GoogleBusinessProfileService(tokens.access_token);
    
    // Get accounts
    console.log('Fetching Google Business accounts...');
    const accountsData = await profileService.getAccounts();
    
    if (!accountsData || !accountsData.accounts || accountsData.accounts.length === 0) {
      console.error('No Google Business accounts found');
      return NextResponse.redirect('/dashboard?error=no_business_accounts');
    }
    
    console.log(`Found ${accountsData.accounts.length} Google Business accounts`);
    
    // Use the first account
    const account = accountsData.accounts[0];
    console.log('Using account:', account.name);
    
    // Get locations for this account
    console.log('Fetching locations for account...');
    const locationsData = await profileService.getLocations(account.name);
    
    if (!locationsData || !locationsData.locations || locationsData.locations.length === 0) {
      console.error('No locations found for account', account.name);
      return NextResponse.redirect('/dashboard?error=no_locations');
    }
    
    console.log(`Found ${locationsData.locations.length} locations for account`);
    
    // Get the database service
    console.log('Getting database service...');
    const db = DatabaseService.getInstance();
    
    // Create a unique business ID
    const businessIdValue = `biz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Create the business record in the database
    console.log('Creating business record in database...');
    const businessResult = await db.query(
      `INSERT INTO businesses (business_id, user_id, name, status, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, NOW(), NOW()) 
       RETURNING id, business_id as "businessId"`,
      [businessIdValue, userId, businessName, 'active']
    );
    
    if (!businessResult || !businessResult.rows || businessResult.rows.length === 0) {
      throw new Error('Failed to create business record');
    }
    
    const businessRecord = businessResult.rows[0];
    const businessId = businessRecord.id;
    
    console.log('Business created with ID:', businessId);
    
    // Associate the Google account with the business
    console.log('Associating Google account with business...');
    await db.query(
      `INSERT INTO google_business_accounts 
       (business_id, google_account_id, google_account_name) 
       VALUES ($1, $2, $3)`,
      [businessId, account.name, account.accountName]
    );
    
    // Insert locations
    console.log('Inserting business locations...');
    for (const location of locationsData.locations) {
      // Determine if this is the primary location (first one)
      const isPrimary = location === locationsData.locations[0];
      
      await db.query(
        `INSERT INTO google_business_locations 
         (business_id, google_account_id, location_id, location_name, is_primary) 
         VALUES ($1, $2, $3, $4, $5)`,
        [businessId, account.name, location.name, location.title, isPrimary]
      );
    }
    
    // Migrate tokens from temporary ID to actual business ID
    console.log('Migrating tokens to permanent business ID...');
    await oauthService.migrateTokens(userId, tempBusinessId, businessId);
    
    console.log('Google OAuth flow completed successfully');
    
    // Redirect to dashboard with success message
    return NextResponse.redirect('/dashboard?success=business_connected');
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    
    // Handle specific error cases
    if (error.message && error.message.includes('refresh token')) {
      return NextResponse.redirect('/dashboard?error=missing_refresh_token&details=' + encodeURIComponent(error.message));
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(`/dashboard?error=auth_error&details=${encodeURIComponent(errorMessage)}`);
  }
}