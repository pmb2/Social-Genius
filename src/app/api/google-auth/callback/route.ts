/**
 * Google OAuth Callback Route
 * 
 * Handles the OAuth callback from Google and processes the authentication flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleOAuthService } from '@/services/google/oauth-service';
import { GoogleBusinessProfileService } from '@/services/google/business-profile-service';
import { DatabaseService } from '@/services/database';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

/**
 * Handles the OAuth callback from Google
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  
  // Handle authorization errors from Google
  if (error) {
    console.error(`Google OAuth error: ${error}`);
    return NextResponse.redirect('/dashboard?error=google_auth_error');
  }
  
  // Ensure we have the required parameters
  if (!code || !state) {
    console.error('Missing code or state parameter in OAuth callback');
    return NextResponse.redirect('/dashboard?error=auth_failed');
  }
  
  try {
    // Decode the state parameter to extract user ID and business name
    let stateData: { userId: string; businessName: string; timestamp: number };
    
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    } catch (parseError) {
      console.error('Failed to parse state parameter:', parseError);
      return NextResponse.redirect('/dashboard?error=invalid_state');
    }
    
    const { userId, businessName, timestamp } = stateData;
    
    // Validate state to prevent CSRF attacks
    // Check timestamp is not too old (10 minute expiry)
    const now = Date.now();
    if (now - timestamp > 1000 * 60 * 10) {
      console.error('State parameter expired:', { timestamp, now, diff: now - timestamp });
      return NextResponse.redirect('/dashboard?error=auth_expired');
    }
    
    // Exchange the code for tokens
    const oauthService = new GoogleOAuthService();
    const tokens = await oauthService.getTokensFromCode(code);
    
    // Create a temporary business ID for token storage
    // We'll update this to the real business ID after creation
    const tempBusinessId = `temp_${Date.now()}`;
    
    // Store the tokens temporarily
    await oauthService.storeTokens(userId, tempBusinessId, tokens);
    
    // Get Google Business Profile accounts and locations
    const profileService = new GoogleBusinessProfileService(tokens.access_token);
    
    // Get accounts
    const accountsData = await profileService.getAccounts();
    
    if (!accountsData || !accountsData.accounts || accountsData.accounts.length === 0) {
      console.error('No Google Business accounts found');
      return NextResponse.redirect('/dashboard?error=no_business_accounts');
    }
    
    // Use the first account
    const account = accountsData.accounts[0];
    
    // Get locations for this account
    const locationsData = await profileService.getLocations(account.name);
    
    if (!locationsData || !locationsData.locations || locationsData.locations.length === 0) {
      console.error('No locations found for account', account.name);
      return NextResponse.redirect('/dashboard?error=no_locations');
    }
    
    // Get the database service
    const db = DatabaseService.getInstance();
    
    // Create the business record in the database
    const businessResult = await db.query(
      `INSERT INTO businesses (user_id, name, status, created_at, updated_at) 
       VALUES ($1, $2, $3, NOW(), NOW()) 
       RETURNING id, business_id as "businessId"`,
      [userId, businessName, 'active']
    );
    
    if (!businessResult || !businessResult.rows || businessResult.rows.length === 0) {
      throw new Error('Failed to create business record');
    }
    
    const businessRecord = businessResult.rows[0];
    const businessId = businessRecord.id;
    
    // Associate the Google account with the business
    await db.query(
      `INSERT INTO google_business_accounts 
       (business_id, google_account_id, google_account_name) 
       VALUES ($1, $2, $3)`,
      [businessId, account.name, account.accountName]
    );
    
    // Insert locations
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
    await oauthService.migrateTokens(userId, tempBusinessId, businessId);
    
    // Redirect to dashboard with success message
    return NextResponse.redirect('/dashboard?success=business_connected');
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    
    // Handle specific error cases
    if (error.message && error.message.includes('refresh token')) {
      return NextResponse.redirect('/dashboard?error=missing_refresh_token');
    }
    
    return NextResponse.redirect('/dashboard?error=auth_error');
  }
}