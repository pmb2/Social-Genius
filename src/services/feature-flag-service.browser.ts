/**
 * Browser-compatible Feature Flag Service
 * 
 * Client-side version of the feature flag service that doesn't depend on direct 
 * database connections, using localStorage for caching instead.
 */

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
  private configCache: Record<string, FeatureFlagConfig> = {};
  private cacheExpiry: number = 0;
  
  private constructor() {
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
    // Client-side always defaults to true for Google OAuth flags
    if (flag === FeatureFlag.GoogleAuthWithOAuth) {
      return true;
    }
    
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
    
    // Check environment override - use 'development' by default in browser
    const environment = 'development';
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
   * Loads feature flag configuration from localStorage or defaults
   */
  private loadConfiguration(): void {
    try {
      // Try to load from localStorage if available
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedConfig = localStorage.getItem('feature_flags');
        if (storedConfig) {
          try {
            this.configCache = JSON.parse(storedConfig);
            this.cacheExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes
            return;
          } catch (parseError) {
            console.error('Error parsing stored feature flags:', parseError);
          }
        }
      }
      
      // Set default values if localStorage not available or empty
      this.configCache = {
        [FeatureFlag.UseGoogleBusinessAPI]: {
          defaultValue: true,
          environmentOverrides: {
            production: true,
            development: true
          }
        },
        [FeatureFlag.GoogleAuthWithOAuth]: {
          defaultValue: true,
          environmentOverrides: {
            production: true,
            development: true
          }
        },
        [FeatureFlag.GooglePostsWithAPI]: {
          defaultValue: true,
          environmentOverrides: {
            production: true,
            development: true
          }
        },
        [FeatureFlag.GoogleReviewsWithAPI]: {
          defaultValue: true,
          environmentOverrides: {
            production: true,
            development: true
          }
        },
        [FeatureFlag.EnableNewDashboard]: {
          defaultValue: true
        },
        [FeatureFlag.EnableNotifications]: {
          defaultValue: true
        }
      };
      
      this.cacheExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes
    } catch (error) {
      console.error('Error loading feature flag configuration:', error);
      
      // Set a short cache expiry to retry soon
      this.cacheExpiry = Date.now() + 30 * 1000;
    }
  }
}