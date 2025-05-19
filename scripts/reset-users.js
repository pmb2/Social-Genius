// Reset users database script
import { Pool } from 'pg';

async function resetUsers() {
  // Get database connection details from environment variables or use defaults
  const connectionString = process.env.DATABASE_URL || 
                          'postgresql://postgres:postgres@localhost:5435/socialgenius';
  
  console.log('Connecting to database...');
  const pool = new Pool({ connectionString });
  
  try {
    // Start a transaction
    const client = await pool.connect();
    
    try {
      console.log('Starting transaction...');
      await client.query('BEGIN');
      
      // First drop dependent tables in the correct order
      console.log('Removing sessions...');
      await client.query('TRUNCATE sessions CASCADE');
      
      console.log('Removing notifications...');
      await client.query('TRUNCATE notifications CASCADE');
      
      // Remove any other user-dependent data
      console.log('Removing businesses and related data...');
      await client.query('TRUNCATE businesses CASCADE');
      await client.query('TRUNCATE task_logs CASCADE');
      
      // Finally, remove the users
      console.log('Removing users...');
      await client.query('TRUNCATE users CASCADE');
      
      console.log('Committing transaction...');
      await client.query('COMMIT');
      
      console.log('🧹 Database cleaned: All users and related data have been removed.');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error resetting users database:', error);
      process.exit(1);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the function
resetUsers().catch(console.error);