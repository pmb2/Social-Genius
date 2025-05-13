/**
 * Redis Session Manager for Browser Automation
 * 
 * This service provides Redis-backed session management for browser automation,
 * enabling persistent sessions across service restarts and sharing browser contexts
 * between different services.
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

// Environment variable configuration with defaults and fallbacks
// Primary URL (service name in Docker network)
const PRIMARY_REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

// Fallback URLs to try if primary fails - maintain consistent order of priority
// Note: host.docker.internal is placed first as it's been observed to be more reliable
const FALLBACK_REDIS_URLS = [
  'redis://host.docker.internal:6380', // Access host from Docker container (most reliable)
  'redis://host.docker.internal:6379', // Alternate port on host
  'redis://redis:6379',       // Container service name (Docker network)
  'redis://localhost:6380',   // Default local dev port mapping
  'redis://localhost:6379',   // Default Redis port
  'redis://127.0.0.1:6380',   // Explicit localhost IP
  'redis://127.0.0.1:6379'    // Explicit localhost IP alternate port
];

// Start with primary URL
let REDIS_URL = PRIMARY_REDIS_URL;
const REDIS_PREFIX = process.env.REDIS_PREFIX || 'social-genius:';
const SESSION_TTL = parseInt(process.env.SESSION_TTL || '86400', 10); // 24 hours in seconds

// Enhanced connection logic
const isRunningInDocker = process.env.RUNNING_IN_DOCKER === 'true';

// Log Redis connection info at startup for debugging
console.log(`[RedisSessionManager] Initializing with primary REDIS_URL: ${PRIMARY_REDIS_URL.replace(/\/\/.*@/, '//***:***@')} (credentials masked)`);
console.log(`[RedisSessionManager] Running in Docker: ${isRunningInDocker ? 'Yes' : 'No/Unknown'}`);
console.log(`[RedisSessionManager] Fallback URLs available: ${FALLBACK_REDIS_URLS.length}`);
console.log(`[RedisSessionManager] Using prefix: ${REDIS_PREFIX}`);
console.log(`[RedisSessionManager] Session TTL: ${SESSION_TTL} seconds`);

// Session data types
export interface BrowserSessionData {
  id: string;
  businessId: string;
  email: string;
  createdAt: string;
  lastUsed: string;
  status: 'active' | 'expired' | 'error';
  cookiesJson?: string;
  storageJson?: string;
  userAgent?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SessionSearchParams {
  businessId?: string;
  email?: string;
  status?: 'active' | 'expired' | 'error';
  olderThan?: Date;
  newerThan?: Date;
  limit?: number;
}

/**
 * Redis Session Manager for browser automation sessions
 */
export class RedisSessionManager {
  private redis: Redis;
  private static instance: RedisSessionManager;

  // Keys and prefixes
  private readonly sessionPrefix = `${REDIS_PREFIX}session:`;
  private readonly businessPrefix = `${REDIS_PREFIX}business:`;
  private readonly emailPrefix = `${REDIS_PREFIX}email:`;
  private readonly lockPrefix = `${REDIS_PREFIX}lock:`;
  private readonly statusSetPrefix = `${REDIS_PREFIX}status:`;

  /**
   * Get the singleton instance of RedisSessionManager
   */
  public static getInstance(): RedisSessionManager {
    if (!RedisSessionManager.instance) {
      RedisSessionManager.instance = new RedisSessionManager();
    }
    return RedisSessionManager.instance;
  }

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // Initialize Redis connection with fallback support
    this.initializeRedisWithFallbacks();

    // Handle process termination
    process.on('beforeExit', async () => {
      await this.shutdown();
    });
  }
  
  /**
   * Initialize Redis connection with fallback logic and robust reconnection
   */
  private initializeRedisWithFallbacks() {
    // Start with the primary URL
    let currentUrlIndex = -1; // Start with primary URL (not in fallback array)
    let connectionAttempts = 0;
    const maxConnectionAttempts = 10; // Maximum number of total connection attempts
    const connectionDelayMs = 1000; // Delay between connection attempts
    
    const tryNextUrl = () => {
      connectionAttempts++;
      
      if (this.redis) {
        // Disconnect existing client if there is one
        try {
          this.redis.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
      }
      
      // Log detailed connection attempt information
      console.log(`[RedisSessionManager] Connection attempt ${connectionAttempts}/${maxConnectionAttempts}`);
      
      // If we've reached the maximum number of attempts, slow down retry frequency
      if (connectionAttempts >= maxConnectionAttempts) {
        console.warn(`[RedisSessionManager] Max connection attempts (${maxConnectionAttempts}) reached, will retry less frequently`);
        // Reset counter but increase delay between attempts
        connectionAttempts = 0;
        // We'll still try to connect, just with a longer delay (5 seconds)
        setTimeout(tryNextUrl, 5000);
        return;
      }
      
      // Try the next URL
      currentUrlIndex++;
      let currentUrl: string;
      
      if (currentUrlIndex === 0) {
        // First try the primary URL
        currentUrl = PRIMARY_REDIS_URL;
      } else if (currentUrlIndex <= FALLBACK_REDIS_URLS.length) {
        // Then try fallbacks in order
        currentUrl = FALLBACK_REDIS_URLS[currentUrlIndex - 1];
      } else {
        // We've tried all URLs, log error and restart from first fallback
        console.error(`[RedisSessionManager] All Redis connection attempts failed (${currentUrlIndex} attempts)`);
        console.error('[RedisSessionManager] Restarting from first fallback URL');
        currentUrlIndex = 0; // Start from the beginning of fallback list
        currentUrl = FALLBACK_REDIS_URLS[currentUrlIndex];
      }
      
      // Enhanced connection logging with timing
      const connectStartTime = Date.now();
      console.log(`[RedisSessionManager] Attempting to connect to Redis at ${currentUrl.replace(/\/\/.*@/, '//***:***@')}`);
      
      // Start DNS resolution check for better diagnostics
      try {
        const urlObj = new URL(currentUrl);
        console.log(`[RedisSessionManager] Resolving hostname: ${urlObj.hostname}`);
        // We'll check connection in the Redis client events
      } catch (urlError) {
        console.error(`[RedisSessionManager] Invalid Redis URL: ${currentUrl.replace(/\/\/.*@/, '//***:***@')}`, urlError);
      }
      
      // Create new Redis client with enhanced options for more reliable connection
      this.redis = new Redis(currentUrl, {
        retryStrategy: (times) => {
          // More aggressive retry strategy with exponential backoff
          if (times > 5) {
            // After 5 attempts with same URL, try next URL
            console.log(`[RedisSessionManager] Max retries (${times}) reached for ${currentUrl}, trying next URL...`);
            setTimeout(tryNextUrl, connectionDelayMs);
            return false; // Stop retrying this URL
          }
          
          // Exponential backoff with jitter for better distribution
          const delay = Math.min(times * 1000, 5000); // Cap at 5 seconds
          const jitter = Math.floor(Math.random() * 200); // Add 0-200ms jitter
          return delay + jitter;
        },
        maxRetriesPerRequest: 3,        // Increase retries per request
        enableReadyCheck: true,
        connectTimeout: 10000,          // Increase connect timeout to 10 seconds
        reconnectOnError: (err) => {
          // Determine if error should trigger reconnect
          const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'];
          if (targetErrors.includes(err.code)) {
            console.log(`[RedisSessionManager] Reconnect-triggering error: ${err.code}`);
            return true; // True = reconnect for these errors
          }
          return false;
        }
      });
      
      // Enhanced event handlers with more detailed logging
      this.redis.on('connect', () => {
        const connectTime = Date.now() - connectStartTime;
        console.log(`[RedisSessionManager] Connected to Redis at ${currentUrl.replace(/\/\/.*@/, '//***:***@')} (${connectTime}ms)`);
      });
      
      this.redis.on('ready', () => {
        const readyTime = Date.now() - connectStartTime;
        console.log(`[RedisSessionManager] Successfully established READY Redis connection at ${currentUrl.replace(/\/\/.*@/, '//***:***@')} (${readyTime}ms)`);
        // Save the working URL as REDIS_URL for potential reconnects
        REDIS_URL = currentUrl;
        
        // Reset connection attempts counter on successful connection
        connectionAttempts = 0;
        
        // Verify connection with a PING command
        this.redis.ping().then(result => {
          console.log(`[RedisSessionManager] Redis PING result: ${result}`);
        }).catch(err => {
          console.error(`[RedisSessionManager] Redis PING failed:`, err);
        });
      });
      
      this.redis.on('error', (err) => {
        console.error(`[RedisSessionManager] Redis connection error (${currentUrl.replace(/\/\/.*@/, '//***:***@')}):`, err);
        
        // More detailed error handling
        if (
          err.code === 'ECONNREFUSED' || 
          err.code === 'ETIMEDOUT' || 
          err.code === 'ENOTFOUND' ||
          err.code === 'EAI_AGAIN' ||
          err.code === 'ECONNRESET' ||
          err.code === 'ERR_CONNECTION_TIMED_OUT'
        ) {
          console.log(`[RedisSessionManager] Connection error (${err.code}), trying next URL...`);
          // Add a small delay before trying next URL to avoid rapid cycling
          setTimeout(tryNextUrl, connectionDelayMs);
        } else {
          // For other errors, log but don't immediately try next URL
          console.error(`[RedisSessionManager] Non-connection Redis error:`, err);
        }
      });
      
      this.redis.on('reconnecting', () => {
        console.log(`[RedisSessionManager] Reconnecting to Redis (${currentUrl.replace(/\/\/.*@/, '//***:***@')})...`);
      });
      
      this.redis.on('close', () => {
        console.log(`[RedisSessionManager] Redis connection closed (${currentUrl.replace(/\/\/.*@/, '//***:***@')})`);
      });
      
      this.redis.on('end', () => {
        console.log(`[RedisSessionManager] Redis connection ended (${currentUrl.replace(/\/\/.*@/, '//***:***@')})`);
        // Don't automatically reconnect here - let the error handler handle it
      });
    };
    
    // Start connection attempts with a small initial delay
    setTimeout(tryNextUrl, 100);
    
    // Register process handlers for graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('[RedisSessionManager] SIGTERM received, shutting down Redis connection');
      await this.shutdown();
    });
    
    process.on('SIGINT', async () => {
      console.log('[RedisSessionManager] SIGINT received, shutting down Redis connection');
      await this.shutdown();
    });
  }

  /**
   * Create a new browser session
   */
  public async createSession(data: Omit<BrowserSessionData, 'id' | 'createdAt' | 'lastUsed'>): Promise<BrowserSessionData> {
    const now = new Date().toISOString();
    const sessionId = uuidv4();

    // Create the full session object
    const session: BrowserSessionData = {
      id: sessionId,
      createdAt: now,
      lastUsed: now,
      ...data
    };

    try {
      // Use a transaction to ensure all operations succeed or fail together
      const pipeline = this.redis.pipeline();

      // Store the session data
      pipeline.set(
        `${this.sessionPrefix}${sessionId}`, 
        JSON.stringify(session),
        'EX',
        SESSION_TTL
      );

      // Create index by business ID
      pipeline.sadd(`${this.businessPrefix}${data.businessId}`, sessionId);
      pipeline.expire(`${this.businessPrefix}${data.businessId}`, SESSION_TTL);

      // Create index by email
      pipeline.sadd(`${this.emailPrefix}${data.email}`, sessionId);
      pipeline.expire(`${this.emailPrefix}${data.email}`, SESSION_TTL);

      // Add to status set
      pipeline.sadd(`${this.statusSetPrefix}${data.status}`, sessionId);
      pipeline.expire(`${this.statusSetPrefix}${data.status}`, SESSION_TTL);

      // Execute the transaction
      await pipeline.exec();

      console.log(`[RedisSessionManager] Created session ${sessionId} for business ${data.businessId}`);
      return session;
    } catch (error) {
      console.error(`[RedisSessionManager] Error creating session:`, error);
      throw new Error(`Failed to create session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a session by ID
   */
  public async getSession(sessionId: string): Promise<BrowserSessionData | null> {
    try {
      const data = await this.redis.get(`${this.sessionPrefix}${sessionId}`);
      
      if (!data) {
        return null;
      }

      return JSON.parse(data) as BrowserSessionData;
    } catch (error) {
      console.error(`[RedisSessionManager] Error getting session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Update an existing session
   */
  public async updateSession(sessionId: string, updates: Partial<BrowserSessionData>): Promise<BrowserSessionData | null> {
    try {
      // Lock the session for update
      const lockAcquired = await this.acquireLock(sessionId);
      if (!lockAcquired) {
        throw new Error(`Could not acquire lock for session ${sessionId}`);
      }

      try {
        // Get current session data
        const currentData = await this.getSession(sessionId);
        if (!currentData) {
          throw new Error(`Session ${sessionId} not found`);
        }

        // Update the session with new data
        const updatedSession: BrowserSessionData = {
          ...currentData,
          ...updates,
          lastUsed: new Date().toISOString(),
        };

        // Handle status change - remove from old status set, add to new one
        if (updates.status && updates.status !== currentData.status) {
          // Remove from old status set
          await this.redis.srem(`${this.statusSetPrefix}${currentData.status}`, sessionId);

          // Add to new status set
          await this.redis.sadd(`${this.statusSetPrefix}${updates.status}`, sessionId);
          await this.redis.expire(`${this.statusSetPrefix}${updates.status}`, SESSION_TTL);
        }

        // Store updated session
        await this.redis.set(
          `${this.sessionPrefix}${sessionId}`, 
          JSON.stringify(updatedSession),
          'EX',
          SESSION_TTL
        );

        console.log(`[RedisSessionManager] Updated session ${sessionId}`);
        return updatedSession;
      } finally {
        // Always release the lock
        await this.releaseLock(sessionId);
      }
    } catch (error) {
      console.error(`[RedisSessionManager] Error updating session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Get sessions for a business
   */
  public async getSessionsByBusiness(businessId: string): Promise<BrowserSessionData[]> {
    try {
      // Get all session IDs for the business
      const sessionIds = await this.redis.smembers(`${this.businessPrefix}${businessId}`);
      
      if (!sessionIds.length) {
        return [];
      }

      // Get all sessions in parallel
      const sessions = await Promise.all(
        sessionIds.map(id => this.getSession(id))
      );

      // Filter out null results
      return sessions.filter(session => session !== null) as BrowserSessionData[];
    } catch (error) {
      console.error(`[RedisSessionManager] Error getting sessions for business ${businessId}:`, error);
      return [];
    }
  }

  /**
   * Get active session for a business
   */
  public async getActiveSession(businessId: string): Promise<BrowserSessionData | null> {
    try {
      const sessions = await this.getSessionsByBusiness(businessId);
      
      // Find the most recently used active session
      return sessions
        .filter(session => session.status === 'active')
        .sort((a, b) => {
          return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
        })[0] || null;
    } catch (error) {
      console.error(`[RedisSessionManager] Error getting active session for business ${businessId}:`, error);
      return null;
    }
  }

  /**
   * Delete a session
   */
  public async deleteSession(sessionId: string): Promise<boolean> {
    try {
      // Get session data first for index cleanup
      const session = await this.getSession(sessionId);
      
      if (!session) {
        return false;
      }

      // Use a transaction to ensure all operations succeed or fail together
      const pipeline = this.redis.pipeline();

      // Remove from business index
      pipeline.srem(`${this.businessPrefix}${session.businessId}`, sessionId);
      
      // Remove from email index
      pipeline.srem(`${this.emailPrefix}${session.email}`, sessionId);
      
      // Remove from status set
      pipeline.srem(`${this.statusSetPrefix}${session.status}`, sessionId);
      
      // Delete the session data
      pipeline.del(`${this.sessionPrefix}${sessionId}`);

      // Execute the transaction
      await pipeline.exec();

      console.log(`[RedisSessionManager] Deleted session ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`[RedisSessionManager] Error deleting session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Search for sessions based on parameters
   */
  public async searchSessions(params: SessionSearchParams): Promise<BrowserSessionData[]> {
    try {
      let sessionIds: string[] = [];
      
      // Start with the most specific index to reduce the number of sessions to filter
      if (params.businessId) {
        // Get sessions by business ID
        sessionIds = await this.redis.smembers(`${this.businessPrefix}${params.businessId}`);
      } else if (params.email) {
        // Get sessions by email
        sessionIds = await this.redis.smembers(`${this.emailPrefix}${params.email}`);
      } else if (params.status) {
        // Get sessions by status
        sessionIds = await this.redis.smembers(`${this.statusSetPrefix}${params.status}`);
      } else {
        // Get all sessions (expensive, use with caution)
        const keys = await this.redis.keys(`${this.sessionPrefix}*`);
        sessionIds = keys.map(key => key.substring(this.sessionPrefix.length));
      }

      if (!sessionIds.length) {
        return [];
      }

      // Apply limit if specified
      if (params.limit && params.limit > 0 && params.limit < sessionIds.length) {
        sessionIds = sessionIds.slice(0, params.limit);
      }

      // Get all matching sessions
      const sessions = await Promise.all(
        sessionIds.map(id => this.getSession(id))
      );

      // Filter null sessions and apply additional filters
      let filteredSessions = sessions.filter(session => session !== null) as BrowserSessionData[];
      
      // Apply time-based filters
      if (params.olderThan) {
        filteredSessions = filteredSessions.filter(session => {
          return new Date(session.lastUsed) < params.olderThan!;
        });
      }
      
      if (params.newerThan) {
        filteredSessions = filteredSessions.filter(session => {
          return new Date(session.lastUsed) > params.newerThan!;
        });
      }
      
      // Apply status filter if not already filtered by status
      if (params.status && !params.businessId && !params.email) {
        filteredSessions = filteredSessions.filter(session => session.status === params.status);
      }
      
      // Apply email filter if not already filtered by email
      if (params.email && !params.businessId) {
        filteredSessions = filteredSessions.filter(session => session.email === params.email);
      }

      return filteredSessions;
    } catch (error) {
      console.error(`[RedisSessionManager] Error searching sessions:`, error);
      return [];
    }
  }

  /**
   * Acquire a lock for a session update
   */
  private async acquireLock(sessionId: string, timeoutMs = 5000): Promise<boolean> {
    const lockKey = `${this.lockPrefix}${sessionId}`;
    const lockValue = uuidv4();
    const lockExpiry = Math.ceil(timeoutMs / 1000);
    
    // Try to acquire lock with NX (only if it doesn't exist)
    const acquired = await this.redis.set(lockKey, lockValue, 'EX', lockExpiry, 'NX');
    
    return !!acquired;
  }

  /**
   * Release a lock for a session update
   */
  private async releaseLock(sessionId: string): Promise<void> {
    const lockKey = `${this.lockPrefix}${sessionId}`;
    await this.redis.del(lockKey);
  }

  /**
   * Clean up expired sessions
   */
  public async cleanupExpiredSessions(): Promise<number> {
    try {
      // Get all sessions with expired status
      const expiredSessionIds = await this.redis.smembers(`${this.statusSetPrefix}expired`);
      
      if (!expiredSessionIds.length) {
        return 0;
      }

      // Delete each expired session
      const deletePromises = expiredSessionIds.map(id => this.deleteSession(id));
      const results = await Promise.all(deletePromises);
      
      // Count successful deletions
      const deleteCount = results.filter(result => result).length;
      console.log(`[RedisSessionManager] Cleaned up ${deleteCount} expired sessions`);
      
      return deleteCount;
    } catch (error) {
      console.error(`[RedisSessionManager] Error cleaning up expired sessions:`, error);
      return 0;
    }
  }

  /**
   * Mark sessions as expired if they haven't been used for a specified time
   */
  public async expireInactiveSessions(maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
    try {
      // Get all active sessions
      const activeSessionIds = await this.redis.smembers(`${this.statusSetPrefix}active`);
      
      if (!activeSessionIds.length) {
        return 0;
      }

      const now = new Date();
      let expiredCount = 0;

      // Get active sessions
      const sessions = await Promise.all(
        activeSessionIds.map(id => this.getSession(id))
      );

      // Filter out null results
      const activeSessions = sessions.filter(session => session !== null) as BrowserSessionData[];
      
      // Check each session for expiration
      for (const session of activeSessions) {
        const lastUsed = new Date(session.lastUsed);
        const age = now.getTime() - lastUsed.getTime();
        
        if (age > maxAgeMs) {
          // Update session status to expired
          await this.updateSession(session.id, { status: 'expired' });
          expiredCount++;
        }
      }

      console.log(`[RedisSessionManager] Expired ${expiredCount} inactive sessions`);
      return expiredCount;
    } catch (error) {
      console.error(`[RedisSessionManager] Error expiring inactive sessions:`, error);
      return 0;
    }
  }

  /**
   * Shutdown the Redis connection
   */
  public async shutdown(): Promise<void> {
    if (this.redis) {
      console.log('[RedisSessionManager] Shutting down Redis connection');
      await this.redis.quit();
    }
  }

  /**
   * Get debugging information
   */
  public async getDebugInfo(): Promise<any> {
    const activeCount = await this.redis.scard(`${this.statusSetPrefix}active`);
    const expiredCount = await this.redis.scard(`${this.statusSetPrefix}expired`);
    const errorCount = await this.redis.scard(`${this.statusSetPrefix}error`);
    
    const businessKeys = await this.redis.keys(`${this.businessPrefix}*`);
    const emailKeys = await this.redis.keys(`${this.emailPrefix}*`);
    
    return {
      status: {
        active: activeCount,
        expired: expiredCount,
        error: errorCount,
      },
      indices: {
        businessCount: businessKeys.length,
        emailCount: emailKeys.length,
      },
      connection: {
        status: this.redis.status,
        url: REDIS_URL.replace(/\/\/.*@/, '//***:***@'), // Redact credentials
      }
    };
  }
}

// Export the singleton instance
export default RedisSessionManager.getInstance();