// Database service entry point
import PostgresService from './postgres-service';
import RedisService from './redis-service';

// Apply pg patches first - wrapped in async function
async function applyPatches() {
  try {
    // In development, we need to pre-load the pg patch
    if (process.env.NODE_ENV === 'development') {
      try {
        await import('../../pg-runtime-patch.cjs'); // Corrected path
        console.log('pg patch applied: true');
      } catch (error) {
        console.warn('Could not apply pg-patch:', error);
      }
    }
  } catch (err) {
    console.warn('Error applying pg patches:', err);
  }
}

// Apply patches immediately
applyPatches();

// Initialize services
const postgresService = PostgresService.getInstance();
const redisService = RedisService.getInstance(); // Uncommented

// Export services individually
export { PostgresService };
export { default as DatabaseService } from './postgres-service';

// Export as a default object
const services = {
  postgres: postgresService,
  redis: redisService, // Uncommented
};

export default services;
export { initializeGoogleOAuth, verifyGoogleOAuthTables } from './init-google-oauth';
