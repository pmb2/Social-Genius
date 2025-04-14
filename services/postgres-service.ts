// Force JavaScript implementation of pg before importing
process.env.NODE_PG_FORCE_NATIVE = '0';

import { Pool, types } from 'pg';

// Disable the automatic conversion of timestamp columns to JavaScript Date objects for better performance
types.setTypeParser(1114, str => str); // timestamp without timezone
types.setTypeParser(1082, str => str); // date
import { OpenAIEmbeddings } from '@langchain/openai';

// Singleton pattern for database connection
class PostgresService {
  private static instance: PostgresService;
  private pool: Pool;
  private embeddings: OpenAIEmbeddings;

  private constructor() {
    try {
      console.log('=== POSTGRES SERVICE INITIALIZATION ===');
      
      // Log database environment variables for debugging
      console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
      console.log('DATABASE_URL_DOCKER:', process.env.DATABASE_URL_DOCKER ? 'Set' : 'Not set');
      console.log('RUNNING_IN_DOCKER:', process.env.RUNNING_IN_DOCKER);
      console.log('PGHOST:', process.env.PGHOST);
      console.log('PGUSER:', process.env.PGUSER);
      console.log('PGPASSWORD:', process.env.PGPASSWORD ? 'Set' : 'Not set');
      console.log('PGDATABASE:', process.env.PGDATABASE);
      console.log('NODE_PG_FORCE_NATIVE:', process.env.NODE_PG_FORCE_NATIVE);
      
      // Determine the connection string based on environment
      let connectionString;
      
      // Check if we're running inside Docker or not
      const inDocker = process.env.RUNNING_IN_DOCKER === 'true';
      
      if (inDocker) {
        // Try all possible connection methods for Docker
        // 1. Direct IP (most reliable)
        connectionString = 'postgresql://postgres:postgres@172.18.0.2:5432/socialgenius';
        console.log('Using direct IP connection: 172.18.0.2:5432');
      } else {
        // Outside Docker container - use host to container communication
        connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5435/socialgenius';
        console.log('Using host machine connection: localhost:5435');
      }
      
      // Always log which connection we're using
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
      // Create a minimal pool to prevent application crashes
      const fallbackConnection = 'postgresql://postgres:postgres@172.18.0.2:5432/postgres';
      
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
  
  // Test database connection
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
          return true;
        } else {
          console.error('Connected to PostgreSQL database but query returned unexpected result');
          if (attempt === maxRetries) return false;
        }
      } catch (error) {
        console.error(`Failed to connect to PostgreSQL database (attempt ${attempt}/${maxRetries}):`, error);
        
        if (attempt === maxRetries) {
          // On final attempt, try different connection strings
          try {
            console.log('Final attempt: Trying different connection strings...');
            
            // Close the existing pool
            await this.pool.end().catch(e => console.log('Error closing pool:', e));
            
            // Try different connections
            const connectionOptions = [
              'postgresql://postgres:postgres@172.18.0.2:5432/socialgenius',
              'postgresql://postgres:postgres@172.18.0.2:5432/postgres',
              'postgresql://postgres:postgres@postgres:5432/socialgenius',
              'postgresql://postgres:postgres@host.docker.internal:5435/socialgenius'
            ];
            
            for (const connectionString of connectionOptions) {
              console.log(`Trying connection string: ${connectionString.split('@')[0]}@***@${connectionString.split('@')[1]}`);
              
              this.pool = new Pool({
                connectionString,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
                connectionTimeoutMillis: 8000,
                idleTimeoutMillis: 30000,
                max: 20,
                native: false
              });
              
              try {
                const testClient = await this.pool.connect();
                await testClient.query('SELECT 1 as connection_test');
                testClient.release();
                console.log('✅ Successfully reconnected to PostgreSQL database with alternative connection string');
                return true;
              } catch (reconnectError) {
                console.log(`Failed to connect with ${connectionString.split('@')[0]}@***: ${reconnectError instanceof Error ? reconnectError.message : String(reconnectError)}`);
                await this.pool.end().catch(() => {});
              }
            }
            
            console.error('❌ All connection attempts failed');
            return false;
          } catch (retryError) {
            console.error('Error during reconnection attempts:', retryError);
            return false;
          }
        }
        
        // If not the final attempt, wait before retrying
        if (attempt < maxRetries) {
          console.log(`Waiting ${attempt * 2}s before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        }
      } finally {
        if (client) client.release();
      }
    }
    
    return false;
  }

  public static getInstance(): PostgresService {
    if (!PostgresService.instance) {
      PostgresService.instance = new PostgresService();
    }
    return PostgresService.instance;
  }
  
  // The rest of the class remains the same
  // Reuse your existing methods
  
  // Get a client connection from the pool with timeout protection
  public async getClient() {
    // Add timeout to avoid hanging forever on connection issues
    const clientPromise = this.pool.connect();
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Database connection timeout after 5000ms'));
      }, 5000);
    });
    
    try {
      // Race the connection against a timeout
      return await Promise.race([clientPromise, timeoutPromise]) as any;
    } catch (error) {
      console.error('Error getting database client:', error);
      throw error;
    }
  }
  
  // Optimized query execution with pooling
  public async execute(text: string, params: any[] = []) {
    // Use pool directly for simple queries (no need for client checkout)
    try {
      const start = Date.now();
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      // Only log slow queries to reduce console noise
      if (duration > 100) {
        console.log('Slow query', { 
          text: text.substring(0, 50) + (text.length > 50 ? '...' : ''), 
          duration, 
          rows: res.rowCount 
        });
      }
      return res;
    } catch (error) {
      console.error('Error executing query:', error);
      throw error;
    }
  }

  // Get connection pool for direct access
  public getPool(): Pool {
    return this.pool;
  }
  
  // Initialize the database with necessary tables and extensions
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
          password_hash TEXT NOT NULL,
          name TEXT,
          profile_picture TEXT,
          phone_number TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP WITH TIME ZONE
        )
      `);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id SERIAL PRIMARY KEY,
          session_id TEXT UNIQUE NOT NULL,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Commit transaction
      await client.query('COMMIT');
      console.log('Tables created successfully!');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error initializing database:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Get user by email
  public async getUserByEmail(email: string): Promise<any | null> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT id, email, password_hash, name, profile_picture, phone_number, created_at, last_login
        FROM users 
        WHERE email = $1
      `;
      
      const result = await client.query(query, [email.toLowerCase()]);
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get user by ID
  public async getUserById(userId: number): Promise<any | null> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT id, email, name, profile_picture, phone_number, created_at, last_login
        FROM users 
        WHERE id = $1
      `;
      
      const result = await client.query(query, [userId]);
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Update user profile
  public async updateUserProfile(userId: number, updates: { name?: string, email?: string, profilePicture?: string, phoneNumber?: string }): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      // Build the update query dynamically based on provided fields
      const updateFields = [];
      const values = [userId]; // userId will be $1
      let paramIndex = 2; // Start parameter indexing from $2
      
      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex}`);
        values.push(updates.name);
        paramIndex++;
      }
      
      if (updates.email !== undefined) {
        updateFields.push(`email = $${paramIndex}`);
        values.push(updates.email.toLowerCase());
        paramIndex++;
      }
      
      if (updates.profilePicture !== undefined) {
        updateFields.push(`profile_picture = $${paramIndex}`);
        values.push(updates.profilePicture);
        paramIndex++;
      }
      
      if (updates.phoneNumber !== undefined) {
        updateFields.push(`phone_number = $${paramIndex}`);
        values.push(updates.phoneNumber);
        paramIndex++;
      }
      
      // If no fields to update, return early
      if (updateFields.length === 0) {
        return false;
      }
      
      // Build and execute the query
      const query = `
        UPDATE users
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING id
      `;
      
      const result = await client.query(query, values);
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Create a session
  public async createSession(userId: number, sessionId: string, expiresAt: Date): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO sessions(user_id, session_id, expires_at) 
         VALUES($1, $2, $3) 
         RETURNING id`,
        [userId, sessionId, expiresAt]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get session by ID
  public async getSessionById(sessionId: string): Promise<any | null> {
    const client = await this.pool.connect();
    try {
      console.log(`Looking up session with ID: ${sessionId.substring(0, 8)}...`);
      
      // Check session existence and expiration
      const sessionCheck = await client.query(
        `SELECT s.id, s.user_id, s.expires_at, u.email, u.name, u.profile_picture, u.phone_number
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.session_id = $1`,
        [sessionId]
      );
      
      if (sessionCheck.rows.length === 0) {
        console.log(`Session ID ${sessionId.substring(0, 8)}... not found`);
        return null;
      }
      
      // Check expiration
      const session = sessionCheck.rows[0];
      const now = new Date();
      const expiresAt = new Date(session.expires_at);
      
      if (expiresAt < now) {
        console.log(`Session ID ${sessionId.substring(0, 8)}... has expired`);
        return null;
      }
      
      console.log(`Found valid session for user ID ${session.user_id}`);
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Update last login timestamp
  public async updateLastLogin(userId: number): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `UPDATE users 
         SET last_login = CURRENT_TIMESTAMP 
         WHERE id = $1
         RETURNING id`,
        [userId]
      );
      
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error('Error updating last login:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Register a new user
  public async registerUser(email: string, passwordHash: string, name?: string): Promise<number> {
    const client = await this.pool.connect();
    try {
      console.log('Database registerUser called with:', { email, hasHash: !!passwordHash, name });
      
      // Initialize database if needed
      try {
        await this.initialize();
        console.log('Database initialized for user registration');
      } catch (initError) {
        console.error('Error initializing database in registerUser:', initError);
      }
      
      // Insert the user
      console.log('Inserting user into database...');
      const result = await client.query(
        `INSERT INTO users(email, password_hash, name) 
         VALUES($1, $2, $3) 
         RETURNING id`,
        [email.toLowerCase(), passwordHash, name || null]
      );
      
      console.log('User inserted successfully with ID:', result.rows[0].id);
      return result.rows[0].id;
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete session
  public async deleteSession(sessionId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `DELETE FROM sessions 
         WHERE session_id = $1
         RETURNING id`,
        [sessionId]
      );
      
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Clean up expired sessions
  public async cleanupExpiredSessions(): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `DELETE FROM sessions 
         WHERE expires_at < CURRENT_TIMESTAMP
         RETURNING id`
      );
      
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  // Get businesses for user
  public async getBusinessesForUser(userId: number): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT id, business_id, name, status, description, industry, website, logo_url, created_at, updated_at
        FROM businesses
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;
      
      const result = await client.query(query, [userId]);
      
      // Convert database rows to business objects with camelCase keys
      return result.rows.map(row => ({
        id: row.id,
        businessId: row.business_id,
        name: row.name,
        status: row.status,
        description: row.description || '',
        industry: row.industry || '',
        website: row.website || '',
        logoUrl: row.logo_url || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('Error getting businesses for user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Add business for user
  public async addBusinessForUser(userId: number, businessName: string): Promise<string> {
    const client = await this.pool.connect();
    try {
      // Generate a unique business ID
      const businessId = `biz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
      const query = `
        INSERT INTO businesses(business_id, name, user_id, status)
        VALUES($1, $2, $3, $4)
        RETURNING business_id
      `;
      
      const result = await client.query(query, [businessId, businessName, userId, 'pending']);
      
      if (result.rows.length === 0) {
        throw new Error('Failed to create business');
      }
      
      return result.rows[0].business_id;
    } catch (error) {
      console.error('Error adding business for user:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export default PostgresService;
