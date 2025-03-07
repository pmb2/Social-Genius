import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'crypto';
import PostgresService from './postgres-service';

class AuthService {
  private static instance: AuthService;
  private db: PostgresService;
  private JWT_SECRET: string;
  private SESSION_EXPIRY: number = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds // 30 days in milliseconds

  private constructor() {
    this.db = PostgresService.getInstance();
    // In production, this should be set from environment variables
    this.JWT_SECRET = process.env.JWT_SECRET || 'social-genius-secret-key-change-in-production';
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
      
      // Production environments should never have dummy hashes
      // This section is removed for production

      // Handle case where the hash doesn't have expected format
      if (!storedHash.includes(':')) {
        console.error('Invalid hash format - missing separator:', storedHash);
        return false;
      }
      
      // Extract the salt and hash
      const [salt, hash] = storedHash.split(':');
      console.log('Extracted salt length:', salt?.length, 'hash length:', hash?.length);
      
      if (!salt || !hash) {
        console.error('Failed to extract salt or hash from stored hash');
        return false;
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

  // Generate a session ID
  private generateSessionId(): string {
    return randomBytes(32).toString('hex');
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
  public async register(email: string, password: string, name?: string): Promise<{ success: boolean, userId?: number, error?: string }> {
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
      
      // Create session
      const sessionId = this.generateSessionId();
      const expiresAt = new Date(Date.now() + this.SESSION_EXPIRY);
      await this.db.createSession(user.id, sessionId, expiresAt);
      
      console.log('Created session for user:', email, 'session ID:', sessionId);
      
      // Return user info (without password)
      const userInfo = {
        id: user.id,
        email: user.email,
        name: user.name,
        sessionId
      };
      
      return { success: true, token, user: userInfo };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    }
  }

  // Logout a user
  public async logout(sessionId: string): Promise<boolean> {
    try {
      return await this.db.deleteSession(sessionId);
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  // Verify a session
  public async verifySession(sessionId: string): Promise<any | null> {
    try {
      const session = await this.db.getSessionById(sessionId);
      if (!session) {
        return null;
      }
      
      // Also verify that the user exists
      const user = await this.db.getUserById(session.user_id);
      if (!user) {
        return null;
      }
      
      return {
        ...session,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      };
    } catch (error) {
      console.error('Session verification error:', error);
      return null;
    }
  }

  // Clean up expired sessions
  public async cleanupSessions(): Promise<number> {
    return this.db.cleanupExpiredSessions();
  }

  // Parse cookies from request headers (using simple parsing)
  public parseCookies(cookieHeader?: string): Record<string, string> {
    if (!cookieHeader) return {};
    
    const cookies: Record<string, string> = {};
    const cookiePairs = cookieHeader.split(';');
    
    cookiePairs.forEach(pair => {
      const [key, value] = pair.trim().split('=');
      if (key && value) {
        cookies[key] = decodeURIComponent(value);
      }
    });
    
    return cookies;
  }

  // Create cookie options for Next.js Response.cookies
  public getSessionCookieOptions(expiresIn: number = this.SESSION_EXPIRY): {
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
    const expires = new Date(Date.now() + expiresIn);
    
    return {
      name: 'sessionId',
      value: '', // This will be set by the caller
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires,
        path: '/'
      }
    };
  }

  // Add business for user
  public async addBusiness(userId: number, businessName: string): Promise<{ success: boolean, businessId?: string, error?: string }> {
    try {
      const businessId = await this.db.addBusinessForUser(userId, businessName);
      return { success: true, businessId };
    } catch (error) {
      console.error('Add business error:', error);
      return { success: false, error: 'Failed to add business' };
    }
  }

  // Get businesses for user
  public async getBusinesses(userId: number): Promise<{ success: boolean, businesses?: any[], error?: string }> {
    try {
      const businesses = await this.db.getBusinessesForUser(userId);
      return { success: true, businesses };
    } catch (error) {
      console.error('Get businesses error:', error);
      return { success: false, error: 'Failed to get businesses' };
    }
  }
  
  // Get database service for initialization
  public getDatabase(): PostgresService {
    return this.db;
  }
}

export default AuthService;