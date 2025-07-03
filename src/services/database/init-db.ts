import '@/lib/utilities/pg-patch'; // Import pg patch to ensure pg-native is correctly handled
import PostgresService from '@/services/database/postgres-service';
import AuthService from '@/services/auth/auth-service';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { initializeGoogleOAuth, verifyGoogleOAuthTables } from './init-google-oauth';

import { globalState } from '@/lib/state';

// Detect if running in Docker environment
function detectDockerEnvironment() {
  // Check if we're likely running inside Docker based on env or filesystem
  try {
    // Set environment variable that the PostgresService will check
    const inDocker = process.env.RUNNING_IN_DOCKER === 'true' || 
                    (typeof process.env.DOCKER_CONTAINER !== 'undefined') || 
                    (typeof process.env.KUBERNETES_SERVICE_HOST !== 'undefined');
    
    if (inDocker) {
      process.env.RUNNING_IN_DOCKER = 'true';
      console.log('Detected Docker environment');
      return true;
    }
    
    // Not in Docker
    process.env.RUNNING_IN_DOCKER = 'false';
    console.log('Detected non-Docker environment');
    return false;
  } catch (error) {
    console.error('Error detecting Docker environment:', error);
    // Default to non-Docker
    process.env.RUNNING_IN_DOCKER = 'false';
    return false;
  }
}

// Apply schema from SQL file
async function applySchema(db: PostgresService, schemaName: string): Promise<boolean> {
  try {
    const schemaPath = path.join(process.cwd(), 'src', 'services', 'database', 'migrations', `${schemaName}.sql`);
    
    if (!fs.existsSync(schemaPath)) {
      console.error(`Schema file not found: ${schemaPath}`);
      return false;
    }
    
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Split the schema into individual statements
    const statements = schemaSql
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    // Execute each statement
    const client = await db.getPool().connect();
    
    try {
      // Begin transaction
      await client.query('BEGIN');
      
      for (const statement of statements) {
        await client.query(statement);
      }
      
      // Commit transaction
      await client.query('COMMIT');
      
      console.log(`Schema ${schemaName} applied successfully`);
      return true;
    } catch (error) {
      // Rollback transaction on error
      await client.query('ROLLBACK');
      console.error(`Error applying schema ${schemaName}:`, error);
      return false;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`Failed to apply schema ${schemaName}:`, error);
    return false;
  }
}

export async function initializeDatabase() {
  try {
    // Skip if already initialized
    if (globalState.dbInitialized) {
      console.log('Database already initialized, skipping');
      return true;
    }
    
    console.log('Initializing database...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 
                `Set (${process.env.DATABASE_URL.length} chars)` : 'Not set');
    
    // Detect Docker environment and set appropriate connection strings
    const inDocker = detectDockerEnvironment();
    
    if (inDocker) {
      // Inside Docker container - use container network
      if (!process.env.DATABASE_URL_DOCKER) {
        process.env.DATABASE_URL_DOCKER = 'postgresql://postgres:postgres@postgres:5432/socialgenius';
      }
      console.log('Using Docker network database connection');
    } else {
      // External to Docker - use host mapping
      if (!process.env.DATABASE_URL) {
        process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5435/socialgenius';
      }
      console.log('Using host machine database connection');
    }
    
    // Create PostgresService instance and let it handle connection details
    const dbService = PostgresService.getInstance();
    
    // Test connection with multiple attempts
    console.log('Testing database connection...');
    const isConnected = await dbService.testConnection();
    
    if (!isConnected) {
      console.error('Failed to connect to database after multiple attempts');
      return false;
    }
    
    console.log('Successfully connected to database');
    
    // Initialize tables
    console.log('Initializing database tables...');
    try {
      console.log('dbService methods available:', Object.getOwnPropertyNames(Object.getPrototypeOf(dbService)));
      console.log('dbService.initialize exists:', typeof dbService.initialize === 'function');
      await dbService.initialize();
      console.log('Database tables initialized successfully');
    } catch (error) {
      console.error('Error during database initialization:', error);
      throw error;
    }
    
    // Initialize the Google OAuth tables if they don't exist - but skip during auth flow
    // We'll only initialize these tables when explicitly requested
    try {
      const oauthTablesExist = await verifyGoogleOAuthTables();
      if (!oauthTablesExist) {
        console.log('Google OAuth tables not found, but skipping during main initialization');
        console.log('These will be initialized when needed via the init-oauth-db endpoint');
      } else {
        console.log('Google OAuth tables already exist, skipping initialization');
      }
    } catch (error) {
      console.log('Error checking Google OAuth tables, will skip initialization:', error.message);
    }
    
    // Initialize feature flags
    const featureFlagsPath = path.join(process.cwd(), 'src', 'services', 'database', 'migrations', 'feature_flags_schema.sql');
    if (fs.existsSync(featureFlagsPath)) {
      console.log('Applying feature flags schema...');
      await applySchema(dbService, 'feature_flags_schema');
    }
    
    // Initialize the Auth service
    console.log('Initializing Auth service...');
    const authService = AuthService.getInstance();
    
    // Clean up any expired sessions
    console.log('Cleaning up expired sessions...');
    const cleanedSessions = await authService.cleanupSessions();
    console.log(`Cleaned up ${cleanedSessions} expired sessions`);
    
    globalState.dbInitialized = true;
    console.log('✅ Database successfully initialized and ready');
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
}