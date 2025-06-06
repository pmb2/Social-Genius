/**
 * GoogleOAuthService
 * 
 * Handles OAuth 2.0 authentication flow with Google Business Profile API
 * Manages token generation, storage, refreshing, and validation
 */

import { OAuth2Client } from 'google-auth-library';
import { encryptData, decryptData } from '@/lib/utilities/crypto';
import { DatabaseService } from '@/services/database';
import fs from 'fs';
import path from 'path';

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
   * @param stateData Data to store in the state parameter (userId, businessName, etc.)
   * @returns The authorization URL to redirect the user to
   */
  generateAuthUrl(stateData: { 
    userId: string; 
    businessName: string; 
    businessType?: string;
    timestamp: number;
  }): string {
    console.log('Generating OAuth URL with state data:', stateData);
    
    // Create a state parameter to prevent CSRF and store user/business info
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64');
    
    // Verify credentials exist
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      console.error('Missing Google OAuth credentials in environment variables');
      console.error('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not set');
      console.error('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not set');
      console.error('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI ? 'Set' : 'Not set');
      throw new Error('Missing Google OAuth credentials in environment variables');
    }
    
    // Reinitialize oauth client to ensure credentials are set
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Log the OAuth client details (without sensitive info)
    console.log('OAuth client:', {
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET
    });
    
    // Generate the authorization URL
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // This will provide a refresh token
      scope: ['https://www.googleapis.com/auth/business.manage'],
      prompt: 'consent', // Force consent to ensure we get a refresh token
      state, // Include our state parameter for security and to maintain context
      include_granted_scopes: false, // Don't include previously granted scopes
      hd: '*' // Allow any hosted domain
    });
    
    console.log('Generated auth URL:', `${authUrl.substring(0, 50)}...`);
    
    return authUrl;
  }
  
  /**
   * Exchanges authorization code for access and refresh tokens
   * @param code Authorization code from OAuth redirect
   * @returns OAuth tokens
   */
  async getTokensFromCode(code: string): Promise<OAuthTokens> {
    try {
      console.log('Exchanging authorization code for tokens...');
      
      // Verify credentials exist before attempting token exchange
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
        console.error('Missing Google OAuth credentials in environment variables');
        console.error('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not set');
        console.error('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not set');
        console.error('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI ? 'Set' : 'Not set');
        throw new Error('Missing Google OAuth credentials in environment variables');
      }
      
      // Reinitialize oauth client to ensure credentials are set
      this.oauth2Client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      
      // Log code details (truncated)
      console.log('Exchanging code:', code ? `${code.substring(0, 10)}...` : 'No code provided');
      console.log('Using redirect URI:', process.env.GOOGLE_REDIRECT_URI);
      
      // Exchange code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);
      
      console.log('Token exchange response received', {
        has_access_token: !!tokens.access_token,
        has_refresh_token: !!tokens.refresh_token,
        has_expiry: !!tokens.expiry_date,
        has_id_token: !!tokens.id_token
      });
      
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
      
      // Enhanced error logging
      if (error.response) {
        console.error('Google API error response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }
      
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
      
      const encryptKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
      if (!encryptKey) {
        throw new Error('Missing GOOGLE_TOKEN_ENCRYPTION_KEY environment variable');
      }
      
      const refreshToken = decryptData(
        encryptedToken.rows[0].refresh_token,
        encryptKey
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
        'UPDATE google_oauth_tokens SET access_token = $1, expiry_date = $2, updated_at = NOW() WHERE user_id = $3 AND business_id = $4',
        [
          credentials.access_token,
          credentials.expiry_date || Date.now() + 3600000, // Default to 1 hour if no expiry provided
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
      // First, ensure Google OAuth tables exist
      await this.ensureOAuthTablesExist();
      
      // Encrypt the refresh token before storage
      const encryptKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
      if (!encryptKey) {
        throw new Error('Missing GOOGLE_TOKEN_ENCRYPTION_KEY environment variable');
      }
      
      const encryptedRefreshToken = encryptData(
        tokens.refresh_token,
        encryptKey
      );
      
      // Calculate expiry date
      const expiryDate = tokens.expiry_date || Date.now() + 3600000; // Default to 1 hour if not provided
      
      // Check if token already exists for this user/business
      const existingToken = await this.db.query(
        'SELECT id FROM google_oauth_tokens WHERE user_id = $1 AND business_id = $2',
        [userId, businessId]
      );
      
      if (existingToken && existingToken.rows && existingToken.rows.length > 0) {
        // Update existing token
        await this.db.query(
          'UPDATE google_oauth_tokens SET access_token = $1, refresh_token = $2, expiry_date = $3, updated_at = NOW() WHERE user_id = $4 AND business_id = $5',
          [tokens.access_token, encryptedRefreshToken, expiryDate, userId, businessId]
        );
      } else {
        // Insert new token
        await this.db.query(
          'INSERT INTO google_oauth_tokens (user_id, business_id, access_token, refresh_token, expiry_date) VALUES ($1, $2, $3, $4, $5)',
          [userId, businessId, tokens.access_token, encryptedRefreshToken, expiryDate]
        );
      }
    } catch (error) {
      console.error('Error storing tokens:', error);
      throw new Error(`Failed to store OAuth tokens: ${error.message}`);
    }
  }
  
  /**
   * Ensures that the OAuth tables exist
   * Creates them if they don't
   */
  private async ensureOAuthTablesExist(): Promise<void> {
    try {
      const pool = this.db.getPool();
      
      // Check if the tokens table exists
      const tableResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'google_oauth_tokens'
        );
      `);
      
      const tablesExist = tableResult.rows[0].exists;
      
      if (!tablesExist) {
        console.log('Google OAuth tables do not exist, initializing...');
        
        const migrationsPath = path.join(process.cwd(), 'src', 'services', 'database', 'migrations');
        const schemaPath = path.join(migrationsPath, 'google_oauth_schema.sql');
        
        if (!fs.existsSync(schemaPath)) {
          throw new Error(`OAuth schema file not found: ${schemaPath}`);
        }
        
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        
        // Execute schema in a transaction
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          // Split on semicolons to execute each statement
          const statements = schemaSql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);
          
          for (const statement of statements) {
            await client.query(statement);
          }
          
          await client.query('COMMIT');
          console.log('Successfully initialized Google OAuth tables');
        } catch (error) {
          await client.query('ROLLBACK');
          console.error('Error initializing Google OAuth tables:', error);
          throw error;
        } finally {
          client.release();
        }
      }
    } catch (error) {
      console.error('Error checking or initializing OAuth tables:', error);
      throw error;
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
      console.log(`Migrating tokens from tempBusinessId=${tempBusinessId} to permanentBusinessId=${permanentBusinessId}`);
      
      // Get tokens for temporary business ID
      const tokenResult = await this.db.query(
        'SELECT access_token, refresh_token, expiry_date FROM google_oauth_tokens WHERE user_id = $1 AND business_id = $2',
        [userId, tempBusinessId]
      );
      
      if (!tokenResult || !tokenResult.rows || tokenResult.rows.length === 0) {
        throw new Error(`No tokens found for temporary business ID: ${tempBusinessId}`);
      }
      
      const tokenData = tokenResult.rows[0];
      console.log('Found token data for temporary business ID');
      
      // Insert tokens for permanent business ID
      await this.db.query(
        'INSERT INTO google_oauth_tokens (user_id, business_id, access_token, refresh_token, expiry_date) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, business_id) DO UPDATE SET access_token = $3, refresh_token = $4, expiry_date = $5, updated_at = NOW()',
        [
          userId,
          permanentBusinessId,
          tokenData.access_token,
          tokenData.refresh_token,
          tokenData.expiry_date
        ]
      );
      
      console.log('Inserted token data for permanent business ID');
      
      // Delete temporary token
      await this.db.query(
        'DELETE FROM google_oauth_tokens WHERE user_id = $1 AND business_id = $2',
        [userId, tempBusinessId]
      );
      
      console.log('Deleted temporary token data');
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
        'SELECT access_token, expiry_date FROM google_oauth_tokens WHERE user_id = $1 AND business_id = $2',
        [userId, businessId]
      );
      
      if (!tokenResult || !tokenResult.rows || tokenResult.rows.length === 0) {
        throw new Error('No token information found for this user and business');
      }
      
      const tokenInfo = tokenResult.rows[0];
      
      // Check if the token is expired or will expire in the next 5 minutes
      const now = Date.now();
      const expiryDate = Number(tokenInfo.expiry_date);
      const expiryBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
      
      if (expiryDate <= (now + expiryBuffer)) {
        // Token is expired or will expire soon, refresh it
        console.log('Access token expired or expiring soon, refreshing...');
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