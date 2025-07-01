// This is the fixed version of the database connection logic
// It prioritizes using the Docker service name instead of hard-coded IP addresses

import '@/lib/utilities/pg-patch'; // Import pg patch to ensure pg-native is correctly handled
import { Pool } from 'pg';
import { OpenAIEmbeddings } from '@langchain/openai';

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
        connectionString = 'postgresql://postgres:postgres@127.0.0.1:5435/socialgenius';
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
        openAIApiKey: process.env.OPENAI_API_KEY || '',
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
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          password_hash TEXT NOT NULL,
          profile_picture TEXT,
          phone_number TEXT,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP WITH TIME ZONE
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
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
          id SERIAL PRIMARY KEY,
          business_id TEXT UNIQUE NOT NULL,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
    
    // 4. Create documents table (depends on users and businesses)
    try {
      console.log('Creating documents table...');
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id SERIAL PRIMARY KEY,
          document_id TEXT UNIQUE NOT NULL,
          title TEXT,
          content TEXT,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
    
    // 5. Create document_chunks table (without foreign key first)
    try {
      console.log('Creating document_chunks table...');
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id SERIAL PRIMARY KEY,
          document_id TEXT,
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
    
    // 5a. Add foreign key constraint in a separate transaction
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
    
    // 6. Create task_logs table (no critical dependencies)
    try {
      console.log('Creating task_logs table...');
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE IF NOT EXISTS task_logs (
          id SERIAL PRIMARY KEY,
          task_id VARCHAR(255) NOT NULL,
          business_id VARCHAR(255) NOT NULL,
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
    
    // 7. Create notifications table (depends on users)
    try {
      console.log('Creating notifications table...');
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
      'CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read)'
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
  public async getUserById(userId: number): Promise<any | null> {
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
  public async registerUser(email: string, passwordHash: string, name?: string): Promise<number> {
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
      return result.rows[0].id;
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
  public async updateUserProfile(userId: number, updates: { name?: string, email?: string, profilePicture?: string, phoneNumber?: string }): Promise<boolean> {
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
  public async createSession(userId: number, sessionId: string, expiresAt: Date): Promise<boolean> {
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
        `SELECT s.*, u.id as user_id, u.email, u.name, u.profile_picture, u.phone_number
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
  public async updateLastLogin(userId: number): Promise<boolean> {
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
  public async addBusinessForUser(userId: number, businessName: string): Promise<string> {
    const client = await this.pool.connect();
    try {
      // Generate a unique business ID
      const businessId = `biz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
      const result = await client.query(
        `INSERT INTO businesses (business_id, user_id, name, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id`,
        [businessId, userId, businessName]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Failed to create business record');
      }
      
      return businessId;
    } catch (error) {
      console.error('Error adding business for user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get businesses for a user
   */
  public async getBusinessesForUser(userId: number): Promise<any[]> {
    try {
      const result = await this.pool.query(
        `SELECT id, business_id as "businessId", name, status, created_at as "createdAt"
         FROM businesses
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting businesses for user:', error);
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
    userId: number,
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
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  public async getAllUserIds(): Promise<number[]> {
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
    userId: number,
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
  public async getUnreadNotificationCount(userId: number): Promise<number> {
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
  public async markNotificationAsRead(notificationId: number, userId: number): Promise<boolean> {
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
  public async markAllNotificationsAsRead(userId: number): Promise<number> {
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
  public async deleteNotification(notificationId: number, userId: number): Promise<boolean> {
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
}

export default PostgresService;