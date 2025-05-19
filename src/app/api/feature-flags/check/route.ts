/**
 * Feature Flag Check API
 * 
 * This endpoint allows clients to check feature flag values from the server.
 * It helps debug feature flag differences between server and client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeatureFlag, FeatureFlagService } from '@/services/feature-flag-service/index';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const flag = url.searchParams.get('flag');
    const userId = url.searchParams.get('userId');
    const businessId = url.searchParams.get('businessId');
    
    // If no flag specified, return all supported flags
    if (!flag) {
      // Get all flag values
      const service = FeatureFlagService.getInstance();
      const results = Object.values(FeatureFlag).reduce((acc, flagName) => {
        acc[flagName] = service.isEnabled(flagName as FeatureFlag, userId || undefined, businessId || undefined);
        return acc;
      }, {} as Record<string, boolean>);
      
      return NextResponse.json({
        success: true,
        flags: results,
        environment: process.env.NODE_ENV || 'unknown'
      });
    }
    
    // Check if the specified flag is valid
    if (!Object.values(FeatureFlag).includes(flag as FeatureFlag)) {
      return NextResponse.json({
        success: false,
        error: `Invalid feature flag: ${flag}`
      }, { status: 400 });
    }
    
    // Get the flag value
    const service = FeatureFlagService.getInstance();
    const isEnabled = service.isEnabled(flag as FeatureFlag, userId || undefined, businessId || undefined);
    
    return NextResponse.json({
      success: true,
      flag,
      isEnabled,
      environment: process.env.NODE_ENV || 'unknown'
    });
  } catch (error) {
    console.error('Error checking feature flag:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}