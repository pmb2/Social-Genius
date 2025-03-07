import { Pool } from 'pg';
import { OpenAIEmbeddings } from '@langchain/openai';

// Singleton pattern for database connection
class PostgresService {
  private static instance: PostgresService;
  private pool: Pool;
  private embeddings: OpenAIEmbeddings;

  private constructor() {
    try {
      console.log('PostgresService initializing with DATABASE_URL:', 
                 process.env.DATABASE_URL ? 'Set (length: ' + process.env.DATABASE_URL.length + ')' : 'Not set');
      console.log('DATABASE_URL_DOCKER:', 
                 process.env.DATABASE_URL_DOCKER ? 'Set (length: ' + process.env.DATABASE_URL_DOCKER.length + ')' : 'Not set');
      
      // Try DATABASE_URL first, then fallback to DATABASE_URL_DOCKER
      const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_DOCKER;
      
      // Check if any connection URL is set
      if (!connectionString) {
        console.error('No database connection URL is set! Please set DATABASE_URL or DATABASE_URL_DOCKER');
        throw new Error('Database connection is not configured');
      }
      
      this.pool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
        // Add connection timeout
        connectionTimeoutMillis: 5000,
        // Add idle timeout
        idleTimeoutMillis: 30000,
        // Max clients
        max: 20
      });
      
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: "text-embedding-3-small"
      });

      // Initialize the pool
      this.pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
        // Don't exit process, just log the error
        console.error('Database pool error, but continuing operation');
      });
      
      // Test the connection immediately
      this.testConnection();
    } catch (error) {
      console.error('Error initializing PostgresService:', error);
      // Create a minimal pool to prevent application crashes
      this.pool = new Pool({
        connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres'
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
    let client;
    try {
      client = await this.pool.connect();
      
      // Try a simple query to really verify the connection
      const result = await client.query('SELECT 1 as connection_test');
      
      if (result.rows.length > 0 && result.rows[0].connection_test === 1) {
        console.log('Successfully connected to PostgreSQL database and verified query execution');
        return true;
      } else {
        console.error('Connected to PostgreSQL database but query returned unexpected result');
        return false;
      }
    } catch (error) {
      console.error('Failed to connect to PostgreSQL database:', error);
      
      // Try to recreate the pool with a different connection string
      try {
        console.log('Attempting to reconnect with alternate configuration...');
        
        // Close the existing pool
        await this.pool.end();
        
        // Try different connection options
        const connectionOptions = [
          process.env.DATABASE_URL,
          'postgresql://postgres:postgres@localhost:5435/socialgenius',
          'postgresql://postgres:postgres@localhost:5432/socialgenius',
          'postgresql://postgres:postgres@postgres:5432/socialgenius'
        ];
        
        for (const connectionString of connectionOptions) {
          if (!connectionString) continue;
          
          console.log(`Trying connection string: ${connectionString.substring(0, connectionString.indexOf('@'))}@***`);
          
          this.pool = new Pool({
            connectionString,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
            connectionTimeoutMillis: 5000,
            idleTimeoutMillis: 30000,
            max: 20
          });
          
          try {
            const testClient = await this.pool.connect();
            await testClient.query('SELECT 1 as connection_test');
            testClient.release();
            console.log('Successfully reconnected to PostgreSQL database');
            return true;
          } catch (reconnectError) {
            console.log(`Failed to connect with this connection string: ${reconnectError instanceof Error ? reconnectError.message : String(reconnectError)}`);
            await this.pool.end().catch(() => {});
          }
        }
        
        console.error('All connection attempts failed');
        return false;
      } catch (retryError) {
        console.error('Error during reconnection attempts:', retryError);
        return false;
      }
    } finally {
      if (client) client.release();
    }
  }

  public static getInstance(): PostgresService {
    if (!PostgresService.instance) {
      PostgresService.instance = new PostgresService();
    }
    return PostgresService.instance;
  }

  // Initialize the database with necessary tables and extensions
  public async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Enable pgvector extension
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      
      // Create documents table
      await client.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id SERIAL PRIMARY KEY,
          collection_name TEXT NOT NULL,
          content TEXT NOT NULL,
          metadata JSONB NOT NULL,
          embedding vector(1536),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create memories table
      await client.query(`
        CREATE TABLE IF NOT EXISTS memories (
          id SERIAL PRIMARY KEY,
          memory_id TEXT NOT NULL,
          business_id TEXT NOT NULL,
          content TEXT NOT NULL,
          memory_type TEXT NOT NULL,
          is_completed BOOLEAN,
          embedding vector(1536),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP WITH TIME ZONE
        )
      `);
      
      // Create businesses table to store business profiles
      await client.query(`
        CREATE TABLE IF NOT EXISTS businesses (
          id SERIAL PRIMARY KEY,
          business_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status TEXT DEFAULT 'noncompliant',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (business_id, user_id)
        )
      `);
      
      // Create sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id SERIAL PRIMARY KEY,
          session_id TEXT UNIQUE NOT NULL,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create index for faster vector similarity search for documents
      await client.query(`
        CREATE INDEX IF NOT EXISTS documents_embedding_idx 
        ON documents 
        USING ivfflat (embedding vector_cosine_ops) 
        WITH (lists = 100)
      `);
      
      // Create index on collection_name for faster filtering
      await client.query(`
        CREATE INDEX IF NOT EXISTS documents_collection_idx 
        ON documents(collection_name)
      `);
      
      // Create index for faster vector similarity search for memories
      await client.query(`
        CREATE INDEX IF NOT EXISTS memories_embedding_idx 
        ON memories 
        USING ivfflat (embedding vector_cosine_ops) 
        WITH (lists = 100)
      `);
      
      // Create index on memory_type and business_id for faster filtering
      await client.query(`
        CREATE INDEX IF NOT EXISTS memories_type_idx 
        ON memories(memory_type)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS memories_business_idx 
        ON memories(business_id)
      `);
      
      // Create index on user email for faster lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS users_email_idx 
        ON users(email)
      `);
      
      // Create index on business user_id for faster lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS businesses_user_id_idx 
        ON businesses(user_id)
      `);
      
      // Create index on session_id for faster lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS sessions_id_idx 
        ON sessions(session_id)
      `);
      
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Store a document with its embedding
  public async storeDocument(collection: string, content: string, metadata: any): Promise<number> {
    const client = await this.pool.connect();
    try {
      // Generate embedding
      const embeddingResult = await this.embeddings.embedQuery(content);
      
      // Insert document
      const result = await client.query(
        `INSERT INTO documents(collection_name, content, metadata, embedding) 
         VALUES($1, $2, $3, $4) 
         RETURNING id`,
        [collection, content, metadata, embeddingResult]
      );
      
      return result.rows[0].id;
    } catch (error) {
      console.error('Error storing document:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Store multiple documents in batch
  public async storeDocuments(documents: { collection: string, content: string, metadata: any }[]): Promise<number[]> {
    const client = await this.pool.connect();
    try {
      // Start a transaction
      await client.query('BEGIN');
      
      const ids: number[] = [];
      
      // Validate documents
      if (!documents || documents.length === 0) {
        console.warn('No documents provided to storeDocuments');
        return [];
      }
      
      // Log some info about the first document for debugging
      const firstDoc = documents[0];
      console.log('First document sample:', {
        collectionName: firstDoc.collection,
        contentLength: firstDoc.content?.length || 0,
        metadataKeys: firstDoc.metadata ? Object.keys(firstDoc.metadata) : [],
        totalDocuments: documents.length
      });
      
      // Process each document
      for (const doc of documents) {
        // Basic validation
        if (!doc.content || typeof doc.content !== 'string') {
          console.warn('Invalid document content, skipping:', doc);
          continue;
        }
        
        try {
          const embeddingResult = await this.embeddings.embedQuery(doc.content);
          
          const result = await client.query(
            `INSERT INTO documents(collection_name, content, metadata, embedding) 
             VALUES($1, $2, $3, $4) 
             RETURNING id`,
            [doc.collection, doc.content, doc.metadata || {}, embeddingResult]
          );
          
          ids.push(result.rows[0].id);
        } catch (docError) {
          console.error('Error processing single document:', docError);
          // Continue with other documents rather than failing the whole batch
        }
      }
      
      // Commit the transaction if we have any successful inserts
      if (ids.length > 0) {
        await client.query('COMMIT');
      } else {
        await client.query('ROLLBACK');
        throw new Error('No documents were successfully processed');
      }
      
      return ids;
    } catch (error) {
      // Rollback in case of error
      await client.query('ROLLBACK');
      console.error('Error batch storing documents:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Find similar documents
  public async findSimilar(collection: string, query: string, limit: number = 5, similarityThreshold: number = 0.7, filterIds?: number[]): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      // Generate embedding for query
      const queryEmbedding = await this.embeddings.embedQuery(query);
      
      // Create query with optional filtering
      let sqlQuery = `
        SELECT 
          id, 
          content, 
          metadata, 
          1 - (embedding <=> $1) as similarity
        FROM 
          documents
        WHERE 
          collection_name = $2
          AND 1 - (embedding <=> $1) >= $3
      `;
      
      const params = [queryEmbedding, collection, similarityThreshold];
      
      // Add optional ID filtering
      if (filterIds && filterIds.length > 0) {
        sqlQuery += ` AND id = ANY($4)`;
        params.push(filterIds);
      }
      
      // Add sorting and limit
      sqlQuery += `
        ORDER BY similarity DESC
        LIMIT $${params.length + 1}
      `;
      params.push(limit);
      
      // Execute query
      const result = await client.query(sqlQuery, params);
      
      return result.rows;
    } catch (error) {
      console.error('Error finding similar documents:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete documents
  public async deleteDocuments(collection: string, ids: number[]): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `DELETE FROM documents 
         WHERE collection_name = $1 
         AND id = ANY($2)
         RETURNING id`,
        [collection, ids]
      );
      
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error deleting documents:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get collections
  public async getCollections(): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT DISTINCT collection_name FROM documents`
      );
      
      return result.rows.map(row => row.collection_name);
    } catch (error) {
      console.error('Error getting collections:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get connection pool for direct access
  public getPool(): Pool {
    return this.pool;
  }
  
  // Reset the database connection with a new URL
  public async resetConnection(connectionString?: string): Promise<boolean> {
    try {
      // Close existing pool
      await this.pool.end();
      
      // Create new pool with provided URL or default
      this.pool = new Pool({
        connectionString: connectionString || process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        max: 20
      });
      
      // Test new connection
      return await this.testConnection();
    } catch (error) {
      console.error('Error resetting database connection:', error);
      return false;
    }
  }
  // Store a memory item with its embedding
  public async storeMemory(memory: { id: string, businessId: string, content: string, type: string, isCompleted?: boolean }): Promise<number> {
    const client = await this.pool.connect();
    try {
      // Generate embedding
      const embeddingResult = await this.embeddings.embedQuery(memory.content);
      
      // Insert memory
      const result = await client.query(
        `INSERT INTO memories(memory_id, business_id, content, memory_type, is_completed, embedding) 
         VALUES($1, $2, $3, $4, $5, $6) 
         RETURNING id`,
        [memory.id, memory.businessId, memory.content, memory.type, memory.isCompleted || null, embeddingResult]
      );
      
      return result.rows[0].id;
    } catch (error) {
      console.error('Error storing memory:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get all memories for a business
  public async getMemories(businessId: string): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT memory_id, content, memory_type, is_completed, created_at 
         FROM memories 
         WHERE business_id = $1
         ORDER BY created_at DESC`,
        [businessId]
      );
      
      return result.rows.map(row => ({
        id: row.memory_id,
        content: row.content,
        type: row.memory_type,
        isCompleted: row.is_completed,
        timestamp: row.created_at.toISOString()
      }));
    } catch (error) {
      console.error('Error getting memories:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Update a memory
  public async updateMemory(memoryId: string, businessId: string, updates: { content?: string, isCompleted?: boolean }): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      let updateFields = [];
      let params = [memoryId, businessId];
      let paramCount = 3;
      
      if (updates.content !== undefined) {
        updateFields.push(`content = $${paramCount}`);
        params.push(updates.content);
        paramCount++;
        
        // Also update the embedding if content changes
        const newEmbedding = await this.embeddings.embedQuery(updates.content);
        updateFields.push(`embedding = $${paramCount}`);
        params.push(JSON.stringify(newEmbedding));
        paramCount++;
      }
      
      if (updates.isCompleted !== undefined) {
        updateFields.push(`is_completed = $${paramCount}`);
        params.push(String(updates.isCompleted));
        paramCount++;
      }
      
      if (updateFields.length === 0) return false;
      
      const query = `
        UPDATE memories 
        SET ${updateFields.join(', ')} 
        WHERE memory_id = $1 AND business_id = $2
        RETURNING id
      `;
      
      const result = await client.query(query, params);
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error('Error updating memory:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete a memory
  public async deleteMemory(memoryId: string, businessId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `DELETE FROM memories 
         WHERE memory_id = $1 AND business_id = $2
         RETURNING id`,
        [memoryId, businessId]
      );
      
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error('Error deleting memory:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Find similar memories
  public async findSimilarMemories(query: string, businessId: string, limit: number = 5, similarityThreshold: number = 0.7): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      // Generate embedding for query
      const queryEmbedding = await this.embeddings.embedQuery(query);
      
      const sqlQuery = `
        SELECT 
          memory_id, 
          content, 
          memory_type, 
          is_completed,
          created_at,
          1 - (embedding <=> $1) as similarity
        FROM 
          memories
        WHERE 
          business_id = $2 AND
          1 - (embedding <=> $1) >= $3
        ORDER BY similarity DESC
        LIMIT $4
      `;
      
      const result = await client.query(sqlQuery, [queryEmbedding, businessId, similarityThreshold, limit]);
      
      return result.rows.map(row => ({
        id: row.memory_id,
        content: row.content,
        type: row.memory_type,
        isCompleted: row.is_completed,
        timestamp: row.created_at.toISOString(),
        similarity: row.similarity
      }));
    } catch (error) {
      console.error('Error finding similar memories:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // User Authentication Methods
  
  // Register a new user
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

  // Get user by email
  public async getUserByEmail(email: string): Promise<any | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT id, email, password_hash, name, created_at, last_login 
         FROM users 
         WHERE email = $1`,
        [email.toLowerCase()]
      );
      
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
      const result = await client.query(
        `SELECT id, email, name, created_at, last_login 
         FROM users 
         WHERE id = $1`,
        [userId]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
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

  // Create a new session
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
      const result = await client.query(
        `SELECT s.id, s.user_id, s.expires_at, u.email, u.name
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.session_id = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
        [sessionId]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting session:', error);
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

  // Add a business for a user
  public async addBusinessForUser(userId: number, businessName: string, status: string = 'noncompliant'): Promise<string> {
    const client = await this.pool.connect();
    try {
      // Generate a unique business ID
      const businessId = `biz_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      const result = await client.query(
        `INSERT INTO businesses(business_id, name, user_id, status) 
         VALUES($1, $2, $3, $4) 
         RETURNING business_id`,
        [businessId, businessName, userId, status]
      );
      
      return result.rows[0].business_id;
    } catch (error) {
      console.error('Error adding business for user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get businesses for a user
  public async getBusinessesForUser(userId: number): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT id, business_id, name, status, created_at
         FROM businesses
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );
      
      return result.rows.map(row => ({
        id: row.id,
        businessId: row.business_id,
        name: row.name,
        status: row.status,
        createdAt: row.created_at
      }));
    } catch (error) {
      console.error('Error getting businesses for user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Update business status
  public async updateBusinessStatus(businessId: string, status: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `UPDATE businesses
         SET status = $1
         WHERE business_id = $2
         RETURNING id`,
        [status, businessId]
      );
      
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error('Error updating business status:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export default PostgresService;
