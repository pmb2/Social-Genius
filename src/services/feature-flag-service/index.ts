/**
 * Conditional export for feature flag service
 * Uses browser-compatible version on client and server version on server
 */

// Import the FeatureFlag enum and both service classes
// Re-export the enum
export { FeatureFlag } from '../feature-flag-service';
import { FeatureFlagService as ServerFeatureFlagService } from '../feature-flag-service';
import { FeatureFlagService as BrowserFeatureFlagService } from '../feature-flag-service.browser';

// Create a proxy class that will conditionally use the appropriate implementation
class FeatureFlagServiceProxy {
  private static instance: any;

  public static getInstance(): any {
    if (!FeatureFlagServiceProxy.instance) {
      // Check if we're in a browser environment
      if (typeof window !== 'undefined') {
        // Browser environment - use browser-compatible implementation
        FeatureFlagServiceProxy.instance = BrowserFeatureFlagService.getInstance();
      } else {
        // Server environment - use server implementation
        FeatureFlagServiceProxy.instance = ServerFeatureFlagService.getInstance();
      }
    }
    return FeatureFlagServiceProxy.instance;
  }
}

// Export the proxy class as FeatureFlagService
export const FeatureFlagService = FeatureFlagServiceProxy;