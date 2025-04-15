// This is the fixed version of the database connection logic
// It prioritizes using the Docker service name instead of hard-coded IP addresses

import { Pool } from 'pg';
import { OpenAIEmbeddings } from '@langchain/openai';

class PostgresServiceFixed {
  private static instance: PostgresServiceFixed;
  private pool: Pool;
  private embeddings: OpenAIEmbeddings;

  private constructor() {
    try {
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
      
      if (runningInDocker) {
        // Inside Docker container - use Docker network DNS (service name)
        // IMPORTANT: Always use the service name "postgres" instead of IP address
        connectionString = process.env.DATABASE_URL_DOCKER || 
                          'postgresql://postgres:postgres@postgres:5432/socialgenius';
        console.log('Using Docker network (service name): postgres:5432');
      } else {
        // Outside Docker container - use host to container communication
        connectionString = process.env.DATABASE_URL || 
                          'postgresql://postgres:postgres@localhost:5435/socialgenius';
        console.log('Using host machine connection: localhost:5435');
      }
      
      // Always log which connection we're using (hide credentials)
      console.log(`PostgresService: Connecting to database with connection string: ${connectionString.split('@')[0]}@***@${connectionString.split('@')[1]}`);
      
      this.pool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
        max: 10,
        min: 2,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 60000,
        native: false // Force JavaScript implementation
      });
      
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

  public static getInstance(): PostgresServiceFixed {
    if (!PostgresServiceFixed.instance) {
      PostgresServiceFixed.instance = new PostgresServiceFixed();
    }
    return PostgresServiceFixed.instance;
  }

  // Test database connection with automatic retry and fallback to alternative connection strings
  public async testConnection(): Promise<boolean> {
    // When running in static build mode, just return true to avoid connection errors
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'build-static') {
      console.log('Skipping database connection check during static build');
      return true;
    }
    
    let client;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Database connection attempt ${attempt}/${maxRetries}...`);
        client = await this.pool.connect();
        
        // Try a simple query to really verify the connection
        const result = await client.query('SELECT 1 as connection_test');
        
        if (result.rows.length > 0 && result.rows[0].connection_test === 1) {
          console.log('✅ Successfully connected to PostgreSQL database and verified query execution');
          client.release();
          return true;
        } else {
          console.error('Connected to PostgreSQL database but query returned unexpected result');
          client.release();
        }
      } catch (error) {
        console.error(`Failed to connect to PostgreSQL database (attempt ${attempt}/${maxRetries}):`, error);
        if (client) {
          try {
            client.release();
          } catch (releaseError) {
            console.error('Error closing pool:', releaseError);
          }
        }
        
        // Wait before retrying
        if (attempt < maxRetries) {
          const delay = attempt === 1 ? 2000 : 4000; // 2s, then 4s
          console.log(`Waiting ${delay/1000}s before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (attempt === maxRetries) {
          // On final attempt, try alternative connection strings
          console.log('Final attempt: Trying different connection strings...');
          
          // Try these connection strings in order until one works
          const connectionStrings = [
            // Try the same connection string first
            this.pool.options.connectionString,
            'postgresql://postgres:postgres@postgres:5432/socialgenius', // Docker service name
            'postgresql://postgres:postgres@postgres:5432/postgres',     // Default DB name
            'postgresql://postgres:postgres@host.docker.internal:5435/socialgenius' // Mac/Windows host
          ];
          
          // Test each connection string
          for (const connString of connectionStrings) {
            try {
              // Skip if it's the same as what we're already using
              if (connString === this.pool.options.connectionString) continue;
              
              console.log(`Trying connection string: ${connString.split('@')[0]}@***@${connString.split('@')[1]}`);
              
              // Create a temporary pool with this connection string
              const tempPool = new Pool({
                connectionString: connString,
                connectionTimeoutMillis: 5000,
                max: 1
              });
              
              const tempClient = await tempPool.connect();
              const result = await tempClient.query('SELECT 1 as connection_test');
              
              if (result.rows.length > 0 && result.rows[0].connection_test === 1) {
                console.log('✅ Successfully reconnected to PostgreSQL database with alternative connection string');
                tempClient.release();
                
                // Close and recreate our main pool with this working connection string
                try {
                  await this.pool.end();
                } catch (endError) {
                  console.error('Error closing old pool:', endError);
                }
                
                this.pool = tempPool;
                return true;
              }
              
              tempClient.release();
              await tempPool.end();
            } catch (connError) {
              console.log(`Failed to connect with ${connString.split('@')[0]}@***: ${connError.message}`);
            }
          }
        }
      }
    }
    
    return false;
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
    try {
      // Start a transaction
      await client.query('BEGIN');
      
      // Create vector extension
      try {
        await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      } catch (e) {
        console.error('Error creating vector extension:', e);
      }
      
      // Create tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          password_hash TEXT NOT NULL,
          profile_picture TEXT,
          phone_number TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          last_login TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS sessions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          session_id TEXT UNIQUE NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMP NOT NULL,
          data JSONB
        );
        
        CREATE TABLE IF NOT EXISTS businesses (
          id SERIAL PRIMARY KEY,
          business_id TEXT UNIQUE NOT NULL,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          google_auth_status VARCHAR(50) DEFAULT 'not_connected',
          google_email VARCHAR(255),
          google_credentials_encrypted TEXT,
          google_auth_timestamp TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS documents (
          id SERIAL PRIMARY KEY,
          document_id TEXT UNIQUE NOT NULL,
          title TEXT,
          content TEXT,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          business_id TEXT REFERENCES businesses(business_id) ON DELETE CASCADE,
          metadata JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS document_chunks (
          id SERIAL PRIMARY KEY,
          document_id TEXT REFERENCES documents(document_id) ON DELETE CASCADE,
          chunk_index INTEGER,
          content TEXT,
          embedding VECTOR(1536),
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS task_logs (
          id SERIAL PRIMARY KEY,
          task_id VARCHAR(255) NOT NULL,
          business_id VARCHAR(255) NOT NULL,
          task_type VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
          result TEXT,
          error TEXT,
          screenshot_path TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Add indexes (ignoring errors if they already exist)
      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
          CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
          CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON businesses(user_id);
          CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
          CREATE INDEX IF NOT EXISTS idx_documents_business_id ON documents(business_id);
          CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
          CREATE INDEX IF NOT EXISTS idx_task_logs_business_id ON task_logs(business_id);
          CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
        `);
      } catch (error) {
        console.warn('Error creating some indexes (they may already exist):', error);
      }
      
      // Commit the transaction
      await client.query('COMMIT');
      console.log('Tables created successfully!');
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      console.error('Error initializing database:', error);
      throw error;
    } finally {
      client.release();
    }
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
         VALUES ($1, $2, $3, NOW(), NOW())
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
      setClause.push(`updated_at = NOW()`);
      
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
          'UPDATE sessions SET expires_at = $1, updated_at = NOW() WHERE session_id = $2',
          [expiresAt, sessionId]
        );
      } else {
        // Create a new session
        await this.pool.query(
          'INSERT INTO sessions (user_id, session_id, created_at, expires_at) VALUES ($1, $2, NOW(), $3)',
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
        'UPDATE users SET last_login = NOW() WHERE id = $1 RETURNING id',
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
         VALUES ($1, $2, $3, 'active', NOW(), NOW())
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
}

export default PostgresServiceFixed;