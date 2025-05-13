/**
 * Browser Session Monitoring Tool
 * 
 * This script monitors browser sessions using Redis pub/sub for real-time updates.
 * Run with: node src/scripts/monitor-browser-sessions.js
 */

import Redis from 'ioredis';

// Configuration - Ensure consistent Redis URL with other components
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const REDIS_PREFIX = process.env.REDIS_PREFIX || 'social-genius:';
const SESSION_CHANNEL = `${REDIS_PREFIX}browser:events`;

// ANSI color codes for prettier console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bright: {
    red: '\x1b[91m',
    green: '\x1b[92m',
    yellow: '\x1b[93m',
    blue: '\x1b[94m',
    magenta: '\x1b[95m',
    cyan: '\x1b[96m',
    white: '\x1b[97m'
  }
};

// Create Redis clients
const subscriber = new Redis(REDIS_URL);
const redis = new Redis(REDIS_URL);

console.log(`${colors.bright.blue}Browser Session Monitor${colors.reset}`);
console.log(`${colors.cyan}Connecting to Redis at ${REDIS_URL}...${colors.reset}`);
console.log(`${colors.cyan}Monitoring channel: ${SESSION_CHANNEL}${colors.reset}`);
console.log(`${colors.yellow}Press Ctrl+C to exit${colors.reset}`);

// Subscribe to browser events channel
subscriber.subscribe(SESSION_CHANNEL, (err, count) => {
  if (err) {
    console.error(`${colors.red}Error subscribing to channel: ${err.message}${colors.reset}`);
    process.exit(1);
  }
  console.log(`${colors.green}Subscribed successfully. Listening for browser session events...${colors.reset}`);
  
  // List active sessions on startup
  listActiveSessions();
});

// Handle incoming messages
subscriber.on('message', (channel, message) => {
  if (channel === SESSION_CHANNEL) {
    try {
      const event = JSON.parse(message);
      logEvent(event);
    } catch (e) {
      console.error(`${colors.red}Error parsing message: ${e.message}${colors.reset}`);
      console.log(`${colors.yellow}Raw message: ${message}${colors.reset}`);
    }
  }
});

// Handle errors
subscriber.on('error', (err) => {
  console.error(`${colors.red}Subscriber error: ${err.message}${colors.reset}`);
});

redis.on('error', (err) => {
  console.error(`${colors.red}Redis error: ${err.message}${colors.reset}`);
});

// Log received events with pretty formatting
function logEvent(event) {
  const timestamp = new Date().toISOString();
  let color = colors.white;
  let emoji = '📌';
  
  // Select color and emoji based on event type
  switch (event.type) {
    case 'session.created':
      color = colors.bright.green;
      emoji = '🆕';
      break;
    case 'session.updated':
      color = colors.bright.blue;
      emoji = '🔄';
      break;
    case 'session.expired':
      color = colors.bright.yellow;
      emoji = '⏱️';
      break;
    case 'session.deleted':
      color = colors.bright.red;
      emoji = '🗑️';
      break;
    case 'auth.success':
      color = colors.bright.green;
      emoji = '✅';
      break;
    case 'auth.failure':
      color = colors.bright.red;
      emoji = '❌';
      break;
    case 'browser.created':
      color = colors.bright.cyan;
      emoji = '🌐';
      break;
    case 'browser.closed':
      color = colors.yellow;
      emoji = '🔌';
      break;
    case 'error':
      color = colors.bright.red;
      emoji = '💥';
      break;
  }
  
  // Print formatted event
  console.log(`${color}${timestamp} ${emoji} [${event.type}]${colors.reset}`);
  
  // Format and display event details
  if (event.businessId) {
    console.log(`  ${colors.cyan}Business:${colors.reset} ${event.businessId}`);
  }
  
  if (event.sessionId) {
    console.log(`  ${colors.cyan}Session:${colors.reset} ${event.sessionId}`);
  }
  
  if (event.email) {
    console.log(`  ${colors.cyan}Email:${colors.reset} ${event.email}`);
  }
  
  if (event.message) {
    console.log(`  ${colors.cyan}Message:${colors.reset} ${event.message}`);
  }
  
  if (event.data) {
    console.log(`  ${colors.cyan}Data:${colors.reset}`);
    Object.entries(event.data).forEach(([key, value]) => {
      // Format value for display (shorten long values)
      let displayValue = value;
      if (typeof value === 'string' && value.length > 100) {
        displayValue = value.substring(0, 100) + '...';
      } else if (typeof value === 'object' && value !== null) {
        displayValue = JSON.stringify(value).substring(0, 100) + (JSON.stringify(value).length > 100 ? '...' : '');
      }
      
      console.log(`    ${colors.cyan}${key}:${colors.reset} ${displayValue}`);
    });
  }
  
  console.log(''); // Empty line for readability
}

// List all active sessions
async function listActiveSessions() {
  try {
    // Get all keys with session prefix
    const sessionKeys = await redis.keys(`${REDIS_PREFIX}session:*`);
    
    if (sessionKeys.length === 0) {
      console.log(`${colors.yellow}No active sessions found${colors.reset}`);
      return;
    }
    
    console.log(`${colors.bright.magenta}Active Sessions (${sessionKeys.length}):${colors.reset}`);
    
    // Fetch session details
    for (const key of sessionKeys) {
      const sessionData = await redis.get(key);
      if (sessionData) {
        try {
          const session = JSON.parse(sessionData);
          console.log(`${colors.cyan}Session ID:${colors.reset} ${session.id}`);
          console.log(`  ${colors.cyan}Business:${colors.reset} ${session.businessId}`);
          console.log(`  ${colors.cyan}Email:${colors.reset} ${session.email}`);
          console.log(`  ${colors.cyan}Status:${colors.reset} ${session.status}`);
          console.log(`  ${colors.cyan}Created:${colors.reset} ${session.createdAt}`);
          console.log(`  ${colors.cyan}Last Used:${colors.reset} ${session.lastUsed}`);
          console.log(''); // Empty line for readability
        } catch (e) {
          console.error(`${colors.red}Error parsing session data: ${e.message}${colors.reset}`);
        }
      }
    }
  } catch (error) {
    console.error(`${colors.red}Error listing sessions: ${error.message}${colors.reset}`);
  }
}

// Simulate publishing test events for demonstration
async function publishTestEvents() {
  const testBusinessId = 'test-business-' + Date.now();
  const testSessionId = 'test-session-' + Date.now();
  
  // Wait for 2 seconds before publishing test events
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Create session event
  await redis.publish(SESSION_CHANNEL, JSON.stringify({
    type: 'session.created',
    timestamp: new Date().toISOString(),
    businessId: testBusinessId,
    sessionId: testSessionId,
    email: 'test@example.com',
    message: 'Session created for demonstration',
    data: {
      status: 'active',
      createdAt: new Date().toISOString()
    }
  }));
  
  // Wait 1 second
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Authentication success event
  await redis.publish(SESSION_CHANNEL, JSON.stringify({
    type: 'auth.success',
    timestamp: new Date().toISOString(),
    businessId: testBusinessId,
    sessionId: testSessionId,
    email: 'test@example.com',
    message: 'Authentication successful',
    data: {
      duration: '1.2s',
      method: 'password'
    }
  }));
  
  // Wait 1 second
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Session update event
  await redis.publish(SESSION_CHANNEL, JSON.stringify({
    type: 'session.updated',
    timestamp: new Date().toISOString(),
    businessId: testBusinessId,
    sessionId: testSessionId,
    message: 'Session updated with cookies',
    data: {
      cookiesCount: 12,
      lastUsed: new Date().toISOString()
    }
  }));
  
  // Wait 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Browser created event
  await redis.publish(SESSION_CHANNEL, JSON.stringify({
    type: 'browser.created',
    timestamp: new Date().toISOString(),
    businessId: testBusinessId,
    sessionId: testSessionId,
    message: 'Browser instance created',
    data: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      headless: true
    }
  }));
  
  // Wait 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Error event
  await redis.publish(SESSION_CHANNEL, JSON.stringify({
    type: 'error',
    timestamp: new Date().toISOString(),
    businessId: testBusinessId,
    sessionId: testSessionId,
    message: 'Navigation timeout error',
    data: {
      errorCode: 'NAVIGATION_TIMEOUT',
      url: 'https://business.google.com/dashboard',
      timeout: '30000ms'
    }
  }));
  
  // Wait 1 second
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Browser closed event
  await redis.publish(SESSION_CHANNEL, JSON.stringify({
    type: 'browser.closed',
    timestamp: new Date().toISOString(),
    businessId: testBusinessId,
    sessionId: testSessionId,
    message: 'Browser instance closed',
    data: {
      reason: 'error-recovery',
      duration: '5.3s'
    }
  }));
  
  // Wait 1 second
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Session expired event
  await redis.publish(SESSION_CHANNEL, JSON.stringify({
    type: 'session.expired',
    timestamp: new Date().toISOString(),
    businessId: testBusinessId,
    sessionId: testSessionId,
    message: 'Session marked as expired',
    data: {
      reason: 'timeout',
      expiredAt: new Date().toISOString()
    }
  }));
}

// Check if we're in demo mode
if (process.argv.includes('--demo')) {
  console.log(`${colors.bright.yellow}Running in demo mode with simulated events${colors.reset}`);
  publishTestEvents();
}

// Handle program termination
process.on('SIGINT', async () => {
  console.log(`\n${colors.yellow}Closing connections...${colors.reset}`);
  subscriber.disconnect();
  redis.disconnect();
  console.log(`${colors.green}Monitor stopped${colors.reset}`);
  process.exit(0);
});