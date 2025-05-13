/**
 * GoogleOAuthService
 * 
 * Handles OAuth 2.0 authentication flow with Google Business Profile API
 * Manages token generation, storage, refreshing, and validation
 */

import { OAuth2Client } from 'google-auth-library';
import { encryptData, decryptData } from '@/lib/utilities/crypto';
import { DatabaseService } from '@/services/database';

// Define types for token data
interface TokenInfo {
  accessToken: string;
  expiry: Date;
}

interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_type: string;
  scope: string;
}

export class GoogleOAuthService {
  private oauth2Client: OAuth2Client;
  private db: DatabaseService;
  
  constructor() {
    // Initialize the OAuth2 client with credentials from environment variables
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Get database service instance
    this.db = DatabaseService.getInstance();
  }
  
  /**
   * Generates a Google OAuth authorization URL
   * @param userId User ID to associate with the auth flow
   * @param businessName Business name to associate with the auth flow
   * @returns The authorization URL to redirect the user to
   */
  generateAuthUrl(userId: string, businessName: string): string {
    // Create a state parameter to prevent CSRF and store user/business info
    const state = Buffer.from(JSON.stringify({
      userId,
      businessName,
      timestamp: Date.now()
    })).toString('base64');
    
    // Generate the authorization URL
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // This will provide a refresh token
      scope: ['https://www.googleapis.com/auth/business.manage'],
      prompt: 'consent', // Force consent to ensure we get a refresh token
      state, // Include our state parameter for security and to maintain context
      include_granted_scopes: true // Include previously granted scopes
    });
  }
  
  /**
   * Exchanges authorization code for access and refresh tokens
   * @param code Authorization code from OAuth redirect
   * @returns OAuth tokens
   */
  async getTokensFromCode(code: string): Promise<OAuthTokens> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      // Validate that we received the necessary tokens
      if (!tokens.access_token) {
        throw new Error('No access token received from Google');
      }
      
      if (!tokens.refresh_token) {
        throw new Error('No refresh token received from Google. Make sure "access_type=offline" and "prompt=consent" are included in the authorization URL.');
      }
      
      return tokens as OAuthTokens;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new Error(`Failed to exchange authorization code for tokens: ${error.message}`);
    }
  }
  
  /**
   * Refreshes an access token using the stored refresh token
   * @param userId User ID
   * @param businessId Business ID
   * @returns A new access token
   */
  async refreshAccessToken(userId: string, businessId: string): Promise<string> {
    try {
      // Get encrypted refresh token from database
      const encryptedToken = await this.db.query(
        'SELECT refresh_token FROM google_oauth_tokens WHERE user_id = $1 AND business_id = $2',
        [userId, businessId]
      );
      
      if (!encryptedToken || !encryptedToken.rows || encryptedToken.rows.length === 0) {
        throw new Error('No refresh token found for this user and business');
      }
      
      const refreshToken = decryptData(
        encryptedToken.rows[0].refresh_token,
        process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || ''
      );
      
      // Set up the OAuth client with the refresh token
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });
      
      // Refresh the access token
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }
      
      // Update the access token in the database
      await this.db.query(
        'UPDATE google_oauth_tokens SET access_token = $1, token_expiry = $2, updated_at = NOW() WHERE user_id = $3 AND business_id = $4',
        [
          credentials.access_token,
          new Date(credentials.expiry_date || Date.now() + 3600000), // Default to 1 hour if no expiry provided
          userId,
          businessId
        ]
      );
      
      return credentials.access_token;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw new Error(`Failed to refresh access token: ${error.message}`);
    }
  }
  
  /**
   * Stores OAuth tokens in the database
   * @param userId User ID
   * @param businessId Business ID
   * @param tokens OAuth tokens from Google
   */
  async storeTokens(userId: string, businessId: string, tokens: OAuthTokens): Promise<void> {
    try {
      // Encrypt the refresh token before storage
      const encryptedRefreshToken = encryptData(
        tokens.refresh_token,
        process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || ''
      );
      
      // Calculate expiry date
      const expiryDate = new Date(tokens.expiry_date || Date.now() + 3600000); // Default to 1 hour if not provided
      
      // Check if token already exists for this user/business
      const existingToken = await this.db.query(
        'SELECT id FROM google_oauth_tokens WHERE user_id = $1 AND business_id = $2',
        [userId, businessId]
      );
      
      if (existingToken && existingToken.rows && existingToken.rows.length > 0) {
        // Update existing token
        await this.db.query(
          'UPDATE google_oauth_tokens SET access_token = $1, refresh_token = $2, token_expiry = $3, updated_at = NOW() WHERE user_id = $4 AND business_id = $5',
          [tokens.access_token, encryptedRefreshToken, expiryDate, userId, businessId]
        );
      } else {
        // Insert new token
        await this.db.query(
          'INSERT INTO google_oauth_tokens (user_id, business_id, access_token, refresh_token, token_expiry) VALUES ($1, $2, $3, $4, $5)',
          [userId, businessId, tokens.access_token, encryptedRefreshToken, expiryDate]
        );
      }
    } catch (error) {
      console.error('Error storing tokens:', error);
      throw new Error(`Failed to store OAuth tokens: ${error.message}`);
    }
  }
  
  /**
   * Migrates tokens from a temporary business ID to a permanent one
   * Used during the OAuth flow when we need to store tokens before a business is created
   * @param userId User ID
   * @param tempBusinessId Temporary business ID
   * @param permanentBusinessId Permanent business ID
   */
  async migrateTokens(userId: string, tempBusinessId: string, permanentBusinessId: string | number): Promise<void> {
    try {
      // Get tokens for temporary business ID
      const tokenResult = await this.db.query(
        'SELECT access_token, refresh_token, token_expiry FROM google_oauth_tokens WHERE user_id = $1 AND business_id = $2',
        [userId, tempBusinessId]
      );
      
      if (!tokenResult || !tokenResult.rows || tokenResult.rows.length === 0) {
        throw new Error('No tokens found for temporary business ID');
      }
      
      const tokenData = tokenResult.rows[0];
      
      // Insert tokens for permanent business ID
      await this.db.query(
        'INSERT INTO google_oauth_tokens (user_id, business_id, access_token, refresh_token, token_expiry) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, business_id) DO UPDATE SET access_token = $3, refresh_token = $4, token_expiry = $5, updated_at = NOW()',
        [
          userId,
          permanentBusinessId,
          tokenData.access_token,
          tokenData.refresh_token,
          tokenData.token_expiry
        ]
      );
      
      // Delete temporary token
      await this.db.query(
        'DELETE FROM google_oauth_tokens WHERE user_id = $1 AND business_id = $2',
        [userId, tempBusinessId]
      );
    } catch (error) {
      console.error('Error migrating tokens:', error);
      throw new Error(`Failed to migrate tokens: ${error.message}`);
    }
  }
  
  /**
   * Gets a valid access token for a user/business
   * Automatically refreshes if the current token is expired
   * @param userId User ID
   * @param businessId Business ID
   * @returns A valid access token
   */
  async getAccessToken(userId: string, businessId: string): Promise<string> {
    try {
      // Get token info from database
      const tokenResult = await this.db.query(
        'SELECT access_token, token_expiry FROM google_oauth_tokens WHERE user_id = $1 AND business_id = $2',
        [userId, businessId]
      );
      
      if (!tokenResult || !tokenResult.rows || tokenResult.rows.length === 0) {
        throw new Error('No token information found for this user and business');
      }
      
      const tokenInfo = tokenResult.rows[0];
      
      // Check if the token is expired or will expire in the next 5 minutes
      const now = new Date();
      const expiryDate = new Date(tokenInfo.token_expiry);
      const expiryBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
      
      if (expiryDate <= new Date(now.getTime() + expiryBuffer)) {
        // Token is expired or will expire soon, refresh it
        return await this.refreshAccessToken(userId, businessId);
      }
      
      // Token is still valid
      return tokenInfo.access_token;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw new Error(`Failed to get access token: ${error.message}`);
    }
  }
  
  /**
   * Revokes access for a specific user/business
   * @param userId User ID
   * @param businessId Business ID
   */
  async revokeAccess(userId: string, businessId: string): Promise<void> {
    try {
      // Get the token to revoke
      const tokenResult = await this.db.query(
        'SELECT access_token FROM google_oauth_tokens WHERE user_id = $1 AND business_id = $2',
        [userId, businessId]
      );
      
      if (tokenResult && tokenResult.rows && tokenResult.rows.length > 0) {
        // Revoke the token with Google
        await this.oauth2Client.revokeToken(tokenResult.rows[0].access_token);
        
        // Delete from database
        await this.db.query(
          'DELETE FROM google_oauth_tokens WHERE user_id = $1 AND business_id = $2',
          [userId, businessId]
        );
      }
    } catch (error) {
      console.error('Error revoking access:', error);
      throw new Error(`Failed to revoke access: ${error.message}`);
    }
  }
}