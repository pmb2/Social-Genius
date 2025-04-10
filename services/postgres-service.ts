// Import pg with safety for browser environment
let Pool: any;
let Client: any;
let types: any;

// Set this early to prevent native module loading attempts
if (typeof process !== 'undefined') {
  process.env.NODE_PG_FORCE_NATIVE = '0';
}

// Create more comprehensive mock implementation for use in browser or when pg fails to load
class MockPool {
  Client: any;  // Store Client constructor on the mock pool
  
  constructor(options?: any) {
    this.Client = MockClient;  // Ensure Client is available
  }
  
  query() { return Promise.resolve({ rows: [] }); }
  connect() { return Promise.resolve({ release: () => {}, query: () => Promise.resolve({ rows: [] }) }); }
  end() { return Promise.resolve(); }
  on() { return this; }
  
  // Implement newClient method to avoid 'this.Client is not a constructor' error
  newClient() {
    return new MockClient();
  }
}

class MockClient {
  options: any;
  
  constructor(options?: any) {
    this.options = options || {};
  }
  
  query() { return Promise.resolve({ rows: [] }); }
  connect() { return Promise.resolve(this); }
  end() { return Promise.resolve(); }
  release() {}
  on() { return this; }
}

// Try to load direct client implementation if available
let DirectClient: any;
try {
  if (typeof window === 'undefined') {
    // Try to load our direct client implementation
    DirectClient = require('../pg-direct-client').Client;
    console.log('Loaded direct PG client implementation');
  }
} catch (e) {
  console.log('Direct PG client not available, will use fallbacks');
  DirectClient = MockClient;
}

// Only import pg in a non-browser environment
if (typeof window === 'undefined') {
  try {
    // Apply runtime patching to ensure pg module behaves correctly
    try {
      require('../pg-runtime-patch.cjs')();
    } catch (patchError) {
      console.warn('Runtime pg patching failed:', patchError);
    }
    
    // Force disable pg-native to prevent issues
    process.env.NODE_PG_FORCE_NATIVE = '0';
    
    // Use a direct require approach with constructor safety
    const pg = require('pg');
    
    // Safely create a Pool constructor that works with or without 'new'
    let SafePool;
    if (pg.Pool) {
      const OriginalPool = pg.Pool;
      SafePool = function SafePool(options) {
        if (!(this instanceof SafePool)) {
          return new (OriginalPool as any)(options);
        }
        try {
          return new (OriginalPool as any)(options);
        } catch (e) {
          console.error('Pool constructor error:', e);
          // Return minimal working mock
          return new MockPool();
        }
      };
      
      // Copy properties and prototype
      Object.setPrototypeOf(SafePool.prototype, OriginalPool.prototype);
      Object.setPrototypeOf(SafePool, OriginalPool);
    } else {
      SafePool = MockPool;
    }
    
    Pool = SafePool as any;
    Client = pg.Client || DirectClient || MockClient;
    types = pg.types;
    
    // Always ensure Client is properly defined
    if (!Client) {
      console.log('pg.Client not available, using direct implementation');
      Client = DirectClient || MockClient;
    }
    
    // Store the Client class on Pool.prototype to fix 'this.Client is not a constructor' error
    if (Pool && Pool.prototype) {
      Pool.prototype.Client = Client;
      console.log('Set Pool.prototype.Client');
    }
    
    // Also ensure Pool has Client directly
    if (Pool) {
      Pool.Client = Client;
      console.log('Set Pool.Client directly');
    }
    
    // Patch Pool.prototype.newClient to always use our Client
    if (Pool && Pool.prototype && Pool.prototype.newClient) {
      const originalNewClient = Pool.prototype.newClient;
      Pool.prototype.newClient = function patchedNewClient() {
        if (!this.Client) {
          console.log('Fixing missing this.Client in Pool.newClient');
          this.Client = Client;
        }
        
        try {
          return new this.Client(this.options);
        } catch (error) {
          console.error('Error creating client in newClient:', error);
          // Use direct client as a fallback
          return new (DirectClient || MockClient)(this.options);
        }
      };
      console.log('Patched Pool.prototype.newClient');
    }
    
    // Disable the automatic conversion of timestamp columns to JavaScript Date objects for better performance
    if (types) {
      types.setTypeParser(1114, (str: string) => str); // timestamp without timezone
      types.setTypeParser(1082, (str: string) => str); // date
    }
    
    console.log('PostgreSQL modules loaded successfully');
  } catch (e) {
    console.error('Failed to load pg module:', e);
    // Use mock implementations if module fails to load
    Pool = MockPool;
    Client = DirectClient || MockClient;
    types = { setTypeParser: () => {} };
  }
} else {
  // Browser environment - use mock implementation
  Pool = MockPool;
  Client = MockClient;
  types = { setTypeParser: () => {} };
}
import { OpenAIEmbeddings } from '@langchain/openai';

// Singleton pattern for database connection
class PostgresService {
  private static instance: PostgresService;
  private pool: Pool;
  private embeddings: OpenAIEmbeddings;

  private constructor() {
    try {
      // Skip DB connections during build time if the environment variable is set
      if (process.env.SKIP_DB_CONNECTION_DURING_BUILD === 'true') {
        console.log('Skipping database connection during build');
        // Create a minimal mock pool for build time
        this.pool = {
          query: () => Promise.resolve({ rows: [] }),
          connect: () => Promise.resolve({ release: () => {}, query: () => Promise.resolve({ rows: [] }) }),
          end: () => Promise.resolve(),
          Client: Client, // Ensure Client is available on the mock pool
        } as unknown as Pool;
        return;
      }
      
      // Log minimal information for performance
      const hasDbUrl = Boolean(process.env.DATABASE_URL);
      const hasDockerDbUrl = Boolean(process.env.DATABASE_URL_DOCKER);
      console.log(`DB Config - Database URL: ${hasDbUrl ? 'Set' : 'Not set'}, Docker URL: ${hasDockerDbUrl ? 'Set' : 'Not set'}`);
      
      // Determine the connection string based on environment
      let connectionString;
      
      // Check if we're running inside Docker or not
      const inDocker = process.env.RUNNING_IN_DOCKER === 'true';
      
      if (inDocker) {
        // Inside Docker container - use container-to-container communication
        connectionString = process.env.DATABASE_URL_DOCKER || 'postgresql://postgres:postgres@postgres:5432/socialgenius';
      } else {
        // Outside Docker container - use host to container communication
        connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5435/socialgenius';
        console.log('Using host machine connection');
      }
      
      // Always log which connection we're using
      console.log(`PostgresService: Connecting to database with connection string: ${connectionString.split('@')[0]}@***`);
      
      // Create a pool with constructor safety
      try {
        // Try with 'new' first
        this.pool = new Pool({
          connectionString,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
          // Connection pool settings optimized for performance
          max: 10, // Reduced maximum pool size for better resource management
          min: 2,  // Keep at least 2 connections ready
          connectionTimeoutMillis: 5000,
          idleTimeoutMillis: 60000, // Increased idle timeout to reduce reconnection overhead
          // Disable native bindings for better compatibility
          native: false,
          // Connection reuse settings
          keepAlive: true,
          // Ensure Client is available
          Client: Client
        });
      } catch (poolError) {
        console.error('Error creating pool with new:', poolError);
        
        // Try without 'new'
        try {
          this.pool = Pool({
            connectionString,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
            max: 10,
            connectionTimeoutMillis: 5000,
            native: false,
            Client: Client
          });
        } catch (fallbackError) {
          console.error('Error creating pool without new:', fallbackError);
          
          // Last resort: use mock
          this.pool = {
            query: () => Promise.resolve({ rows: [] }),
            connect: () => Promise.resolve({ release: () => {}, query: () => Promise.resolve({ rows: [] }) }),
            end: () => Promise.resolve(),
            Client: Client
          } as Pool;
        }
      }
      
      // Make sure Client is available
      if (Pool && Pool.prototype && !this.pool.Client) {
        this.pool.Client = Client;
      }
      
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
      const fallbackConnection = process.env.RUNNING_IN_DOCKER === 'true' 
        ? 'postgresql://postgres:postgres@postgres:5432/postgres'
        : 'postgresql://postgres:postgres@localhost:5435/postgres';
        
      console.log(`Using fallback connection: ${fallbackConnection.split('@')[0]}@***`);
      
      // Create fallback pool with constructor safety
      try {
        // Try with 'new' first
        this.pool = new Pool({
          connectionString: fallbackConnection,
          connectionTimeoutMillis: 8000,
          // Disable native bindings for better compatibility
          native: false,
          max: 5, // Limit connections in fallback mode
          // Ensure Client is available
          Client: Client
        });
      } catch (poolError) {
        console.error('Error creating fallback pool with new:', poolError);
        
        // Try without 'new'
        try {
          this.pool = Pool({
            connectionString: fallbackConnection,
            connectionTimeoutMillis: 8000,
            native: false,
            max: 5,
            Client: Client
          });
        } catch (fallbackError) {
          console.error('Error creating fallback pool without new:', fallbackError);
          
          // Last resort: use mock
          this.pool = {
            query: () => Promise.resolve({ rows: [] }),
            connect: () => Promise.resolve({ release: () => {}, query: () => Promise.resolve({ rows: [] }) }),
            end: () => Promise.resolve(),
            Client: Client
          } as Pool;
        }
      }
      
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
            
            // Try different connections based on environment
            const inDocker = process.env.RUNNING_IN_DOCKER === 'true';
            
            const connectionOptions = inDocker 
              ? [
                  // Docker container connection options
                  'postgresql://postgres:postgres@postgres:5432/socialgenius',
                  'postgresql://postgres:postgres@postgres:5432/postgres',
                  'postgresql://postgres:postgres@postgres:5432/template1'
                ]
              : [
                  // Host machine connection options
                  'postgresql://postgres:postgres@localhost:5435/socialgenius',
                  'postgresql://postgres:postgres@127.0.0.1:5435/socialgenius',
                  'postgresql://postgres:postgres@localhost:5435/postgres',
                  'postgresql://postgres:postgres@127.0.0.1:5435/postgres'
                ];
            
            for (const connectionString of connectionOptions) {
              console.log(`Trying connection string: ${connectionString.split('@')[0]}@***`);
              
              this.pool = new Pool({
                connectionString,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
                connectionTimeoutMillis: 8000,
                idleTimeoutMillis: 30000,
                max: 20
              });
              
              // Make sure Client is available
              if (Pool && Pool.prototype && !this.pool.Client) {
                this.pool.Client = Client;
              }
              
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
      
      // Create business_credentials table to store service credentials
      await client.query(`
        CREATE TABLE IF NOT EXISTS business_credentials (
          id SERIAL PRIMARY KEY,
          business_id TEXT NOT NULL,
          service_name TEXT NOT NULL,
          username TEXT NOT NULL,
          encrypted_password TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          last_used TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB,
          UNIQUE (business_id, service_name),
          CONSTRAINT fk_business FOREIGN KEY (business_id) REFERENCES businesses(business_id) ON DELETE CASCADE
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
      
      // Create index on business_credentials for faster lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS credentials_business_service_idx 
        ON business_credentials(business_id, service_name)
      `);
      
      // Only log in development with debug flag enabled
      if (process.env.NODE_ENV === 'development' && process.env.DEBUG_DATABASE === 'true') {
        const timestamp = new Date().toISOString().split('T')[1].substring(0, 8);
        console.log(`[DB ${timestamp}] Database initialized successfully`);
      }
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
      
      // Make sure Client is available
      if (Pool && Pool.prototype && !this.pool.Client) {
        this.pool.Client = Client;
      }
      
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
      // Use a more dynamic approach to handle column existence
      // Get all available columns from the users table
      const columnsQuery = await client.query(
        `SELECT column_name
         FROM information_schema.columns 
         WHERE table_schema = 'public' 
         AND table_name = 'users'`
      );
      
      // Extract column names
      const columns = columnsQuery.rows.map(row => row.column_name);
      
      // Build the SELECT statement with available columns
      // Always include essential columns
      const essentialColumns = ['id', 'email', 'password_hash', 'name', 'created_at', 'last_login'];
      
      // Add optional columns if they exist
      if (columns.includes('profile_picture')) essentialColumns.push('profile_picture');
      if (columns.includes('phone_number')) essentialColumns.push('phone_number');
      
      // Build the query with the confirmed columns
      const query = `
        SELECT ${essentialColumns.join(', ')}
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
      // Use same dynamic approach as getUserByEmail for consistency
      // Get all available columns from the users table
      const columnsQuery = await client.query(
        `SELECT column_name
         FROM information_schema.columns 
         WHERE table_schema = 'public' 
         AND table_name = 'users'`
      );
      
      // Extract column names
      const columns = columnsQuery.rows.map(row => row.column_name);
      
      // Build the SELECT statement with available columns
      // Always include essential columns
      const essentialColumns = ['id', 'email', 'name', 'created_at', 'last_login'];
      
      // Add optional columns if they exist
      if (columns.includes('profile_picture')) essentialColumns.push('profile_picture');
      if (columns.includes('phone_number')) essentialColumns.push('phone_number');
      
      // Build the query with the confirmed columns
      const query = `
        SELECT ${essentialColumns.join(', ')}
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
  
  // Update user profile
  public async updateUserProfile(userId: number, updates: { name?: string, email?: string, profilePicture?: string, phoneNumber?: string }): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      // Build update fields
      const updateFields = [];
      const values = [userId];
      let paramIndex = 2;
      
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
      
      // Check if we need to add profile_picture column
      const profilePictureExists = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'profile_picture'
        )`
      );
      
      if (!profilePictureExists.rows[0].exists) {
        // Add profile_picture column if it doesn't exist
        await client.query(
          `ALTER TABLE users ADD COLUMN profile_picture TEXT`
        );
      }
      
      // Check if we need to add phone_number column
      const phoneNumberExists = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'phone_number'
        )`
      );
      
      if (!phoneNumberExists.rows[0].exists) {
        // Add phone_number column if it doesn't exist
        await client.query(
          `ALTER TABLE users ADD COLUMN phone_number TEXT`
        );
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
      
      if (updateFields.length === 0) {
        return false;
      }
      
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

  // Get session by ID with improved error handling for browser environment
  public async getSessionById(sessionId: string): Promise<any | null> {
    // Early return for browser environment
    if (typeof window !== 'undefined' || process.env.SKIP_DB_CONNECTION_DURING_BUILD === 'true') {
      console.log('In browser or build environment - returning mock session null');
      return null;
    }
    
    let client;
    try {
      client = await this.pool.connect();
      console.log(`Looking up session with ID: ${sessionId.substring(0, 8)}...`);
      
      // First, check if the sessions table exists
      const tablesCheck = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'sessions'
        )`
      );
      
      if (!tablesCheck.rows[0].exists) {
        console.log('Sessions table does not exist yet');
        return null;
      }
      
      // Check if the session exists at all
      const sessionExists = await client.query(
        `SELECT EXISTS (
          SELECT 1 FROM sessions WHERE session_id = $1
        )`,
        [sessionId]
      );
      
      if (!sessionExists.rows[0].exists) {
        console.log(`Session ID ${sessionId.substring(0, 8)}... does not exist`);
        return null;
      }
      
      // Now check if it's expired
      const expiredCheck = await client.query(
        `SELECT expires_at < CURRENT_TIMESTAMP as is_expired 
         FROM sessions 
         WHERE session_id = $1`,
        [sessionId]
      );
      
      if (expiredCheck.rows.length > 0 && expiredCheck.rows[0].is_expired) {
        console.log(`Session ID ${sessionId.substring(0, 8)}... has expired`);
        return null;
      }
      
      // First check if profile_picture column exists
      const profilePictureExists = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'profile_picture'
        )`
      );
      
      // Check if phone_number column exists
      const phoneNumberExists = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'phone_number'
        )`
      );
      
      let query;
      // Build query based on which columns exist
      if (profilePictureExists.rows[0].exists && phoneNumberExists.rows[0].exists) {
        query = `
          SELECT s.id, s.user_id, s.expires_at, u.email, u.name, u.profile_picture, u.phone_number
          FROM sessions s
          JOIN users u ON s.user_id = u.id
          WHERE s.session_id = $1 AND s.expires_at > CURRENT_TIMESTAMP
        `;
      } else if (profilePictureExists.rows[0].exists) {
        query = `
          SELECT s.id, s.user_id, s.expires_at, u.email, u.name, u.profile_picture
          FROM sessions s
          JOIN users u ON s.user_id = u.id
          WHERE s.session_id = $1 AND s.expires_at > CURRENT_TIMESTAMP
        `;
      } else if (phoneNumberExists.rows[0].exists) {
        query = `
          SELECT s.id, s.user_id, s.expires_at, u.email, u.name, u.phone_number
          FROM sessions s
          JOIN users u ON s.user_id = u.id
          WHERE s.session_id = $1 AND s.expires_at > CURRENT_TIMESTAMP
        `;
      } else {
        // Fall back to just the basic columns if neither exists
        query = `
          SELECT s.id, s.user_id, s.expires_at, u.email, u.name
          FROM sessions s
          JOIN users u ON s.user_id = u.id
          WHERE s.session_id = $1 AND s.expires_at > CURRENT_TIMESTAMP
        `;
      }
      
      const result = await client.query(query, [sessionId]);
      
      if (result.rows.length === 0) {
        console.log(`Session ID ${sessionId.substring(0, 8)}... exists but user not found or session expired`);
      } else {
        console.log(`Found valid session for user ID ${result.rows[0].user_id}`);
      }
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null; // Return null instead of throwing to prevent browser errors
    } finally {
      if (client) client.release();
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
      console.log(`PostgresService: Adding business "${businessName}" for user ID: ${userId} (${typeof userId})`);
      
      // Ensure userId is a number
      if (typeof userId !== 'number') {
        userId = Number(userId);
        console.log(`Converting userId to number: ${userId} (${typeof userId})`);
      }
      
      // First, check if businesses table exists
      const tableCheckResult = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'businesses'
        )`
      );
      
      if (!tableCheckResult.rows[0].exists) {
        console.error('Businesses table does not exist - attempting to initialize database');
        await this.initialize();
      }
      
      // Now validate that the user exists
      const userCheckResult = await client.query(
        `SELECT id FROM users WHERE id = $1`,
        [userId]
      );
      
      if (userCheckResult.rowCount === 0) {
        console.error(`User ID ${userId} not found when adding business`);
        throw new Error('User not found');
      }
      
      // Generate a unique business ID
      const businessId = `biz_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      // Begin transaction for atomicity
      await client.query('BEGIN');
      
      // Insert the business with proper user association
      const result = await client.query(
        `INSERT INTO businesses(business_id, name, user_id, status) 
         VALUES($1, $2, $3, $4) 
         RETURNING business_id, id`,
        [businessId, businessName, userId, status]
      );
      
      if (!result.rows[0]) {
        throw new Error('Failed to insert business record');
      }
      
      const dbBusinessId = result.rows[0].id;
      const returnedBusinessId = result.rows[0].business_id;
      
      console.log(`Successfully added business: ID=${dbBusinessId}, business_id=${returnedBusinessId}, name="${businessName}", for user_id=${userId}`);
      
      // Create initial compliance records if needed
      try {
        // Check if business_compliance table exists and create a starter record
        const tableExists = await client.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'business_compliance'
          )`
        );
        
        if (tableExists.rows[0].exists) {
          await client.query(
            `INSERT INTO business_compliance(business_id, compliance_status, last_checked) 
             VALUES($1, $2, CURRENT_TIMESTAMP)`,
            [dbBusinessId, 'pending']
          );
          console.log(`Created initial compliance record for business ID ${dbBusinessId}`);
        }
      } catch (complianceError) {
        // Log but don't fail the transaction
        console.warn(`Error creating compliance record: ${complianceError.message}`);
      }
      
      // Commit transaction
      await client.query('COMMIT');
      
      return returnedBusinessId;
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK').catch(e => console.error('Rollback error:', e));
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
      // First, check if auth_status and browser_instance columns exist
      const authStatusExists = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'businesses' 
          AND column_name = 'auth_status'
        )`
      );
      
      const browserInstanceExists = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'businesses' 
          AND column_name = 'browser_instance'
        )`
      );
      
      // If columns don't exist, add them
      if (!authStatusExists.rows[0].exists) {
        console.log('Adding auth_status column to businesses table');
        await client.query('ALTER TABLE businesses ADD COLUMN auth_status TEXT DEFAULT NULL');
      }
      
      if (!browserInstanceExists.rows[0].exists) {
        console.log('Adding browser_instance column to businesses table');
        await client.query('ALTER TABLE businesses ADD COLUMN browser_instance TEXT DEFAULT NULL');
      }
      
      // Now query for businesses with the new columns
      const result = await client.query(
        `SELECT id, business_id, name, status, created_at, auth_status, browser_instance
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
        createdAt: row.created_at,
        authStatus: row.auth_status,
        browserInstance: row.browser_instance
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
  
  // Store business credentials
  public async storeBusinessCredentials(
    businessId: string, 
    serviceName: string, 
    username: string, 
    password: string,
    metadata: any = {}
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      console.log(`Storing credentials for business ${businessId}, service: ${serviceName}`);
      
      // Simple encryption for passwords - in production, use a proper encryption method
      // This is just a basic XOR encryption for demonstration
      const encryptionKey = process.env.ENCRYPTION_KEY || 'social-genius-secure-key';
      const encryptedPassword = this.encryptPassword(password, encryptionKey);
      
      // First check if credentials already exist for this business+service
      const existingCheck = await client.query(
        `SELECT id FROM business_credentials 
         WHERE business_id = $1 AND service_name = $2`,
        [businessId, serviceName]
      );
      
      let result;
      
      if (existingCheck.rowCount > 0) {
        // Update existing credentials
        console.log(`Updating existing credentials for business ${businessId}, service: ${serviceName}`);
        result = await client.query(
          `UPDATE business_credentials
           SET username = $1, 
               encrypted_password = $2,
               status = 'active',
               last_updated = CURRENT_TIMESTAMP,
               metadata = $3
           WHERE business_id = $4 AND service_name = $5
           RETURNING id`,
          [username, encryptedPassword, metadata || {}, businessId, serviceName]
        );
      } else {
        // Insert new credentials
        console.log(`Creating new credentials for business ${businessId}, service: ${serviceName}`);
        result = await client.query(
          `INSERT INTO business_credentials(business_id, service_name, username, encrypted_password, metadata) 
           VALUES($1, $2, $3, $4, $5) 
           RETURNING id`,
          [businessId, serviceName, username, encryptedPassword, metadata || {}]
        );
      }
      
      const success = result.rowCount > 0;
      console.log(`Credentials ${success ? 'stored successfully' : 'storage failed'} for business ${businessId}`);
      return success;
    } catch (error) {
      console.error(`Error storing credentials for business ${businessId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Get business auth data (for cookies and authentication)
  public async getBusinessAuth(businessId: string, serviceType: string): Promise<any> {
    const client = await this.pool.connect();
    try {
      console.log(`Getting auth data for business ${businessId}, service: ${serviceType}`);
      
      // Check if the table exists
      const tableExists = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'business_auth'
        )`
      );
      
      if (!tableExists.rows[0].exists) {
        console.log('Creating business_auth table...');
        await client.query(`
          CREATE TABLE IF NOT EXISTS business_auth (
            id SERIAL PRIMARY KEY,
            business_id TEXT NOT NULL,
            service_type TEXT NOT NULL,
            cookies TEXT,
            last_updated TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(business_id, service_type)
          )
        `);
        return null;
      }
      
      // Query for auth data
      const result = await client.query(
        `SELECT id, business_id, service_type, cookies, last_updated
         FROM business_auth 
         WHERE business_id = $1 AND service_type = $2
         LIMIT 1`,
        [businessId, serviceType]
      );
      
      if (result.rowCount === 0) {
        console.log(`No auth data found for business ${businessId}, service: ${serviceType}`);
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      console.error(`Error getting auth data for business ${businessId}, service: ${serviceType}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Update business auth data (cookies, tokens, etc.)
  public async updateBusinessAuth(businessId: string, serviceType: string, data: any): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      console.log(`Updating auth data for business ${businessId}, service: ${serviceType}`);
      
      // Create table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS business_auth (
          id SERIAL PRIMARY KEY,
          business_id TEXT NOT NULL,
          service_type TEXT NOT NULL,
          cookies TEXT,
          last_updated TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(business_id, service_type)
        )
      `);
      
      // Upsert auth data
      const result = await client.query(
        `INSERT INTO business_auth (business_id, service_type, cookies, last_updated)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (business_id, service_type) 
         DO UPDATE SET 
           cookies = EXCLUDED.cookies,
           last_updated = EXCLUDED.last_updated
         RETURNING id`,
        [
          businessId, 
          serviceType, 
          data.cookies, 
          data.lastUpdated || new Date().toISOString()
        ]
      );
      
      return result.rowCount > 0;
    } catch (error) {
      console.error(`Error updating auth data for business ${businessId}, service: ${serviceType}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Get business credentials
  public async getBusinessCredentials(
    businessId: string, 
    serviceName: string
  ): Promise<{username: string, password: string, status: string, lastUsed: Date} | null> {
    const client = await this.pool.connect();
    try {
      console.log(`Retrieving credentials for business ${businessId}, service: ${serviceName}`);
      
      const result = await client.query(
        `SELECT username, encrypted_password, status, last_used 
         FROM business_credentials 
         WHERE business_id = $1 AND service_name = $2`,
        [businessId, serviceName]
      );
      
      if (result.rowCount === 0) {
        console.log(`No credentials found for business ${businessId}, service: ${serviceName}`);
        return null;
      }
      
      // Decrypt password
      const encryptionKey = process.env.ENCRYPTION_KEY || 'social-genius-secure-key';
      const decryptedPassword = this.decryptPassword(result.rows[0].encrypted_password, encryptionKey);
      
      // Update last_used timestamp
      await client.query(
        `UPDATE business_credentials
         SET last_used = CURRENT_TIMESTAMP
         WHERE business_id = $1 AND service_name = $2`,
        [businessId, serviceName]
      );
      
      console.log(`Retrieved credentials for business ${businessId}, service: ${serviceName}`);
      
      return {
        username: result.rows[0].username,
        password: decryptedPassword,
        status: result.rows[0].status,
        lastUsed: result.rows[0].last_used
      };
    } catch (error) {
      console.error(`Error retrieving credentials for business ${businessId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Check if business has stored credentials for a service
  public async hasCredentials(businessId: string, serviceName: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT COUNT(*) as count
         FROM business_credentials 
         WHERE business_id = $1 AND service_name = $2 AND status = 'active'`,
        [businessId, serviceName]
      );
      
      return result.rows[0].count > 0;
    } catch (error) {
      console.error(`Error checking credentials for business ${businessId}:`, error);
      return false;
    } finally {
      client.release();
    }
  }
  
  // Update credential status
  public async updateCredentialStatus(
    businessId: string, 
    serviceName: string, 
    status: string
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `UPDATE business_credentials
         SET status = $1, last_updated = CURRENT_TIMESTAMP
         WHERE business_id = $2 AND service_name = $3
         RETURNING id`,
        [status, businessId, serviceName]
      );
      
      return result.rowCount > 0;
    } catch (error) {
      console.error(`Error updating credential status for business ${businessId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Simple password encryption/decryption - for demonstration only
  // In production, use a proper encryption library
  private encryptPassword(password: string, key: string): string {
    // Convert password and key to byte arrays
    const passwordBytes = Buffer.from(password);
    let keyBytes = Buffer.from(key);
    
    // If key is shorter than password, repeat it
    if (keyBytes.length < passwordBytes.length) {
      const repeats = Math.ceil(passwordBytes.length / keyBytes.length);
      keyBytes = Buffer.concat(Array(repeats).fill(keyBytes)).slice(0, passwordBytes.length);
    }
    
    // XOR password with key
    const encryptedBytes = Buffer.alloc(passwordBytes.length);
    for (let i = 0; i < passwordBytes.length; i++) {
      encryptedBytes[i] = passwordBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    // Convert to base64 for storage
    return encryptedBytes.toString('base64');
  }
  
  private decryptPassword(encrypted: string, key: string): string {
    // Convert encrypted text and key to byte arrays
    const encryptedBytes = Buffer.from(encrypted, 'base64');
    let keyBytes = Buffer.from(key);
    
    // If key is shorter than encrypted text, repeat it
    if (keyBytes.length < encryptedBytes.length) {
      const repeats = Math.ceil(encryptedBytes.length / keyBytes.length);
      keyBytes = Buffer.concat(Array(repeats).fill(keyBytes)).slice(0, encryptedBytes.length);
    }
    
    // XOR encrypted bytes with key
    const decryptedBytes = Buffer.alloc(encryptedBytes.length);
    for (let i = 0; i < encryptedBytes.length; i++) {
      decryptedBytes[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    // Convert back to string
    return decryptedBytes.toString();
  }
}

export default PostgresService;