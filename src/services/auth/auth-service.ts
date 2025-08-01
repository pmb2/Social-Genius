import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'crypto';
import '@/lib/utilities/pg-patch'; // Import pg patch to ensure pg-native is correctly handled
import PostgresService, { SocialAccount } from '../database/postgres-service';
import RedisService from '../database/redis-service';

class AuthService {
  private static instance: AuthService;
  private db: PostgresService;
  private redis: RedisService;
  private JWT_SECRET: string;
  // Extended to 60 days to give more time for sessions
  private SESSION_EXPIRY: number = 60 * 24 * 60 * 60 * 1000; // 60 days in milliseconds

  private constructor() {
    this.db = PostgresService.getInstance();
    this.redis = RedisService; // FIX: Assign the imported instance directly
    // In production, this should be set from environment variables
    this.JWT_SECRET = process.env.JWT_SECRET || 'social-genius-secret-key-change-in-production';
    console.log('[AuthService Constructor] NODE_ENV:', process.env.NODE_ENV);
    console.log('[AuthService Constructor] IRON_SESSION_SECRET (first 5 chars):', process.env.IRON_SESSION_SECRET?.substring(0, 5));
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Hash a password using Node.js crypto
  private hashPassword(password: string): string {
    // Generate a random salt
    const salt = randomBytes(16).toString('hex');
    // Hash the password
    const hash = scryptSync(password, salt, 64).toString('hex');
    // Return the salt and hash combined
    return `${salt}:${hash}`;
  }

  // Compare a password with a hash
  private comparePassword(password: string, storedHash: string): boolean {
    try {
      console.log('Comparing password, stored hash format:', storedHash);
      
      // Handle direct comparison (no salt)
      if (!storedHash.includes(':')) {
        // For passwords stored without salt:hash format, do direct comparison
        // This is for compatibility with directly stored hashes
        console.log('Direct hash comparison (no salt:hash format)');
        
        // Simple case: exact match between password and stored hash
        if (password === storedHash) {
          console.log('Direct match found between password and stored hash');
          return true;
        }
        
        // Hash the password and compare with storedHash (for pre-hashed passwords)
        try {
          const hashBuffer = scryptSync(password, 'default-salt', 64);
          const hashedPassword = hashBuffer.toString('hex');
          return hashedPassword === storedHash;
        } catch (hashError) {
          console.error('Error hashing password for comparison:', hashError);
          return false;
        }
      }
      
      // Extract the salt and hash for salt:hash format
      const [salt, hash] = storedHash.split(':');
      console.log('Extracted salt length:', salt?.length, 'hash length:', hash?.length);
      
      if (!salt || !hash) {
        console.error('Failed to extract salt or hash from stored hash');
        return false;
      }
      
      // Handle direct password comparison
      if (password === hash) {
        console.log('Direct match between password and hash portion');
        return true;
      }
      
      // Hash the password with the same salt
      const hashBuffer = scryptSync(password, salt, 64);
      const newHash = hashBuffer.toString('hex');
      
      // Get the stored hash buffer
      const storedHashBuffer = Buffer.from(hash, 'hex');
      
      // Compare the hashes using timing-safe comparison
      const result = hashBuffer.length === storedHashBuffer.length && 
        timingSafeEqual(hashBuffer, storedHashBuffer);
      
      console.log('Password verification result:', result);
      return result;
    } catch (err) {
      console.error('Error comparing passwords:', err);
      return false;
    }
  }

  

  // Create a simplified token with user info (not a real JWT, but a signed payload)
  private createToken(user: any): string {
    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days expiry
    };
    
    // Convert payload to string
    const payloadStr = JSON.stringify(payload);
    
    // Create signature using HMAC
    const signature = createHmac('sha256', this.JWT_SECRET)
      .update(payloadStr)
      .digest('base64url');
    
    // Combine payload and signature
    return `${Buffer.from(payloadStr).toString('base64url')}.${signature}`;
  }
  
  // Verify and decode a token
  private verifyToken(token: string): any | null {
    try {
      // Split token into parts
      const [payloadBase64, signature] = token.split('.');
      
      if (!payloadBase64 || !signature) {
        return null;
      }
      
      // Decode payload
      const payloadStr = Buffer.from(payloadBase64, 'base64url').toString();
      
      // Verify signature
      const expectedSignature = createHmac('sha256', this.JWT_SECRET)
        .update(payloadStr)
        .digest('base64url');
      
      if (signature !== expectedSignature) {
        return null;
      }
      
      // Parse payload
      const payload = JSON.parse(payloadStr);
      
      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }
      
      return payload;
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  }

  // Register a new user
  public async register(email: string, password: string, name?: string): Promise<{ success: boolean, userId?: string, error?: string }> {
    try {
      console.log('Register method called with:', { email, hasPassword: !!password, name });
      
      // Check if user already exists
      console.log('Checking if user exists...');
      const existingUser = await this.db.getUserByEmail(email);
      if (existingUser) {
        console.log('User already exists');
        return { success: false, error: 'Email already registered' };
      }
      
      // Hash password
      console.log('Hashing password...');
      const passwordHash = this.hashPassword(password);
      console.log('Password hashed successfully, format:', passwordHash.substring(0, 10) + '...');
      
      // Create user
      console.log('Creating user in database...');
      try {
        const userId = await this.db.registerUser(email, passwordHash, name);
        console.log('User created with ID:', userId);
        
        // Let's verify the hash was stored correctly
        const newUser = await this.db.getUserByEmail(email);
        if (newUser) {
          console.log('Verifying stored hash format:', 
                    newUser.password_hash.substring(0, 10) + '...',
                    'length:', newUser.password_hash.length);
        }
        
        return { success: true, userId };
      } catch (dbError) {
        console.error('Database error during registration:', dbError);
        return { success: false, error: 'Database error during registration' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Registration failed' };
    }
  }

  // Login a user
  public async login(email: string, password: string): Promise<{ success: boolean, token?: string, user?: any, error?: string }> {
    try {
      console.log('Login attempt for email:', email);
      
      // Get user
      const user = await this.db.getUserByEmail(email);
      if (!user) {
        console.log('User not found with email:', email);
        return { success: false, error: 'Invalid credentials' };
      }
      
      console.log('User found, checking password now...');
      
      // Verify password
      const isMatch = this.comparePassword(password, user.password_hash);
      if (!isMatch) {
        console.log('Password verification failed for user:', email);
        return { success: false, error: 'Invalid credentials' };
      }
      
      console.log('Password verified successfully for user:', email);
      
      // Update last login
      await this.db.updateLastLogin(user.id);
      
      // Generate token
      const token = this.createToken(user);
      
      // Return user info (without password)
      const userInfo = {
        id: user.id,
        email: user.email,
        name: user.name,
      };
      
      return { success: true, token, user: userInfo };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    }
  }

  // Logout a user
  public async logout(): Promise<boolean> {
    // With iron-session, logout is handled by destroying the session in the API route.
    // This method is kept for compatibility but doesn't perform DB operations related to session IDs.
    return true;
  }

  // Verify a session
  public async verifySession(userId: string, traceId?: string): Promise<any | null> {
    // Generate a trace ID if one wasn't provided
    const sessionTraceId = traceId || `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();
    
    try {
      console.log(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - 🔑 SESSION VERIFICATION STARTED`);
      console.log(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - User ID: ${userId}`);
      console.log(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - Environment: ${process.env.NODE_ENV || 'not set'}`);
      
      // Performance tracking
      const startTime = Date.now();

      // First check database connection with timeout
      console.log(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - Checking database connection...`);
      try {
        const dbStartTime = Date.now();
        const isConnected = await Promise.race([
          this.db.testConnection(),
          new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('Database connection timeout')), 5000)
          )
        ]);
        const dbCheckTime = Date.now() - dbStartTime;
        
        if (!isConnected) {
          console.error(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - ❌ Database connection failed (${dbCheckTime}ms)`);
          return null;
        }
        console.log(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - ✅ Database connection verified (${dbCheckTime}ms)`);
      } catch (connError) {
        console.error(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - ❌ Database connection error:`, connError);
        console.error(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - Stack trace:`, connError instanceof Error ? connError.stack : 'No stack available');
        return null;
      }
      
      // Verify that the user exists
      console.log(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - Looking up user ID ${userId} in database...`);
      const userLookupStart = Date.now();
      const user = await this.db.getUserById(userId);
      const userLookupTime = Date.now() - userLookupStart;
      
      if (!user) {
        console.log(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - ❌ User not found for ID ${userId} (${userLookupTime}ms)`);
        return null;
      }
      console.log(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - User found for ID ${userId}: ${JSON.stringify({ id: user.id, email: user.email })} (${userLookupTime}ms)`);
      
      console.log(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - ✅ User found (${userLookupTime}ms)`);
      console.log(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - User details: ID ${user.id}, Email ${user.email}`);
      
      // Create user object with only the fields that exist in the session/user objects
      const userObj = {
        id: user.id,
        email: user.email,
        name: user.name || "",
        planId: user.plan_id || "basic"
      };
      
      // Only add profile_picture if it exists
      if (user.profile_picture !== undefined) {
        userObj['profilePicture'] = user.profile_picture;
      }
      
      // Only add phone_number if it exists
      if (user.phone_number !== undefined) {
        userObj['phoneNumber'] = user.phone_number;
      }
      
      // Update the expiration time to extend the session
      console.log(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - Extending session validity`);
      try {
        // Update last login timestamp to show activity
        const updateStart = Date.now();
        await this.db.updateLastLogin(user.id);
        const updateTime = Date.now() - updateStart;
        console.log(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - ✅ Session extended (${updateTime}ms)`);
      } catch (updateError) {
        console.error(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - ⚠️ Failed to update last login:`, updateError);
        // Continue anyway as this is not critical
      }
      
      // Calculate total verification time
      const totalTime = Date.now() - startTime;
      console.log(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - ✅ Session verification successful (${totalTime}ms)`);
      console.log(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - User: ${user.email}`);
      
      // Add trace ID and user_email to the session before returning
      const returnedSessionData = {
        user: userObj,
        user_email: user.email, // Add user email for logging
        traceId: sessionTraceId, // Include trace ID for cross-component tracing
        verificationTime: totalTime // Include verification time for performance tracking
      };
      console.log(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - Returning session data: ${JSON.stringify(returnedSessionData)}`);
      return userObj;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - ❌ Session verification error (${totalTime}ms):`, error);
      console.error(`[AUTH_SERVICE:${sessionTraceId}] ${timestamp} - Error stack:`, error instanceof Error ? error.stack : 'No stack available');
      return null;
    }
  }

  // Clean up expired sessions
  public async cleanupSessions(): Promise<number> {
    return this.db.cleanupExpiredSessions();
  }

  // Parse cookies from request headers (using simple parsing)
  public parseCookies(cookieHeader?: string | null): Record<string, string> {
    const timestamp = new Date().toISOString();
    console.log(`[AUTH_SERVICE] ${timestamp} - Parsing cookies from header: ${cookieHeader ? 'present' : 'missing'}`); 
    
    if (!cookieHeader) {
      console.log(`[AUTH_SERVICE] ${timestamp} - No cookie header provided`); 
      return {};
    }
    
    const cookies: Record<string, string> = {};
    const cookiePairs = cookieHeader.split(';');
    
    console.log(`[AUTH_SERVICE] ${timestamp} - Found ${cookiePairs.length} cookie pairs in header`);
    
    cookiePairs.forEach(pair => {
      const [key, value] = pair.trim().split('=');
      if (key && value) {
        cookies[key] = decodeURIComponent(value);
        
        // Only log session cookie keys (not values) for security
        if (key === 'session' || key === 'sessionId') {
          console.log(`[AUTH_SERVICE] ${timestamp} - Found ${key} cookie, length: ${value.length}, prefix: ${value.substring(0, 8)}...`);
        }
      }
    });
    
    // Log all cookie keys found (but not values)
    console.log(`[AUTH_SERVICE] ${timestamp} - Parsed cookies with keys: ${Object.keys(cookies).join(', ') || 'none'}`); 
    
    return cookies;
  }

  // Create cookie options for Next.js Response.cookies with header info support
  public getSessionCookieOptions(expiresIn: number = this.SESSION_EXPIRY, headers?: Headers): {
    name: string;
    value: string;
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'strict' | 'lax' | 'none';
      expires: Date;
      path: string;
    };
  } {
    const timestamp = new Date().toISOString();
    const expires = new Date(Date.now() + expiresIn);
    
    // Determine environment and protocol, checking both process.env and headers
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Try to get protocol from headers first, then fall back to env vars
    let requestProtocol = 'http';
    let isSecureCookie = isProduction;  // Default to secure in production
    let sameSiteMode: 'strict' | 'lax' | 'none' = 'lax';  // Default to lax for best compatibility
    
    // Check for protocol header info
    if (headers) {
      // First check X-Request-Protocol which is set by our middleware
      const headerProtocol = headers.get('X-Request-Protocol');
      if (headerProtocol) {
        requestProtocol = headerProtocol;
        console.log(`[AUTH_SERVICE] ${timestamp} - Protocol from header: ${requestProtocol}`);
      }
      
      // Alternative: Check forwarded proto which is set by many proxies and load balancers
      const forwardedProto = headers.get('x-forwarded-proto');
      if (forwardedProto && !headerProtocol) {
        requestProtocol = forwardedProto;
        console.log(`[AUTH_SERVICE] ${timestamp} - Protocol from forwarded header: ${requestProtocol}`);
      }
      
      // Check if we have explicit cookie security settings in headers
      const secureCookieHeader = headers.get('X-Secure-Cookie');
      if (secureCookieHeader) {
        isSecureCookie = secureCookieHeader === 'true';
        console.log(`[AUTH_SERVICE] ${timestamp} - Secure cookie setting from header: ${isSecureCookie}`);
      }
      
      const sameSiteHeader = headers.get('X-SameSite-Policy');
      if (sameSiteHeader && ['strict', 'lax', 'none'].includes(sameSiteHeader)) {
        sameSiteMode = sameSiteHeader as 'strict' | 'lax' | 'none';
        console.log(`[AUTH_SERVICE] ${timestamp} - SameSite setting from header: ${sameSiteMode}`);
      }
    }
    
    const isHttps = requestProtocol === 'https';
    
    // Final determination of cookie settings
    let secure = isProduction || isHttps || isSecureCookie;
    
    // For development, we prioritize compatibility over security
    // In production or HTTPS, we prioritize security
    if (!isProduction && !isHttps) {
      secure = false; // Disable secure for local HTTP development
    }
    
    // SameSite=none requires secure=true, so adjust if needed
    let sameSite = sameSiteMode;
    if (sameSite === 'none' && !secure) {
      sameSite = 'lax'; // Fallback to lax if we're using SameSite=none without secure
    }
    
    console.log(`[AUTH_SERVICE] ${timestamp} - Creating session cookie options`);
    console.log(`[AUTH_SERVICE] ${timestamp} - Environment: ${isProduction ? 'production' : 'development'}, Protocol: ${requestProtocol}`);
    console.log(`[AUTH_SERVICE] ${timestamp} - Cookie expiration: ${expires.toISOString()} (${expiresIn/1000/60/60/24} days)`); 
    console.log(`[AUTH_SERVICE] ${timestamp} - Final cookie settings: secure=${secure}, sameSite=${sameSite}`);
    
    // Use consistent cookie name 'session' for both Next.js and auth routes
    return {
      name: 'session',
      value: '', // This will be set by the caller
      options: {
        httpOnly: true,
        secure, // Conditionally enable secure cookies based on environment
        sameSite, // Adjust sameSite based on security settings
        expires,
        path: '/'
      }
    };
  }

  // Add business for user
  public async addBusiness(userId: string, businessName: string): Promise<{ success: boolean, businessId?: string, error?: string }> {
    try {
      console.log(`AuthService: Adding business "${businessName}" for user ID ${userId}`);
      
      // Validate inputs
      if (!userId || isNaN(userId)) {
        console.error(`Invalid userId: ${userId}`);
        return { success: false, error: 'Invalid user ID' };
      }
      
      if (!businessName || typeof businessName !== 'string' || !businessName.trim()) {
        console.error(`Invalid business name: ${businessName}`);
        return { success: false, error: 'Invalid business name' };
      }
      
      // Try to add the business
      const businessId = await this.db.addBusinessForUser(userId, businessName.trim());
      console.log(`AuthService: Business created successfully with ID: ${businessId}`);
      return { success: true, businessId };
    } catch (error) {
      console.error('Add business error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to add business' 
      };
    }
  }

  // Get businesses for user
  public async getBusinesses(userId: string): Promise<any[]> {
    try {
      console.log(`[BUSINESS] AuthService: Fetching businesses for user ID ${userId}`);
      const businesses = await this.db.getBusinessesForUser(userId);
      console.log(`[BUSINESS] AuthService: Found ${businesses.length} businesses for user ID ${userId}`);
      return businesses;
    } catch (error) {
      console.error('Get businesses error:', error);
      return [];
    }
  }
  
  // Delete a business for user
  public async deleteBusiness(userId: string, businessId: string): Promise<{ success: boolean, error?: string }> {
    try {
      const client = await this.db.getPool().connect();
      try {
        // Begin transaction for atomicity
        await client.query('BEGIN');

        // First check if the business belongs to the user
        const userBusinesses = await this.getBusinesses(userId);
        const businessExists = userBusinesses.some(b => b.businessId === businessId);
        if (!businessExists) {
          return { success: false, error: 'Business not found or not owned by this user' };
        }

        // Skip attempts to delete from related tables that might not exist
        // The businesses table has ON DELETE CASCADE for user_id foreign key
        // This will automatically handle deletion of child records if the relationships are set up properly

        // Delete the business directly
        const result = await client.query(
          `DELETE FROM businesses 
           WHERE business_id = $1 AND user_id = $2
           RETURNING id`,
          [businessId, userId]
        );

        // Commit transaction
        await client.query('COMMIT');

        if (result.rowCount && result.rowCount > 0) {
          return { success: true };
        } else {
          return { success: false, error: 'Business could not be deleted' };
        }
      } catch (txError) {
        // Rollback on error
        await client.query('ROLLBACK');
        throw txError;
      } finally {
        // Always release client back to pool
        client.release();
      }
    } catch (error) {
      console.error('Delete business error:', error);
      return { success: false, error: 'Failed to delete business' };
    }
  }
  
  // Get database service for initialization
  public getDatabase(): PostgresService {
    return this.db;
  }
  
  
  
  // Update user profile
  public async updateUserProfile(userId: string, updates: { name?: string, email?: string, profilePicture?: string, phoneNumber?: string }): Promise<{ success: boolean, error?: string }> {
    try {
      // Log the update operation
      console.log(`[AUTH_SERVICE] Updating profile for user ID ${userId}:`, updates);
      
      // Input validation
      if (updates.name !== undefined && (!updates.name || updates.name.trim().length === 0)) {
        return { success: false, error: 'Name cannot be empty' };
      }
      
      if (updates.email !== undefined) {
        if (!updates.email || !/\S+@\S+\.\S+/.test(updates.email)) {
          return { success: false, error: 'Invalid email format' };
        }
        
        // Check if email already exists for a different user
        const existingUser = await this.db.getUserByEmail(updates.email);
        if (existingUser && existingUser.id !== userId) {
          return { success: false, error: 'Email already in use by another account' };
        }
      }
      
      // Clean up values - protect against SQL injection and trim whitespace
      const sanitizedUpdates = { ...updates };
      
      if (updates.name !== undefined) {
        sanitizedUpdates.name = updates.name.trim();
      }
      
      if (updates.email !== undefined) {
        sanitizedUpdates.email = updates.email.trim().toLowerCase();
      }
      
      if (updates.phoneNumber !== undefined) {
        sanitizedUpdates.phoneNumber = updates.phoneNumber.trim();
      }
      
      // Attempt to update the profile
      const success = await this.db.updateUserProfile(userId, sanitizedUpdates);
      
      if (success) {
        console.log(`[AUTH_SERVICE] Profile updated successfully for user ID ${userId}`);
        return { success: true };
      } else {
        console.error(`[AUTH_SERVICE] Database failed to update profile for user ID ${userId}`);
        return { success: false, error: 'Database failed to update profile' };
      }
    } catch (error) {
      console.error('[AUTH_SERVICE] Update profile error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update profile' 
      };
    }
  }
  
  // Get default profile picture URL
  public async getDefaultProfilePicture(): Promise<string> {
    // Check if we're in a browser context
    if (typeof window !== 'undefined') {
      return '/default-avatar.png'; // Relative URL works in browser
    }
    
    // In server context, use full URL with dynamic host detection
    const { getBaseUrl } = await import('@/lib/utilities/common');
    return `${getBaseUrl()}/default-avatar.png`;
  }

  /**
   * Stores an OAuth state in Redis for verification during callback.
   * @param state The state string generated by the OAuth provider.
   * @param userId The ID of the user initiating the OAuth flow (if logged in).
   * @param platform The social media platform (e.g., 'twitter').
   * @param ttlSeconds Time-to-live for the state in seconds.
   * @returns True if successful, false otherwise.
   */
  public async setOAuthState(state: string, userId: string | null, platform: string, ttlSeconds: number): Promise<boolean> {
    try {
      const key = `${this.redis.getKeyPrefixes().CACHE}oauth:state:${state}`;
      const value = JSON.stringify({ userId, platform });
      await this.redis.set(key, value, ttlSeconds);
      return true;
    } catch (error) {
      console.error('Error setting OAuth state in Redis:', error);
      return false;
    }
  }

  /**
   * Retrieves an OAuth state from Redis.
   * @param state The state string to retrieve.
   * @returns The stored data (userId, platform) or null if not found/expired.
   */
  public async getOAuthState(state: string): Promise<{ userId: string | null; platform: string } | null> {
    try {
      const key = `${this.redis.getKeyPrefixes().CACHE}oauth:state:${state}`;
      const value = await this.redis.get(key);
      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch (error) {
      console.error('Error getting OAuth state from Redis:', error);
      return null;
    }
  }

  /**
   * Clears an OAuth state from Redis.
   * @param state The state string to clear.
   * @returns True if successful, false otherwise.
   */
  public async clearOAuthState(state: string): Promise<boolean> {
    try {
      const key = `${this.redis.getKeyPrefixes().CACHE}oauth:state:${state}`;
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      console.error('Error clearing OAuth state from Redis:', error);
      return false;
    }
  }

  /**
   * Stores an OAuth code verifier in Redis.
   * @param state The state string associated with the verifier.
   * @param codeVerifier The PKCE code verifier.
   * @param ttlSeconds Time-to-live for the verifier in seconds.
   * @returns True if successful, false otherwise.
   */
  public async setOAuthCodeVerifier(state: string, codeVerifier: string, ttlSeconds: number): Promise<boolean> {
    try {
      const key = `${this.redis.getKeyPrefixes().CACHE}oauth:verifier:${state}`;
      await this.redis.set(key, codeVerifier, ttlSeconds);
      return true;
    } catch (error) {
      console.error('Error setting OAuth code verifier in Redis:', error);
      return false;
    }
  }

  /**
   * Retrieves an OAuth code verifier from Redis.
   * @param state The state string associated with the verifier.
   * @returns The code verifier string or null if not found/expired.
   */
  public async getOAuthCodeVerifier(state: string): Promise<string | null> {
    try {
      const key = `${this.redis.getKeyPrefixes().CACHE}oauth:verifier:${state}`;
      const value = await this.redis.get(key);
      return value;
    } catch (error) {
      console.error('Error getting OAuth code verifier from Redis:', error);
      return null;
    }
  }

  /**
   * Creates a new user session or retrieves an existing one based on social account details.
   * If a social account with the given platform and platform_user_id exists, it updates it.
   * Otherwise, it inserts a new one.
   * @param platform The social media platform.
   * @param platformUserId The unique ID of the user on that platform.
   * @param username The username/display name from the platform.
   * @param accessToken The access token for the social account.
   * @param refreshToken Optional refresh token.
   * @param expiresAt Optional expiration date for the access token.
   * @param existingUserId Optional: If the user is already logged in, their ID can be provided to link the social account.
   * @returns An object indicating success, user info, token, or an error.
   */
  public async createOrGetUserSession(
    platform: SocialAccount['platform'],
    platformUserId: string,
    username: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date,
    existingUserId?: string | null // Optional: if we know the user ID from a prior session
  ): Promise<{ success: boolean; user?: any; token?: string; error?: string }> {
    try {
      let user;
      let socialAccount: SocialAccount | null = null;

      // 1. Try to find existing social account
      socialAccount = await this.db.getSocialAccountByPlatformId(platform, platformUserId);

      if (socialAccount) {
        // Social account exists, get the associated user
        user = await this.db.getUserById(socialAccount.user_id);
        if (!user) {
          console.error(`User not found for existing social account ${platformUserId}. This should not happen.`);
          // Attempt to clean up the orphaned social account
          await this.db.deleteSocialAccount(socialAccount.id); 
          return { success: false, error: 'Associated user not found' };
        }
        console.log(`Found existing social account for ${platform} user ${platformUserId}, linked to user ID ${user.id}`);

        // Update access token and other details
        await this.db.upsertSocialAccount(
          user.id,
          platform,
          platformUserId,
          username,
          accessToken,
          refreshToken,
          expiresAt,
          socialAccount.business_id // Keep existing business_id
        );
      } else {
        // No existing social account.
        // 2. Check if an existing user ID was provided (e.g., user already logged in)
        if (existingUserId) {
          user = await this.db.getUserById(existingUserId);
          if (!user) {
            console.error(`Provided existingUserId ${existingUserId} not found.`);
            return { success: false, error: 'Provided user not found' };
          }
          console.log(`Linking new social account for ${platform} user ${platformUserId} to existing user ID ${user.id}`);
        } else {
          // 3. No existing social account and no existing user ID.
          // Create a new user. For simplicity, we'll use a placeholder email and a random password.
          // In a real app, you might prompt the user to link or create a full account.
          const email = `${platformUserId}@${platform}.socialgenius.com`; // Placeholder email
          const tempPassword = randomBytes(16).toString('hex'); // Random password
          const passwordHash = this.hashPassword(tempPassword); // Hash it

          console.log(`Creating new user for ${platform} user ${platformUserId} with email ${email}`);
          const newUserId = await this.db.registerUser(email, passwordHash, username);
          if (!newUserId) {
            return { success: false, error: 'Failed to create new user' };
          }
          user = await this.db.getUserById(newUserId);
          if (!user) {
            return { success: false, error: 'Failed to retrieve newly created user' };
          }
          console.log(`New user created with ID: ${user.id}`);
        }

        // Create the new social account entry
        socialAccount = await this.db.upsertSocialAccount(
          user.id,
          platform,
          platformUserId,
          username,
          accessToken,
          refreshToken,
          expiresAt,
          null // No business linked initially
        );
        console.log(`New social account created with ID: ${socialAccount.id}`);
      }

      // At this point, we have a user and a socialAccount linked.
      await this.db.updateLastLogin(user.id);
      const token = this.createToken(user);

      const userInfo = {
        id: user.id,
        email: user.email,
        name: user.name,
        socialAccounts: [socialAccount] // Include the newly created/updated social account
      };

      return { success: true, token, user: userInfo };
    } catch (error) {
      console.error(`Error in createOrGetUserSession for ${platform} user ${platformUserId}:`, error);
      return { success: false, error: 'Failed to process social login' };
    }
  }
}

export default AuthService;
