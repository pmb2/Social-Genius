// Database service entry point
import PostgresService from './postgres-service';
import RedisService from './redis-service';

// Apply pg patches first
try {
  // In development, we need to pre-load the pg patch
  if (process.env.NODE_ENV === 'development') {
    try {
      await import('../../../pg-patch.cjs');
      console.log('pg patch applied: true');
    } catch (error) {
      console.warn('Could not apply pg-patch:', error);
    }
  }
} catch (err) {
  console.warn('Error applying pg patches:', err);
}

// Initialize services
const postgresService = PostgresService.getInstance();
// const redisService = RedisService.getInstance();

// Export services individually
export { PostgresService };
export { default as DatabaseService } from './postgres-service';

// Export as a default object
const services = {
  postgres: postgresService,
  // redis: redisService,
};

export default services;
export { initializeGoogleOAuth, verifyGoogleOAuthTables } from './init-google-oauth';
