// This file ensures pg-native is properly handled by setting environment variables
// The actual aliasing is handled in next.config.mjs

// Force disable native pg bindings
process.env.NODE_PG_FORCE_NATIVE = '0';
process.env.PGSSLMODE = 'disable';

console.log('pg-patch: Environment variables set to disable pg-native');