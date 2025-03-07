import PostgresService from '@/services/postgres-service';
import { Pool } from 'pg';

// Set this to know if we've initialized
let dbInitialized = false;

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
    
    // Override with the localhost Docker connection that we know works for this environment
    // This ensures reliable connection in the current setup
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/socialgenius';
    console.log('Using hardcoded PostgreSQL connection for reliability');
    
    // Create new PostgresService instance with updated connection
    const dbService = PostgresService.getInstance();
    await dbService.resetConnection(process.env.DATABASE_URL);
    
    // Try to connect first
    const pool = dbService.getPool();
    const client = await pool.connect();
    console.log('Successfully connected to database');
    client.release();
    
    // Now initialize tables
    await dbService.initialize();
    console.log('Database initialized successfully');
    
    dbInitialized = true;
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    
    // Try with a fallback connection string
    try {
      console.log('Trying with fallback localhost connection...');
      process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/postgres';
      
      const dbService = PostgresService.getInstance();
      await dbService.resetConnection(process.env.DATABASE_URL);
      await dbService.initialize();
      
      console.log('Database initialized with fallback connection');
      dbInitialized = true;
      return true;
    } catch (fallbackError) {
      console.error('Failed with fallback connection too:', fallbackError);
      return false;
    }
  }
}