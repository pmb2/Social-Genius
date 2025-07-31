/**
 * Redis Service
 * 
 * Provides a centralized Redis client instance and utility methods for the application.
 * Handles connection, error handling, and common Redis operations.
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

// Redis configuration from environment variables
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PREFIX = process.env.REDIS_PREFIX || 'social-genius:';
const REDIS_LOG_LEVEL = (process.env.REDIS_LOG_LEVEL || 'info') as 'verbose' | 'notice' | 'warning';

// Key prefixes for different data types
const KEY_PREFIXES = {
  SESSION: `${REDIS_PREFIX}session:`,
  USER: `${REDIS_PREFIX}user:`,
  BUSINESS: `${REDIS_PREFIX}business:`,
  TASK: `${REDIS_PREFIX}task:`,
  LOCK: `${REDIS_PREFIX}lock:`,
  COUNTER: `${REDIS_PREFIX}counter:`,
  CACHE: `${REDIS_PREFIX}cache:`,
};

/**
 * Redis service class providing shared Redis functionality
 */
export class RedisService {
  private static instance: RedisService;
  private redis: Redis;
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;
  private isConnected = false;
  private reconnecting = false;
  
  /**
   * Get the singleton instance of RedisService
   */
  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // Create Redis client with retry strategy
    this.redis = new Redis(REDIS_URL, {
      retryStrategy: (times) => {
        // Exponential backoff with max 30s
        const delay = Math.min(times * 100, 30000);
        console.log(`[RedisService] Connection attempt ${times}, retrying in ${delay}ms`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
      lazyConnect: false, // Connect immediately
      connectTimeout: 10000, // 10 seconds timeout for initial connection
      keyPrefix: '', // We'll handle prefixes manually for more control
    });
    
    // Setup connection event handlers
    this.setupEventHandlers();
    
    
  }
  
  /**
   * Set up Redis event handlers
   */
  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      
    });
    
    this.redis.on('ready', () => {
      this.isConnected = true;
      this.reconnecting = false;
      
    });
    
    this.redis.on('error', (err) => {
      console.error('[RedisService] Redis connection error:', err);
      this.isConnected = false;
    });
    
    this.redis.on('reconnecting', () => {
      
    });
    
    this.redis.on('close', () => {
      this.isConnected = false;
      
    });
    
    // Handle process termination
    process.on('beforeExit', async () => {
      await this.shutdown();
    });
  }
  
  /**
   * Get the Redis client instance
   */
  public getClient(): Redis {
    return this.redis;
  }
  
  /**
   * Check if Redis is connected
   */
  public isReady(): boolean {
    return this.isConnected;
  }
  
  /**
   * Ping Redis to check connectivity
   */
  public async ping(): Promise<string> {
    try {
      return await this.redis.ping();
    } catch (error) {
      console.error('[RedisService] Ping failed:', error);
      throw error;
    }
  }
  
  /**
   * Set a key with optional expiration
   */
  public async set(key: string, value: string | number | Buffer, ttlSeconds?: number): Promise<'OK'> {
    try {
      if (ttlSeconds) {
        return await this.redis.set(key, value, 'EX', ttlSeconds);
      } else {
        return await this.redis.set(key, value);
      }
    } catch (error) {
      console.error(`[RedisService] Error setting key ${key}:`, error);
      throw error;
    }
  }
  
  /**
   * Get a value by key
   */
  public async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      console.error(`[RedisService] Error getting key ${key}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete a key
   */
  public async del(key: string): Promise<number> {
    try {
      return await this.redis.del(key);
    } catch (error) {
      console.error(`[RedisService] Error deleting key ${key}:`, error);
      throw error;
    }
  }
  
  /**
   * Store an object as JSON
   */
  public async setJSON(key: string, value: any, ttlSeconds?: number): Promise<'OK'> {
    try {
      const jsonValue = JSON.stringify(value);
      return await this.set(key, jsonValue, ttlSeconds);
    } catch (error) {
      console.error(`[RedisService] Error setting JSON for key ${key}:`, error);
      throw error;
    }
  }
  
  /**
   * Get and parse a JSON object
   */
  public async getJSON<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`[RedisService] Error getting JSON for key ${key}:`, error);
      throw error;
    }
  }
  
  /**
   * Set a key only if it doesn't exist (NX)
   */
  public async setnx(key: string, value: string | number): Promise<number> {
    try {
      return await this.redis.setnx(key, value);
    } catch (error) {
      console.error(`[RedisService] Error setting NX for key ${key}:`, error);
      throw error;
    }
  }
  
  /**
   * Increment a counter
   */
  public async incr(key: string): Promise<number> {
    try {
      return await this.redis.incr(key);
    } catch (error) {
      console.error(`[RedisService] Error incrementing key ${key}:`, error);
      throw error;
    }
  }
  
  /**
   * Add to a set
   */
  public async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.redis.sadd(key, ...members);
    } catch (error) {
      console.error(`[RedisService] Error adding to set ${key}:`, error);
      throw error;
    }
  }
  
  /**
   * Get members of a set
   */
  public async smembers(key: string): Promise<string[]> {
    try {
      return await this.redis.smembers(key);
    } catch (error) {
      console.error(`[RedisService] Error getting members of set ${key}:`, error);
      throw error;
    }
  }
  
  /**
   * Remove from a set
   */
  public async srem(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.redis.srem(key, ...members);
    } catch (error) {
      console.error(`[RedisService] Error removing from set ${key}:`, error);
      throw error;
    }
  }
  
  /**
   * Add to a sorted set
   */
  public async zadd(key: string, score: number, member: string): Promise<number> {
    try {
      return await this.redis.zadd(key, score, member);
    } catch (error) {
      console.error(`[RedisService] Error adding to sorted set ${key}:`, error);
      throw error;
    }
  }
  
  /**
   * Get a range from a sorted set
   */
  public async zrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.redis.zrange(key, start, stop);
    } catch (error) {
      console.error(`[RedisService] Error getting range from sorted set ${key}:`, error);
      throw error;
    }
  }
  
  /**
   * Acquire a distributed lock
   * @returns Lock token if successful, null if not
   */
  public async acquireLock(resourceName: string, ttlMs = 30000): Promise<string | null> {
    const lockKey = `${KEY_PREFIXES.LOCK}${resourceName}`;
    const lockToken = uuidv4();
    const ttlSeconds = Math.ceil(ttlMs / 1000);
    
    try {
      // SET NX with expiration
      const result = await this.redis.set(lockKey, lockToken, 'PX', ttlMs, 'NX');
      
      if (result === 'OK') {
        return lockToken;
      }
      
      return null; // Lock not acquired
    } catch (error) {
      console.error(`[RedisService] Error acquiring lock for ${resourceName}:`, error);
      return null;
    }
  }
  
  /**
   * Release a distributed lock
   * @returns true if the lock was released, false if not
   */
  public async releaseLock(resourceName: string, lockToken: string): Promise<boolean> {
    const lockKey = `${KEY_PREFIXES.LOCK}${resourceName}`;
    
    try {
      // Use Lua script to ensure atomic release only if token matches
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await this.redis.eval(script, 1, lockKey, lockToken);
      return result === 1;
    } catch (error) {
      console.error(`[RedisService] Error releasing lock for ${resourceName}:`, error);
      return false;
    }
  }
  
  /**
   * Set up a subscriber for pub/sub
   */
  public async getSubscriber(): Promise<Redis> {
    if (!this.subscriber) {
      // Create a dedicated connection for subscriptions
      this.subscriber = new Redis(REDIS_URL, {
        retryStrategy: (times) => {
          return Math.min(times * 100, 30000);
        },
        enableReadyCheck: true,
      });
      
      this.subscriber.on('error', (err) => {
        console.error('[RedisService] Subscriber connection error:', err);
      });
    }
    
    return this.subscriber;
  }
  
  /**
   * Get a publisher for pub/sub
   */
  public async getPublisher(): Promise<Redis> {
    if (!this.publisher) {
      // Create a dedicated connection for publishing
      this.publisher = new Redis(REDIS_URL, {
        retryStrategy: (times) => {
          return Math.min(times * 100, 30000);
        },
        enableReadyCheck: true,
      });
      
      this.publisher.on('error', (err) => {
        console.error('[RedisService] Publisher connection error:', err);
      });
    }
    
    return this.publisher;
  }
  
  /**
   * Publish a message to a channel
   */
  public async publish(channel: string, message: string): Promise<number> {
    try {
      const publisher = await this.getPublisher();
      return await publisher.publish(channel, message);
    } catch (error) {
      console.error(`[RedisService] Error publishing to channel ${channel}:`, error);
      throw error;
    }
  }
  
  /**
   * Subscribe to a channel
   */
  public async subscribe(channel: string, callback: (message: string, channel: string) => void): Promise<void> {
    try {
      const subscriber = await this.getSubscriber();
      
      await subscriber.subscribe(channel);
      
      subscriber.on('message', (subscribedChannel, message) => {
        if (subscribedChannel === channel) {
          callback(message, channel);
        }
      });
    } catch (error) {
      console.error(`[RedisService] Error subscribing to channel ${channel}:`, error);
      throw error;
    }
  }
  
  /**
   * Get memory usage statistics
   */
  public async getMemoryStats(): Promise<Record<string, any>> {
    try {
      const info = await this.redis.info('memory');
      const stats: Record<string, any> = {};
      
      // Parse the INFO output
      info.split('\r\n').forEach(line => {
        if (line && !line.startsWith('#')) {
          const [key, value] = line.split(':');
          if (key && value) {
            stats[key] = value;
          }
        }
      });
      
      return stats;
    } catch (error) {
      console.error('[RedisService] Error getting memory stats:', error);
      return { error: String(error) };
    }
  }
  
  /**
   * Get health status information
   */
  public async getHealthStatus(): Promise<Record<string, any>> {
    try {
      const startTime = Date.now();
      const pingResult = await this.ping();
      const pingLatency = Date.now() - startTime;
      
      const dbSize = await this.redis.dbsize();
      const memoryStats = await this.getMemoryStats();
      
      return {
        status: pingResult === 'PONG' ? 'healthy' : 'unhealthy',
        connected: this.isConnected,
        pingLatency: `${pingLatency}ms`,
        dbSize,
        memoryUsed: memoryStats['used_memory_human'],
        memoryPeak: memoryStats['used_memory_peak_human'],
        memoryFragmentationRatio: memoryStats['mem_fragmentation_ratio'],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[RedisService] Error getting health status:', error);
      return {
        status: 'unhealthy',
        connected: false,
        error: String(error),
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Cache a value with TTL
   */
  public async cache<T>(key: string, getValue: () => Promise<T>, ttlSeconds = 300): Promise<T> {
    const cacheKey = `${KEY_PREFIXES.CACHE}${key}`;
    
    try {
      // Try to get from cache first
      const cachedValue = await this.getJSON<T>(cacheKey);
      if (cachedValue !== null) {
        return cachedValue;
      }
      
      // Cache miss, get the actual value
      const value = await getValue();
      
      // Store in cache
      await this.setJSON(cacheKey, value, ttlSeconds);
      
      return value;
    } catch (error) {
      console.error(`[RedisService] Cache error for key ${key}:`, error);
      // If cache operations fail, just return the value directly
      return getValue();
    }
  }
  
  /**
   * Clear the cache for a specific key
   */
  public async invalidateCache(key: string): Promise<boolean> {
    const cacheKey = `${KEY_PREFIXES.CACHE}${key}`;
    
    try {
      const result = await this.del(cacheKey);
      return result > 0;
    } catch (error) {
      console.error(`[RedisService] Error invalidating cache for key ${key}:`, error);
      return false;
    }
  }
  
  /**
   * Shutdown Redis connections gracefully
   */
  public async shutdown(): Promise<void> {
    try {
      console.log('[RedisService] Shutting down Redis connections...');
      
      // Close subscriber connection if it exists
      if (this.subscriber) {
        await this.subscriber.quit();
        this.subscriber = null;
      }
      
      // Close publisher connection if it exists
      if (this.publisher) {
        await this.publisher.quit();
        this.publisher = null;
      }
      
      // Close main connection
      if (this.redis) {
        await this.redis.quit();
      }
      
      this.isConnected = false;
      console.log('[RedisService] Redis connections shut down');
    } catch (error) {
      console.error('[RedisService] Error during shutdown:', error);
    }
  }
  
  /**
   * Mask sensitive parts of Redis URL for logging
   */
  private maskRedisUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.password) {
        return url.replace(parsedUrl.password, '***');
      }
      return url;
    } catch {
      // If URL parsing fails, just mask the entire URL to be safe
      return url.includes('@') ? url.replace(/\/\/.*@/, '//***:***@') : url;
    }
  }
  
  /**
   * Get key prefixes
   */
  public getKeyPrefixes(): typeof KEY_PREFIXES {
    return KEY_PREFIXES;
  }
}

// Export the singleton instance
export default RedisService.getInstance();