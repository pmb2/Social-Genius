import PostgresService from '@/services/postgres-service';
import AuthService from '@/services/auth-service';
import { Pool } from 'pg';

// Set this to know if we've initialized
let dbInitialized = false;

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

export async function initializeDatabase() {
  try {
    // Skip if already initialized
    if (dbInitialized) {
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
    await dbService.initialize();
    console.log('Database tables initialized successfully');
    
    // Initialize the Auth service
    console.log('Initializing Auth service...');
    const authService = AuthService.getInstance();
    
    // Clean up any expired sessions
    console.log('Cleaning up expired sessions...');
    const cleanedSessions = await authService.cleanupSessions();
    console.log(`Cleaned up ${cleanedSessions} expired sessions`);
    
    dbInitialized = true;
    console.log('✅ Database successfully initialized and ready');
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
}