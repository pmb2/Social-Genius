// This is the fixed version of the database connection logic
// It prioritizes using the Docker service name instead of hard-coded IP addresses


import { Pool } from 'pg';
import { OpenAIEmbeddings } from '@langchain/openai';

/**
 * Interface for a social media account linked to a user.
 */
export interface SocialAccount {
  id: string; // Changed to string for UUID
  user_id: string; // Changed to string for UUID
  platform: 'twitter' | 'facebook' | 'instagram' | 'linkedin';
  platform_user_id: string;
  username: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: Date;
  business_id?: string; // Optional, links to businesses table (UUID)
  created_at: Date;
  updated_at: Date;
}

class PostgresService {
  private static instance: PostgresService;
  private pool: Pool;
  private embeddings: OpenAIEmbeddings;

  // Track connection status and provide retry mechanism
  private connectionActive: boolean = false;
  private connectionRetryTimer: NodeJS.Timeout | null = null;
  private maxReconnectAttempts: number = 5;
  private currentReconnectAttempt: number = 0;
  private reconnectInterval: number = 5000; // 5 seconds

  private constructor() {
    console.log('[PostgresService Constructor] NODE_ENV:', process.env.NODE_ENV);
    console.log('[PostgresService Constructor] IRON_SESSION_SECRET (first 5 chars):', process.env.IRON_SESSION_SECRET?.substring(0, 5));
    try {
      // Explicitly set important environment variables
      process.env.NODE_PG_FORCE_NATIVE = '0';
      
      let connectionString: string;
      
      // Determine if we're running in Docker
      const runningInDocker = process.env.RUNNING_IN_DOCKER === 'true';
      console.log('=== POSTGRES SERVICE INITIALIZATION ===');
      console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
      console.log('DATABASE_URL_DOCKER:', process.env.DATABASE_URL_DOCKER ? 'Set' : 'Not set');
      console.log('RUNNING_IN_DOCKER:', runningInDocker);
      console.log('PGHOST:', process.env.PGHOST);
      console.log('PGUSER:', process.env.PGUSER);
      console.log('PGPASSWORD:', process.env.PGPASSWORD ? 'Set' : 'Not set');
      console.log('PGDATABASE:', process.env.PGDATABASE);
      console.log('NODE_PG_FORCE_NATIVE:', process.env.NODE_PG_FORCE_NATIVE);
      
      // Always prioritize explicitly set DATABASE_URL
      if (process.env.DATABASE_URL) {
        connectionString = process.env.DATABASE_URL;
        console.log('Using explicit DATABASE_URL from environment');
      } else if (runningInDocker) {
        // Inside Docker container - use Docker network DNS (service name)
        // IMPORTANT: Always use the service name "postgres" instead of IP address
        connectionString = 'postgresql://postgres:postgres@postgres:5432/socialgenius';
        console.log('Using Docker network (service name): postgres:5432');
        // Also set the environment variable for other components
        process.env.DATABASE_URL = connectionString;
      } else {
        // Outside Docker container - use host to container communication
        connectionString = 'postgresql://postgres:postgres@localhost:5435/socialgenius';
        console.log('Using host machine connection: localhost:5435');
        // Also set the environment variable for other components
        process.env.DATABASE_URL = connectionString;
      }
      
      // Always log which connection we're using (hide credentials)
      const [creds, endpoint] = connectionString.split('@');
      console.log(`PostgresService: Connecting to database at endpoint: ${endpoint}`);
      
      // Create explicit connection params to bypass any pg-native issues
      const config = {
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 10,
        min: 2,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 60000,
        native: false // Force JavaScript implementation
      };
      
      console.log('Connection config:', { 
        ...config, 
        connectionString: '***REDACTED***' // Don't log credentials
      });
      
      this.pool = new Pool(config);
      
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: "text-embedding-3-small"
      });

      // Initialize the pool
      this.pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
        console.error('Database pool error, but continuing operation');
      });
      
      // Test the connection immediately
      this.testConnection();
    } catch (error) {
      console.error('Error initializing PostgresService:', error);
      
      // Create a minimal pool with fallback connection using service name
      const fallbackConnection = 'postgresql://postgres:postgres@postgres:5432/socialgenius';
      
      console.log(`Using fallback connection: ${fallbackConnection.split('@')[0]}@***`);
      
      this.pool = new Pool({
        connectionString: fallbackConnection,
        ssl: false,
        connectionTimeoutMillis: 8000,
        native: false,
        max: 5
      });
      
      // Still create embeddings
      this.embeddings = new OpenAIEmbeddings({
        openAIAIApiKey: process.env.OPENAI_API_KEY || '',
        modelName: "text-embedding-3-small"
      });
    }
  }

  public static getInstance(): PostgresService {
    if (!PostgresService.instance) {
      PostgresService.instance = new PostgresService();
    }
    return PostgresService.instance;
  }

  // Advanced database connection testing with retry logic
  public async testConnection(): Promise<boolean> {
    // Set up proper timeouts for connection testing
    const queryTimeout = 10000; // 10 second query timeout for better reliability
    let client;
    
    // For build process, use a shortened timeout to avoid hanging builds
    const isBuildProcess = process.env.NODE_ENV === 'production' || 
                        process.env.NEXT_PHASE?.includes('build');
    
    // Print current connection status
    console.log('===== DATABASE CONNECTION TEST =====');
    console.log('Current connection active:', this.connectionActive);
    console.log('Current reconnect attempt:', this.currentReconnectAttempt);
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':***@')); // Hide password
    console.log('Running in Docker:', process.env.RUNNING_IN_DOCKER === 'true');
    console.log('Node.js version:', process.version);
    console.log('NODE_PG_FORCE_NATIVE:', process.env.NODE_PG_FORCE_NATIVE);
    
    try {
      console.log('Testing database connection...');
      
      // Ensure non-native implementation
      process.env.NODE_PG_FORCE_NATIVE = '0';
      
      // Set a timeout for the client connect operation
      const connectPromise = this.pool.connect();
      const connectTimeoutPromise = new Promise<any>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Connection attempt timed out after ${queryTimeout}ms`));
        }, queryTimeout);
      });
      
      // Race the connect against the timeout
      client = await Promise.race([connectPromise, connectTimeoutPromise]);
      console.log('Client connection established successfully');
      
      // Execute a simple query with timeout to verify connection
      const queryPromise = client.query('SELECT 1 as connection_test');
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Query timed out after ${queryTimeout}ms`));
        }, isBuildProcess ? 5000 : queryTimeout);
      });
      
      // Race the query against the timeout
      console.log('Executing test query...');
      const result = await Promise.race([queryPromise, timeoutPromise]) as any;
      
      if (result && result.rows && result.rows.length > 0 && result.rows[0].connection_test === 1) {
        this.connectionActive = true;
        this.currentReconnectAttempt = 0;
        
        console.log('✅ Successfully connected to PostgreSQL database');
        
        // Clear any retry timers
        if (this.connectionRetryTimer) {
          clearTimeout(this.connectionRetryTimer);
          this.connectionRetryTimer = null;
        }
        
        // Try a second query to verify database is working properly
        console.log('Executing second test query to verify database...');
        try {
          const secondTestResult = await client.query("SELECT current_database() as db_name, current_user as username, version()");
          console.log('Database info:', {
            database: secondTestResult.rows[0].db_name,
            user: secondTestResult.rows[0].username,
            version: secondTestResult.rows[0].version
          });
        } catch (secondQueryError) {
          console.warn('Second query failed but connection is still considered valid:', secondQueryError);
        }
        
        client.release();
        return true;
      } else {
        console.error('Connected to PostgreSQL database but query returned unexpected result');
        client.release();
        this.scheduleReconnect();
        return false;
      }
    } catch (error) {
      console.error('Database connection test failed:', error instanceof Error ? error.message : String(error));
      
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error('Error releasing client:', releaseError);
        }
      }
      
      // Handle build-time differently - don't hang the build process
      if (isBuildProcess) {
        console.log('Build environment detected, proceeding with build despite database connection issues');
        return true;
      }
      
      // For runtime, schedule reconnection attempts
      this.scheduleReconnect();
      return false;
    }
  }
  
  // Schedule a reconnection attempt
  private scheduleReconnect(): void {
    this.connectionActive = false;
    this.currentReconnectAttempt++;
    
    // Clear any existing timer
    if (this.connectionRetryTimer) {
      clearTimeout(this.connectionRetryTimer);
    }
    
    // If we've exceeded max attempts, log a critical error
    if (this.currentReconnectAttempt > this.maxReconnectAttempts) {
      console.error(`Failed to connect to database after ${this.maxReconnectAttempts} attempts`);
      return;
    }
    
    // Calculate backoff time (exponential backoff with jitter)
    const baseDelay = this.reconnectInterval;
    const exponentialBackoff = Math.pow(1.5, this.currentReconnectAttempt - 1);
    const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15
    const delay = Math.min(baseDelay * exponentialBackoff * jitter, 30000); // Max 30 seconds
    
    console.log(`Scheduling database reconnection attempt ${this.currentReconnectAttempt} in ${Math.round(delay/1000)}s`);
    
    // Schedule the retry
    this.connectionRetryTimer = setTimeout(async () => {
      await this.testConnection();
    }, delay);
  }
  
  // Connection-aware query method with automatic retries
  public async safeQuery<T>(
    queryText: string, 
    params: any[] = [], 
    options: { retries?: number, fallbackValue?: any } = {}
  ): Promise<T> {
    const retries = options.retries ?? 2;
    let attempt = 0;
    
    while (attempt <= retries) {
      try {
        // If this is a retry and connection isn't active, test it first
        if (attempt > 0 && !this.connectionActive) {
          await this.testConnection();
        }
        
        const result = await this.pool.query(queryText, params);
        return result as unknown as T;
      } catch (error) {
        attempt++;
        
        if (attempt <= retries) {
          console.error(`Query failed (attempt ${attempt}/${retries+1}), retrying: ${error instanceof Error ? error.message : String(error)}`);
          // Add exponential backoff between retries
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt-1) * 100));
          
          // Test connection before retry
          await this.testConnection();
        } else {
          console.error(`Query failed after ${retries+1} attempts:`, error);
          
          // If fallback value was provided, return it
          if ('fallbackValue' in options) {
            return options.fallbackValue;
          }
          
          throw error;
        }
      }
    }
    
    // This should never be reached, but TypeScript needs a return statement
    throw new Error('Query failed with all retries exhausted');
  }

  // Get the pool
  public getPool(): Pool {
    return this.pool;
  }

  /**
   * Initialize the database - create tables if they don't exist
   */
  public async initialize(): Promise<void> {
    // Implementation of initialize method
    console.log('Initialize method called - creating tables if needed');
    
    const client = await this.pool.connect();
    
    // Create vector extension outside of transaction
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      console.log('Vector extension created or already exists');
    } catch (e) {
      console.error('Error creating vector extension:', e);
    }
    
    // 1. First create the users table (no dependencies)
    try {
      console.log('Creating users table...');
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT UNIQUE NOT NULL,
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          password_hash TEXT NOT NULL,
          profile_picture TEXT,
          phone_number TEXT,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP WITH TIME ZONE,
          plan_id TEXT NOT NULL DEFAULT 'basic'
        );
      `);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating users table:', error.message);
    }
    
    // 2. Create sessions table (depends on users)
    try {
      console.log('Creating sessions table...');
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id SERIAL PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          session_id TEXT UNIQUE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          data JSONB
        );
      `);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating sessions table:', error.message);
    }
    
    // 3. Create businesses table (depends on users)
    try {
      console.log('Creating businesses table...');
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE IF NOT EXISTS businesses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          business_id TEXT UNIQUE NOT NULL,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          google_auth_status VARCHAR(50) DEFAULT 'not_connected',
          google_email VARCHAR(255),
          google_credentials_encrypted TEXT,
          google_auth_timestamp TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating businesses table:', error.message);
    }
    
    // 4. Create social_accounts table (depends on users and businesses)
    try {
      console.log('Creating social_accounts table...');
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE IF NOT EXISTS social_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          platform VARCHAR(50) NOT NULL,
          platform_user_id TEXT UNIQUE NOT NULL,
          username TEXT NOT NULL,
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          expires_at TIMESTAMP WITH TIME ZONE,
          business_id TEXT REFERENCES businesses(business_id) ON DELETE SET NULL, -- Link to businesses
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(platform, platform_user_id)
        );
      `);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating social_accounts table:', error.message);
    }

    // 5. Create documents table (depends on users and businesses)
    try {
      console.log('Creating documents table...');
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id TEXT UNIQUE NOT NULL,
          title TEXT,
          content TEXT,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          business_id TEXT REFERENCES businesses(business_id) ON DELETE CASCADE,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating documents table:', error.message);
    }
    
    // 6. Create document_chunks table (without foreign key first)
    try {
      console.log('Creating document_chunks table...');
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id UUID,
          chunk_index INTEGER,
          content TEXT,
          embedding VECTOR(1536),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating document_chunks table:', error.message);
    }
    
    // 6a. Add foreign key constraint in a separate transaction
    try {
      await client.query('BEGIN');
      // Use a safer approach that works with all PostgreSQL versions
      await client.query(`
        DO $$
        BEGIN
          -- Check if constraint exists
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'document_chunks'::regclass 
            AND conname = 'fk_document_chunks_document_id'
          ) THEN
            -- Try adding the constraint
            BEGIN
              ALTER TABLE document_chunks 
              ADD CONSTRAINT fk_document_chunks_document_id 
              FOREIGN KEY (document_id) 
              REFERENCES documents(document_id) 
              ON DELETE CASCADE;
            EXCEPTION
              WHEN duplicate_object THEN
                RAISE NOTICE 'Constraint already exists';
              WHEN others THEN
                RAISE NOTICE 'Error creating constraint: %', SQLERRM;
            END;
          END IF;
        END $$;
      `);
      await client.query('COMMIT');
    } catch (fkError) {
      await client.query('ROLLBACK');
      console.warn('Note: Could not add foreign key constraint to document_chunks table:', fkError.message);
    }
    
    // 7. Create task_logs table (no critical dependencies)
    try {
      console.log('Creating task_logs table...');
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE IF NOT EXISTS task_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          task_id VARCHAR(255) NOT NULL,
          business_id UUID NOT NULL,
          task_type VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
          result TEXT,
          error TEXT,
          screenshot_path TEXT,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating task_logs table:', error.message);
    }
    
    // 8. Create notifications table (depends on users)
    try {
      console.log('Creating notifications table...');
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          notification_type TEXT NOT NULL CHECK (notification_type IN ('info', 'success', 'warning', 'alert')),
          read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          read_at TIMESTAMP WITH TIME ZONE
        );
      `);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating notifications table:', error.message);
    }
    
    // Add indexes one by one, each in their own transaction
    console.log('Creating indexes...');
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON businesses(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_documents_business_id ON documents(business_id)',
      'CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id)',
      'CREATE INDEX IF NOT EXISTS idx_task_logs_business_id ON task_logs(business_id)',
      'CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read)',
      'CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON social_accounts(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_social_accounts_platform_user_id ON social_accounts(platform, platform_user_id)'
    ];
    
    for (const indexQuery of indexQueries) {
      try {
        await client.query('BEGIN');
        await client.query(indexQuery);
        await client.query('COMMIT');
      } catch (indexError) {
        await client.query('ROLLBACK');
        console.warn(`Error creating index with query "${indexQuery}":`, indexError.message);
      }
    }
    
    console.log('Tables and indexes created successfully!');
    client.release();
  }

  /**
   * Get a user by email
   */
  public async getUserByEmail(email: string): Promise<any | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }

  /**
   * Get a user by ID
   */
  public async getUserById(userId: string): Promise<any | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }

  /**
   * Register a new user
   */
  public async registerUser(email: string, passwordHash: string, name?: string): Promise<string> {
    const client = await this.pool.connect();
    try {
      console.log('Database registerUser called with:', { email, hasHash: !!passwordHash, name });
      
      // Check if the users table exists
      const tableCheckResult = await client.query(
        `SELECT EXISTS (
           SELECT FROM information_schema.tables 
           WHERE table_schema = 'public' 
           AND table_name = 'users'
         )`
      );
      
      const tableExists = tableCheckResult.rows[0].exists;
      console.log('Users table exists:', tableExists);
      
      if (!tableExists) {
        // Try to initialize the database
        console.log('Users table does not exist, attempting to initialize database...');
        await this.initialize();
      }
      
      // Now insert the user
      console.log('Inserting user into database...');
      const result = await client.query(
        `INSERT INTO users (email, password_hash, name, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id`,
        [email, passwordHash, name || null]
      );
      
      console.log('User registered with ID:', result.rows[0].id);
      return result.rows[0].id as string;
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update user profile information
   */
  public async updateUserProfile(userId: string, updates: { name?: string, email?: string, profilePicture?: string, phoneNumber?: string }): Promise<boolean> {
    try {
      // Build the SET clause dynamically based on provided updates
      const setClause = [];
      const values = [];
      let paramIndex = 1;
      
      if (updates.name !== undefined) {
        setClause.push(`name = $${paramIndex}`);
        values.push(updates.name);
        paramIndex++;
      }
      
      if (updates.email !== undefined) {
        setClause.push(`email = $${paramIndex}`);
        values.push(updates.email);
        paramIndex++;
      }
      
      if (updates.profilePicture !== undefined) {
        setClause.push(`profile_picture = $${paramIndex}`);
        values.push(updates.profilePicture);
        paramIndex++;
      }
      
      if (updates.phoneNumber !== undefined) {
        setClause.push(`phone_number = $${paramIndex}`);
        values.push(updates.phoneNumber);
        paramIndex++;
      }
      
      if (setClause.length === 0) {
        return true; // No updates to perform
      }
      
      // Add the updated_at timestamp
      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      
      // Add the user ID to the values array
      values.push(userId);
      
      const result = await this.pool.query(
        `UPDATE users SET ${setClause.join(', ')} WHERE id = $${paramIndex} RETURNING id`,
        values
      );
      
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error updating user profile:', error);
      return false;
    }
  }

  /**
   * Create a new session for a user
   */
  public async createSession(userId: string, sessionId: string, expiresAt: Date): Promise<boolean> {
    try {
      // First check if the session already exists
      const existingSession = await this.pool.query(
        'SELECT id FROM sessions WHERE session_id = $1',
        [sessionId]
      );
      
      if (existingSession.rows.length > 0) {
        // Update the existing session
        await this.pool.query(
          'UPDATE sessions SET expires_at = $1 WHERE session_id = $2',
          [expiresAt, sessionId]
        );
      } else {
        // Create a new session
        await this.pool.query(
          'INSERT INTO sessions (user_id, session_id, created_at, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP, $3)',
          [userId, sessionId, expiresAt]
        );
      }
      
      return true;
    } catch (error) {
      console.error('Error creating session:', error);
      return false;
    }
  }

  /**
   * Get a session by its ID
   */
  public async getSessionById(sessionId: string): Promise<any | null> {
    try {
      console.log(`Looking up session with ID: ${sessionId.substring(0, 8)}...`);
      
      const result = await this.pool.query(
        `SELECT s.*, u.id as user_id, u.email, u.name
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.session_id = $1 AND s.expires_at > NOW()`,
        [sessionId]
      );
      
      if (result.rows.length === 0) {
        console.log(`Session ID ${sessionId.substring(0, 8)}... not found`);
        return null;
      }
      
      const session = result.rows[0];
      
      return {
        id: session.id,
        userId: session.user_id,
        sessionId: session.session_id,
        createdAt: session.created_at,
        expiresAt: session.expires_at,
        user: {
          id: session.user_id,
          email: session.email,
          name: session.name,
          profile_picture: session.profile_picture,
          phone_number: session.phone_number
        }
      };
    } catch (error) {
      console.error('Error getting session by ID:', error);
      return null;
    }
  }

  /**
   * Delete a session by ID
   */
  public async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'DELETE FROM sessions WHERE session_id = $1 RETURNING id',
        [sessionId]
      );
      return result.rowCount ? true : false;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }
  
  /**
   * Update the last login timestamp for a user
   */
  public async updateLastLogin(userId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
        [userId]
      );
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error updating last login:', error);
      return false;
    }
  }

  /**
   * Clean up expired sessions
   */
  public async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await this.pool.query(
        'DELETE FROM sessions WHERE expires_at < NOW() RETURNING id'
      );
      console.log(`Cleaned up ${result.rowCount} expired sessions`);
      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  /**
   * Add a business for a user
   */
  public async addBusinessForUser(userId: string, businessName: string, businessId?: string, client?: any): Promise<{ success: boolean; businessId?: string; error?: string }> {
    console.log(`[BUSINESS] Adding business "${businessName}" for user ID: ${userId}`);
    const dbClient = client || await this.pool.connect();
    try {
      // Use provided business ID or generate a unique one
      const finalBusinessId = businessId || `biz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
      const result = await dbClient.query(
        `INSERT INTO businesses (business_id, user_id, name, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING business_id`,
        [finalBusinessId, userId, businessName]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Failed to create business record');
      }
      
      console.log(`[BUSINESS] Successfully added business with ID: ${finalBusinessId}`);
      return { success: true, businessId: finalBusinessId };
    } catch (error) {
      console.error('[BUSINESS] Error adding business for user:', error);
      throw error;
    } finally {
      if (!client) {
        dbClient.release();
      }
    }
  }

  /**
   * Get businesses for a user
   */
  public async getBusinessesForUser(userId: string): Promise<any[]> {
    console.log(`[BUSINESS] Fetching businesses for user ID: ${userId}`);
    try {
      const result = await this.pool.query(
        `SELECT id, business_id as "businessId", name, status, created_at as "createdAt"
         FROM businesses
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );
      
      console.log(`[BUSINESS] Found ${result.rows.length} businesses for user ID: ${userId}`);
      return result.rows;
    } catch (error) {
      console.error('[BUSINESS] Error getting businesses for user:', error);
      return [];
    }
  }
  
  // Google Authentication and Browser-Use API related methods
  
  // Update Google Auth status for a business
  public async updateGoogleAuthStatus(
    businessId: string, 
    status: string, 
    email?: string, 
    encryptedCredentials?: string
  ): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `UPDATE businesses 
         SET google_auth_status = $1, 
             google_email = $2, 
             google_credentials_encrypted = $3,
             google_auth_timestamp = CURRENT_TIMESTAMP
         WHERE business_id = $4
         RETURNING id`,
        [status, email, encryptedCredentials, businessId]
      );
      return result.rowCount ? true : false;
    } catch (error) {
      console.error('Error updating Google auth status:', error);
      return false;
    }
  }
  
  // Log a browser-use-api task
  public async logBrowserTask(
    taskId: string,
    businessId: string,
    taskType: string,
    status: string = 'in_progress',
    result?: string,
    error?: string,
    screenshotPath?: string
  ): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `INSERT INTO task_logs 
         (task_id, business_id, task_type, status, result, error, screenshot_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [taskId, businessId, taskType, status, result, error, screenshotPath]
      );
      return result.rowCount ? true : false;
    } catch (error) {
      console.error('Error logging browser task:', error);
      return false;
    }
  }
  
  // Update a browser-use-api task status
  public async updateBrowserTaskStatus(
    taskId: string,
    status: string,
    result?: string,
    error?: string,
    screenshotPath?: string
  ): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `UPDATE task_logs
         SET status = $1, 
             result = $2, 
             error = $3,
             screenshot_path = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE task_id = $5
         RETURNING id`,
        [status, result, error, screenshotPath, taskId]
      );
      return result.rowCount ? true : false;
    } catch (error) {
      console.error('Error updating browser task status:', error);
      return false;
    }
  }
  
  // Get Google Auth status for a business
  public async getGoogleAuthStatus(businessId: string): Promise<{
    status: string;
    email?: string;
    timestamp?: Date;
  } | null> {
    try {
      const result = await this.pool.query(
        `SELECT google_auth_status, google_email, google_auth_timestamp
         FROM businesses
         WHERE business_id = $1`,
        [businessId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return {
        status: result.rows[0].google_auth_status,
        email: result.rows[0].google_email,
        timestamp: result.rows[0].google_auth_timestamp
      };
    } catch (error) {
      console.error('Error getting Google auth status:', error);
      return null;
    }
  }

  /**
   * Create a notification for a user
   * @param userId The user ID
   * @param title The notification title
   * @param message The notification message
   * @param type The notification type
   * @returns The notification ID
   */
  public async createNotification(
    userId: string,
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'alert'
  ): Promise<number> {
    try {
      // First check if the notifications table exists
      const tableCheckResult = await this.pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'notifications'
        )`
      );
      
      const tableExists = tableCheckResult.rows[0].exists;
      
      // If the table doesn't exist, create it
      if (!tableExists) {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            notification_type TEXT NOT NULL CHECK (notification_type IN ('info', 'success', 'warning', 'alert')),
            read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            read_at TIMESTAMP WITH TIME ZONE
          );
          
          CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
          CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications(read);
          CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(user_id, read);
        `);
      }

      const result = await this.pool.query(
        `INSERT INTO notifications (user_id, title, message, notification_type)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [userId, title, message, type]
      );
      
      return result.rows[0].id;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get all user IDs from the database
   * @returns Array of user IDs
   */
  public async getAllUserIds(): Promise<string[]> {
    try {
      const result = await this.pool.query(
        'SELECT id FROM users'
      );
      
      return result.rows.map(row => row.id);
    } catch (error) {
      console.error('Error getting all user IDs:', error);
      return [];
    }
  }

  /**
   * Get notifications for a user
   * @param userId The user ID
   * @param limit Max number of notifications to retrieve
   * @param unreadOnly Whether to only return unread notifications
   * @returns Array of notifications
   */
  public async getNotifications(
    userId: string,
    limit: number = 50,
    unreadOnly: boolean = false
  ): Promise<any[]> {
    try {
      let query = `
        SELECT id, title, message, notification_type, read, created_at, read_at
        FROM notifications
        WHERE user_id = $1
      `;
      
      const params: any[] = [userId];
      
      if (unreadOnly) {
        query += ' AND read = FALSE';
      }
      
      query += ' ORDER BY created_at DESC';
      
      if (limit > 0) {
        query += ` LIMIT $${params.length + 1}`;
        params.push(limit);
      }
      
      const result = await this.pool.query(query, params);
      
      return result.rows;
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  /**
   * Get the count of unread notifications for a user
   * @param userId The user ID
   * @returns The count of unread notifications
   */
  public async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      // Check if notifications table exists
      const tableCheckResult = await this.pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'notifications'
        )`
      );
      
      const tableExists = tableCheckResult.rows[0].exists;
      
      // If table doesn't exist, return 0
      if (!tableExists) {
        return 0;
      }
      
      const result = await this.pool.query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = FALSE',
        [userId]
      );
      
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      return 0;
    }
  }

  /**
   * Mark a notification as read
   * @param notificationId The notification ID
   * @param userId The user ID (for security)
   * @returns Whether the operation was successful
   */
  public async markNotificationAsRead(notificationId: number, userId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `UPDATE notifications 
         SET read = TRUE, read_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [notificationId, userId]
      );
      
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param userId The user ID
   * @returns The number of notifications marked as read
   */
  public async markAllNotificationsAsRead(userId: string): Promise<number> {
    try {
      const result = await this.pool.query(
        `UPDATE notifications 
         SET read = TRUE, read_at = CURRENT_TIMESTAMP 
         WHERE user_id = $1 AND read = FALSE
         RETURNING id`,
        [userId]
      );
      
      return result.rowCount;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return 0;
    }
  }

  /**
   * Delete a notification
   * @param notificationId The notification ID
   * @param userId The user ID (for security)
   * @returns Whether the operation was successful
   */
  public async deleteNotification(notificationId: number, userId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `DELETE FROM notifications 
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [notificationId, userId]
      );
      
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }

  /**
   * Upsert a social account record.
   * If a social account with the given platform and platform_user_id exists, it updates it.
   * Otherwise, it inserts a new one.
   */
  public async upsertSocialAccount(
    userId: string,
    platform: SocialAccount['platform'],
    platformUserId: string,
    username: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date,
    businessId?: string | null
  ): Promise<SocialAccount> {
    try {
      const result = await this.pool.query(
        `INSERT INTO social_accounts (user_id, platform, platform_user_id, username, access_token, refresh_token, expires_at, business_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (platform, platform_user_id) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           username = EXCLUDED.username,
           access_token = EXCLUDED.access_token,
           refresh_token = COALESCE(EXCLUDED.refresh_token, social_accounts.refresh_token), -- Only update if new refresh token is provided
           expires_at = EXCLUDED.expires_at,
           business_id = COALESCE(EXCLUDED.business_id, social_accounts.business_id), -- Only update if new business_id is provided
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [userId, platform, platformUserId, username, accessToken, refreshToken, expiresAt, businessId]
      );
      return result.rows[0];
    } catch (error) {
      console.error(`Error upserting social account for ${platform} user ${platformUserId}:`, error);
      throw error;
    }
  }

  /**
   * Get memories for a business
   */
  public async getMemories(businessId: string): Promise<any[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM memories WHERE business_id = $1 ORDER BY created_at DESC`,
        [businessId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting memories:', error);
      return [];
    }
  }

  /**
   * Store a memory for a business
   */
  public async storeMemory(memory: { id: string, businessId: string, content: string, type: string, isCompleted: boolean }): Promise<string> {
    try {
      const result = await this.pool.query(
        `INSERT INTO memories (id, business_id, content, type, is_completed)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [memory.id, memory.businessId, memory.content, memory.type, memory.isCompleted]
      );
      return result.rows[0].id;
    } catch (error) {
      console.error('Error storing memory:', error);
      throw error;
    }
  }

  /**
   * Update a memory for a business
   */
  public async updateMemory(memoryId: string, businessId: string, updates: { content?: string, isCompleted?: boolean }): Promise<boolean> {
    try {
      const setClause = [];
      const values = [];
      let paramIndex = 1;

      if (updates.content !== undefined) {
        setClause.push(`content = ${paramIndex}`);
        values.push(updates.content);
        paramIndex++;
      }

      if (updates.isCompleted !== undefined) {
        setClause.push(`is_completed = ${paramIndex}`);
        values.push(updates.isCompleted);
        paramIndex++;
      }

      if (setClause.length === 0) {
        return true; // No updates to perform
      }

      values.push(memoryId, businessId);

      const result = await this.pool.query(
        `UPDATE memories SET ${setClause.join(', ')} WHERE id = ${paramIndex} AND business_id = ${paramIndex + 1} RETURNING id`,
        values
      );

      return result.rowCount > 0;
    } catch (error) {
      console.error('Error updating memory:', error);
      return false;
    }
  }

  /**
   * Delete a memory for a business
   */
  public async deleteMemory(memoryId: string, businessId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `DELETE FROM memories WHERE id = $1 AND business_id = $2 RETURNING id`,
        [memoryId, businessId]
      );
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting memory:', error);
      return false;
    }
  }

  /**
   * Get all social accounts for a given user ID.
   */
  public async getSocialAccountsByUserId(userId: string): Promise<SocialAccount[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM social_accounts WHERE user_id = $1`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      console.error(`Error getting social accounts for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get a social account by its platform and platform-specific user ID.
   */
  public async getSocialAccountByPlatformId(platform: SocialAccount['platform'], platformUserId: string): Promise<SocialAccount | null> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM social_accounts WHERE platform = $1 AND platform_user_id = $2`,
        [platform, platformUserId]
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error(`Error getting social account for ${platform} user ${platformUserId}:`, error);
      return null;
    }
  }

  /**
   * Update the business_id for a specific social account.
   */
  public async updateSocialAccountBusinessId(socialAccountId: string, businessId: string | null): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `UPDATE social_accounts SET business_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [businessId, socialAccountId]
      );
      return result.rowCount > 0;
    } catch (error) {
      console.error(`Error updating business_id for social account ${socialAccountId}:`, error);
      return false;
    }
  }

  /**
   * Delete a social account by its ID.
   */
  public async deleteSocialAccount(socialAccountId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `DELETE FROM social_accounts WHERE id = $1 RETURNING id`,
        [socialAccountId]
      );
      return result.rowCount > 0;
    } catch (error) {
      console.error(`Error deleting social account ${socialAccountId}:`, error);
      return false;
    }
  }

  /**
   * Get a user by X (Twitter) account ID
   */
  public async getUserByXAccountId(xAccountId: string): Promise<any | null> {
    try {
      const result = await this.pool.query(
        `SELECT u.* FROM users u
         JOIN social_accounts sa ON u.id = sa.user_id
         WHERE sa.platform = 'twitter' AND sa.platform_user_id = $1`,
        [xAccountId]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting user by X account ID:', error);
      return null;
    }
  }

  /**
   * Get a linked account by X (Twitter) account ID
   */
  public async getLinkedAccountByXAccountId(xAccountId: string): Promise<SocialAccount | null> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM social_accounts WHERE platform = 'twitter' AND platform_user_id = $1`,
        [xAccountId]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting linked account by X account ID:', error);
      return null;
    }
  }

  /**
   * Add a linked account for X (Twitter)
   */
  public async addLinkedAccount(accountData: {
    userId: string;
    businessId: string;
    xAccountId: string;
    xUsername: string;
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt: Date;
  }, client?: any): Promise<SocialAccount> {
    const dbClient = client || await this.pool.connect();
    try {
      const result = await dbClient.query(
        `INSERT INTO social_accounts (user_id, platform, platform_user_id, username, access_token, refresh_token, expires_at, business_id)
         VALUES ($1, 'twitter', $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          accountData.userId,
          accountData.xAccountId,
          accountData.xUsername,
          accountData.accessToken,
          accountData.refreshToken,
          accountData.tokenExpiresAt,
          accountData.businessId
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error adding linked account:', error);
      throw error;
    } finally {
      if (!client) {
        dbClient.release();
      }
    }
  }
}

export default PostgresService;
