import PostgresService from '@/services/postgres-service';
import AuthService from '@/services/auth-service';
import { Pool } from 'pg';

// Set this to know if we've initialized
let dbInitialized = false;

// Controlled log function to reduce console spam
function dbLog(message: string, level: 'info' | 'error' | 'warn' = 'info'): void {
  const isDev = process.env.NODE_ENV === 'development';
  const debugDatabase = process.env.DEBUG_DATABASE === 'true';
  
  // Determine if we should log
  const shouldLog = level === 'error' || // Always log errors
                   (isDev && level === 'warn') || // Log warnings in dev
                   (isDev && debugDatabase && level === 'info'); // Only log info if debug flag is on
  
  if (!shouldLog) return;
  
  // Add timestamp to message
  const timestamp = new Date().toISOString().split('T')[1].substring(0, 8);
  const prefix = `[DB ${timestamp}]`;
  
  if (level === 'error') {
    console.error(`${prefix} ${message}`);
  } else if (level === 'warn') {
    console.warn(`${prefix} ${message}`);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

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
      dbLog('Detected Docker environment', 'info');
      return true;
    }
    
    // Not in Docker
    process.env.RUNNING_IN_DOCKER = 'false';
    dbLog('Detected non-Docker environment', 'info');
    return false;
  } catch (error) {
    dbLog(`Error detecting Docker environment: ${error instanceof Error ? error.message : String(error)}`, 'error');
    // Default to non-Docker
    process.env.RUNNING_IN_DOCKER = 'false';
    return false;
  }
}

export async function initializeDatabase() {
  try {
    // Make sure pg is in JS mode
    process.env.NODE_PG_FORCE_NATIVE = '0';
    
    // Ensure pg-patch is applied
    try {
      const pgPatch = require('../pg-patch.cjs');
      if (pgPatch && pgPatch.applyPgPatches) {
        pgPatch.applyPgPatches();
        dbLog('Pg patches applied from init-db', 'info');
      }
    } catch (e) {
      dbLog(`Error loading pg-patch: ${e}`, 'error');
    }
    
    // Skip if already initialized
    if (dbInitialized) {
      dbLog('Database already initialized, skipping');
      return true;
    }
    
    dbLog('Initializing database connection...', 'info');
    
    // Always log database URL in debug mode
    dbLog('DATABASE_URL: ' + (process.env.DATABASE_URL ? 
              `Set (${process.env.DATABASE_URL.length} chars)` : 'Not set'), 'info');
    dbLog('DATABASE_URL_DOCKER: ' + (process.env.DATABASE_URL_DOCKER ? 
              `Set (${process.env.DATABASE_URL_DOCKER.length} chars)` : 'Not set'), 'info');
    
    // Detect Docker environment and set appropriate connection strings
    const inDocker = detectDockerEnvironment();
    dbLog(`Running in Docker: ${inDocker}`, 'info');
    
    if (inDocker) {
      // Inside Docker container - use container network
      const dockerUrl = 'postgresql://postgres:postgres@postgres:5432/socialgenius';
      process.env.DATABASE_URL = dockerUrl;
      process.env.DATABASE_URL_DOCKER = dockerUrl;
      dbLog(`Using Docker network database connection: ${dockerUrl}`, 'info');
    } else {
      // External to Docker - use host mapping
      const hostUrl = 'postgresql://postgres:postgres@localhost:5435/socialgenius';
      process.env.DATABASE_URL = hostUrl;
      dbLog(`Using host machine database connection: ${hostUrl}`, 'info');
    }
    
    // Create PostgresService instance and let it handle connection details
    const dbService = PostgresService.getInstance();
    
    // Test connection with multiple attempts - minimize logs here
    dbLog('Testing database connection...', 'info');
    const isConnected = await dbService.testConnection();
    
    if (!isConnected) {
      dbLog('Failed to connect to database after multiple attempts', 'error');
      return false;
    }
    
    // Only log summary information when debug is disabled
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev && process.env.DEBUG_DATABASE !== 'true') {
      // Just log a timestamp for the "Database initialized" message to avoid spam
      const timestamp = new Date().toISOString().split('T')[1].substring(0, 8);
      console.log(`Database initialized successfully ${timestamp}`);
    } else {
      dbLog('Successfully connected to database', 'info');
    }
    
    // Initialize tables
    dbLog('Initializing database tables...', 'info');
    await dbService.initialize();
    dbLog('Database tables initialized successfully', 'info');
    
    // Initialize the Auth service
    dbLog('Initializing Auth service...', 'info');
    const authService = AuthService.getInstance();
    
    // Clean up any expired sessions
    dbLog('Cleaning up expired sessions...', 'info');
    const cleanedSessions = await authService.cleanupSessions();
    dbLog(`Cleaned up ${cleanedSessions} expired sessions`, 'info');
    
    dbInitialized = true;
    dbLog('✅ Database successfully initialized and ready', 'info');
    return true;
  } catch (error) {
    dbLog(`Error initializing database: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return false;
  }
}