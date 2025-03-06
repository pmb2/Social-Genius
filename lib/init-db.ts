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
    
    // Use fallback connections if needed
    if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_DOCKER) {
      console.log('No database URLs set. Trying multiple fallback connections');
      
      // Set fallbacks to try in order
      const fallbacks = [
        'postgresql://postgres:postgres@localhost:5435/socialgenius',
        'postgresql://postgres:postgres@postgres:5432/socialgenius',
        'postgresql://postgres:postgres@localhost:5432/socialgenius'
      ];
      
      for (const url of fallbacks) {
        console.log(`Setting fallback DATABASE_URL: ${url}`);
        process.env.DATABASE_URL = url;
        
        // Test this connection
        try {
          const testPool = new Pool({ connectionString: url, connectionTimeoutMillis: 2000 });
          const client = await testPool.connect();
          await client.query('SELECT 1');
          client.release();
          await testPool.end();
          
          console.log(`Connection successful with: ${url}`);
          break;
        } catch (e) {
          console.log(`Connection failed with: ${url}`);
          continue;
        }
      }
    }
    
    const dbService = PostgresService.getInstance();
    
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