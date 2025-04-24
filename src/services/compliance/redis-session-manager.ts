/**
 * Redis Session Manager for Browser Automation
 * 
 * This service provides Redis-backed session management for browser automation,
 * enabling persistent sessions across service restarts and sharing browser contexts
 * between different services.
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

// Environment variable configuration with defaults
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PREFIX = process.env.REDIS_PREFIX || 'social-genius:';
const SESSION_TTL = parseInt(process.env.SESSION_TTL || '86400', 10); // 24 hours in seconds

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
    // Initialize Redis connection
    this.redis = new Redis(REDIS_URL, {
      retryStrategy: (times) => {
        // Exponential backoff with max 30s
        return Math.min(times * 100, 30000);
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });

    // Setup connection event handlers
    this.redis.on('connect', () => {
      console.log('[RedisSessionManager] Connected to Redis');
    });

    this.redis.on('error', (err) => {
      console.error('[RedisSessionManager] Redis connection error:', err);
    });

    this.redis.on('reconnecting', () => {
      console.log('[RedisSessionManager] Reconnecting to Redis...');
    });

    // Handle process termination
    process.on('beforeExit', async () => {
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