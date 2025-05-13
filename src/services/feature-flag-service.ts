/**
 * Feature Flag Service
 * 
 * Manages feature flags for the application, enabling gradual rollout of features
 * and conditional behavior based on configuration.
 * 
 * Used primarily for the Google Business Profile API transition to control
 * when to use the API vs. browser automation.
 */

import { DatabaseService } from './database';

// Define feature flag types
export enum FeatureFlag {
  // Google Business Profile API flags
  UseGoogleBusinessAPI = 'use_google_business_api',
  GoogleAuthWithOAuth = 'google_auth_with_oauth',
  GooglePostsWithAPI = 'google_posts_with_api',
  GoogleReviewsWithAPI = 'google_reviews_with_api',
  
  // Other feature flags
  EnableNewDashboard = 'enable_new_dashboard',
  EnableNotifications = 'enable_notifications',
}

// Feature flag configuration types
type FlagValue = boolean | number | string;

interface FeatureFlagConfig {
  // Global default for the flag
  defaultValue: FlagValue;
  
  // Override for specific users (by ID)
  userOverrides?: Record<string, FlagValue>;
  
  // Override for specific businesses (by ID)
  businessOverrides?: Record<string, FlagValue>;
  
  // Override for specific environments
  environmentOverrides?: Record<string, FlagValue>;
  
  // Override based on percentage of users/businesses
  rolloutPercentage?: number;
}

export class FeatureFlagService {
  private static instance: FeatureFlagService;
  private db: DatabaseService;
  private configCache: Record<string, FeatureFlagConfig> = {};
  private cacheExpiry: number = 0;
  
  private constructor() {
    this.db = DatabaseService.getInstance();
    this.loadConfiguration();
  }
  
  public static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }
  
  /**
   * Checks if a feature flag is enabled
   * @param flag The feature flag to check
   * @param userId Optional user ID for user-specific overrides
   * @param businessId Optional business ID for business-specific overrides
   * @returns Whether the feature is enabled
   */
  public isEnabled(flag: FeatureFlag, userId?: string | number, businessId?: string | number): boolean {
    return this.getValue(flag, userId, businessId) === true;
  }
  
  /**
   * Gets the value of a feature flag
   * @param flag The feature flag to check
   * @param userId Optional user ID for user-specific overrides
   * @param businessId Optional business ID for business-specific overrides
   * @returns The feature flag value
   */
  public getValue(flag: FeatureFlag, userId?: string | number, businessId?: string | number): FlagValue {
    // Ensure configuration is loaded and not expired
    this.ensureConfigLoaded();
    
    // Get the configuration for this flag
    const config = this.configCache[flag];
    
    if (!config) {
      // If no configuration is found, default to false for boolean flags
      return typeof flag === 'boolean' ? false : null;
    }
    
    // Check user override
    if (userId && config.userOverrides && config.userOverrides[userId.toString()]) {
      return config.userOverrides[userId.toString()];
    }
    
    // Check business override
    if (businessId && config.businessOverrides && config.businessOverrides[businessId.toString()]) {
      return config.businessOverrides[businessId.toString()];
    }
    
    // Check environment override
    const environment = process.env.NODE_ENV || 'development';
    if (config.environmentOverrides && config.environmentOverrides[environment]) {
      return config.environmentOverrides[environment];
    }
    
    // Check rollout percentage
    if (typeof config.rolloutPercentage === 'number') {
      // Use a hash of the user/business ID for consistent rollout
      const idForRollout = this.generateId(userId, businessId);
      const hash = this.hashCode(idForRollout);
      const normalizedHash = (hash % 100 + 100) % 100; // Ensure value is 0-99
      
      if (normalizedHash < config.rolloutPercentage) {
        return true; // User is in the rollout percentage
      } else {
        return false; // User is not in the rollout percentage
      }
    }
    
    // Return default value if no overrides apply
    return config.defaultValue;
  }
  
  /**
   * Sets a user-specific feature flag override
   * @param flag The feature flag to set
   * @param userId The user ID
   * @param value The value to set
   */
  public async setUserOverride(flag: FeatureFlag, userId: string | number, value: FlagValue): Promise<void> {
    // Ensure configuration is loaded
    this.ensureConfigLoaded();
    
    // Get or initialize the config for this flag
    if (!this.configCache[flag]) {
      this.configCache[flag] = {
        defaultValue: false,
        userOverrides: {}
      };
    }
    
    // Ensure userOverrides exists
    if (!this.configCache[flag].userOverrides) {
      this.configCache[flag].userOverrides = {};
    }
    
    // Set the override
    this.configCache[flag].userOverrides![userId.toString()] = value;
    
    // Persist to database
    await this.saveConfiguration();
  }
  
  /**
   * Sets a business-specific feature flag override
   * @param flag The feature flag to set
   * @param businessId The business ID
   * @param value The value to set
   */
  public async setBusinessOverride(flag: FeatureFlag, businessId: string | number, value: FlagValue): Promise<void> {
    // Ensure configuration is loaded
    this.ensureConfigLoaded();
    
    // Get or initialize the config for this flag
    if (!this.configCache[flag]) {
      this.configCache[flag] = {
        defaultValue: false,
        businessOverrides: {}
      };
    }
    
    // Ensure businessOverrides exists
    if (!this.configCache[flag].businessOverrides) {
      this.configCache[flag].businessOverrides = {};
    }
    
    // Set the override
    this.configCache[flag].businessOverrides![businessId.toString()] = value;
    
    // Persist to database
    await this.saveConfiguration();
  }
  
  /**
   * Sets the default value for a feature flag
   * @param flag The feature flag to set
   * @param value The default value
   */
  public async setDefaultValue(flag: FeatureFlag, value: FlagValue): Promise<void> {
    // Ensure configuration is loaded
    this.ensureConfigLoaded();
    
    // Get or initialize the config for this flag
    if (!this.configCache[flag]) {
      this.configCache[flag] = {
        defaultValue: value
      };
    } else {
      this.configCache[flag].defaultValue = value;
    }
    
    // Persist to database
    await this.saveConfiguration();
  }
  
  /**
   * Sets the rollout percentage for a feature flag
   * @param flag The feature flag to set
   * @param percentage The percentage of users/businesses to enable (0-100)
   */
  public async setRolloutPercentage(flag: FeatureFlag, percentage: number): Promise<void> {
    // Ensure percentage is valid
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }
    
    // Ensure configuration is loaded
    this.ensureConfigLoaded();
    
    // Get or initialize the config for this flag
    if (!this.configCache[flag]) {
      this.configCache[flag] = {
        defaultValue: false,
        rolloutPercentage: percentage
      };
    } else {
      this.configCache[flag].rolloutPercentage = percentage;
    }
    
    // Persist to database
    await this.saveConfiguration();
  }
  
  /**
   * Generates a consistent ID for rollout calculations
   * @param userId User ID
   * @param businessId Business ID
   * @returns A consistent ID string
   */
  private generateId(userId?: string | number, businessId?: string | number): string {
    if (userId && businessId) {
      return `${userId}_${businessId}`;
    } else if (userId) {
      return `user_${userId}`;
    } else if (businessId) {
      return `business_${businessId}`;
    } else {
      // Use a default namespace if no IDs are provided
      return 'default';
    }
  }
  
  /**
   * Generates a hash code from a string
   * @param str String to hash
   * @returns Hash code
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * Ensures the configuration is loaded and not expired
   */
  private ensureConfigLoaded(): void {
    const now = Date.now();
    
    // Reload configuration if cache is expired (every 5 minutes)
    if (now > this.cacheExpiry) {
      this.loadConfiguration();
    }
  }
  
  /**
   * Loads feature flag configuration from database or environment
   */
  private async loadConfiguration(): Promise<void> {
    try {
      // Try to load from database
      const configResult = await this.db.query(
        'SELECT flag_key, config FROM feature_flags'
      );
      
      // Reset cache
      this.configCache = {};
      
      // Process database results
      if (configResult && configResult.rows) {
        for (const row of configResult.rows) {
          try {
            this.configCache[row.flag_key] = JSON.parse(row.config);
          } catch (parseError) {
            console.error(`Error parsing feature flag config for ${row.flag_key}:`, parseError);
          }
        }
      }
      
      // Set cache expiry (5 minutes)
      this.cacheExpiry = Date.now() + 5 * 60 * 1000;
      
      // Apply environment overrides from .env
      this.applyEnvironmentOverrides();
    } catch (error) {
      console.error('Error loading feature flag configuration:', error);
      
      // Set a short cache expiry to retry soon
      this.cacheExpiry = Date.now() + 30 * 1000;
      
      // Apply environment overrides even on error
      this.applyEnvironmentOverrides();
    }
  }
  
  /**
   * Applies environment overrides from .env file
   */
  private applyEnvironmentOverrides(): void {
    // Check for environment variable overrides
    // Format: FEATURE_FLAG_<flag_name>=true/false
    Object.values(FeatureFlag).forEach(flag => {
      const envVarName = `FEATURE_FLAG_${flag}`.toUpperCase();
      const envValue = process.env[envVarName];
      
      if (envValue !== undefined) {
        let value: FlagValue;
        
        // Parse the environment variable value
        if (envValue.toLowerCase() === 'true') {
          value = true;
        } else if (envValue.toLowerCase() === 'false') {
          value = false;
        } else if (!isNaN(Number(envValue))) {
          value = Number(envValue);
        } else {
          value = envValue;
        }
        
        // Initialize config if needed
        if (!this.configCache[flag]) {
          this.configCache[flag] = {
            defaultValue: value
          };
        } else {
          // Override the default value
          this.configCache[flag].defaultValue = value;
        }
      }
      
      // Special handling for Google API flags in development
      if (process.env.NODE_ENV === 'development' && flag === FeatureFlag.UseGoogleBusinessAPI) {
        // If GOOGLE_API_USE_FALLBACK is true, disable the API in development
        if (process.env.GOOGLE_API_USE_FALLBACK === 'true') {
          if (!this.configCache[flag]) {
            this.configCache[flag] = { defaultValue: false };
          } else {
            this.configCache[flag].defaultValue = false;
          }
        }
      }
    });
  }
  
  /**
   * Saves configuration to database
   */
  private async saveConfiguration(): Promise<void> {
    try {
      // Begin transaction
      await this.db.query('BEGIN');
      
      for (const [flag, config] of Object.entries(this.configCache)) {
        // Convert config to JSON
        const configJson = JSON.stringify(config);
        
        // Upsert configuration
        await this.db.query(
          `INSERT INTO feature_flags (flag_key, config) 
           VALUES ($1, $2) 
           ON CONFLICT (flag_key) DO UPDATE SET config = $2`,
          [flag, configJson]
        );
      }
      
      // Commit transaction
      await this.db.query('COMMIT');
      
      // Update cache expiry
      this.cacheExpiry = Date.now() + 5 * 60 * 1000;
    } catch (error) {
      // Rollback transaction on error
      await this.db.query('ROLLBACK');
      console.error('Error saving feature flag configuration:', error);
      
      // Re-throw error
      throw error;
    }
  }
}