import { NextRequest, NextResponse } from 'next/server';
import { createAuthRoute } from '@/lib/auth-middleware';
import { authenticateGBP } from '@/services/compliance-service';
import AuthService from '@/services/auth-service';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';
// Force dynamic behavior to prevent static generation errors
export const dynamic = 'force-dynamic';

// Handle POST requests for automatic Google Business Profile login
export const POST = createAuthRoute(async (req: NextRequest, userId: number) => {
  try {
    // Parse the request body
    const body = await req.json();
    const { businessId, retry } = body;
    
    // Check if this is a retry attempt - useful for logging and using alternate methods
    const isRetry = retry === true;
    
    if (!businessId) {
      return NextResponse.json({
        success: false,
        error: 'Business ID is required',
        errorCode: 'MISSING_PARAMETERS'
      }, { status: 400 });
    }
    
    // Get the auth service
    const authService = AuthService.getInstance();
    
    // First check if the business exists and belongs to this user
    const businessesResult = await authService.getBusinesses(userId);
    if (!businessesResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to retrieve business information',
        errorCode: 'BUSINESS_FETCH_FAILED'
      }, { status: 500 });
    }
    
    const business = businessesResult.businesses.find(b => 
      b.id.toString() === businessId || b.businessId === businessId
    );
    
    if (!business) {
      return NextResponse.json({
        success: false,
        error: 'Business not found or not owned by this user',
        errorCode: 'BUSINESS_NOT_FOUND'
      }, { status: 404 });
    }
    
    // Check if we have stored credentials
    const credentials = await authService.getBusinessCredentials(businessId);
    
    if (!credentials) {
      return NextResponse.json({
        success: false,
        error: 'No stored credentials found for this business',
        errorCode: 'NO_CREDENTIALS'
      }, { status: 404 });
    }
    
    // Get the browser instance ID if available
    const browserInstanceId = business.browserInstance || `gbp-${businessId}-${Date.now()}`;
    
    // Get start time for performance tracking
    const startTime = Date.now();
    
    // Add additional logging for debugging
    if (process.env.DEBUG_AUTOMATION === 'true') {
      console.log(`Auto-login attempt for business ID: ${businessId} with browser instance: ${browserInstanceId}`);
    }
    
    // Add alternate login URLs for retry attempts
    const loginOptions = {
      email: credentials.email,
      password: credentials.password,
      persistBrowser: true,
      browserInstanceId,
      // If this is a retry, we'll use different login methods
      useAlternativeUrls: isRetry
    };
    
    // Only log in dev mode for first attempts, always log retries
    if (process.env.NODE_ENV === 'development' && (isRetry || process.env.DEBUG_AUTOMATION === 'true')) {
      const timestamp = new Date().toISOString().split('T')[1].substring(0, 8);
      console.log(`[AUTO-LOGIN ${timestamp}] Attempting ${isRetry ? 'retry' : 'initial'} login for business ID: ${businessId}`);
    }
    
    // Attempt automatic login with stored credentials
    const authResult = await authenticateGBP(
      parseInt(businessId as string), 
      loginOptions
    );
    
    // Record completion time for performance metrics
    const elapsedTimeMs = Date.now() - startTime;
    
    if (process.env.DEBUG_AUTOMATION === 'true') {
      console.log(`Auto-login completed in ${elapsedTimeMs}ms with result: ${authResult.success ? 'success' : 'failure'}`);
      if (!authResult.success) {
        console.warn(`Auto-login error details:`, {
          error: authResult.error,
          errorCode: authResult.errorCode,
          message: authResult.message
        });
      }
    }
    
    if (!authResult.success) {
      // Return more detailed error information for debugging
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Automatic login failed',
        errorCode: authResult.errorCode || 'AUTO_LOGIN_FAILED',
        message: authResult.message || 'Failed to log in automatically with stored credentials',
        timeMs: elapsedTimeMs
      }, { status: 400 });
    }
    
    // Update the business auth status
    await authService.updateBusinessAuthStatus(businessId, 'logged_in', browserInstanceId);
    
    return NextResponse.json({
      success: true,
      message: 'Automatic login successful',
      browserInstanceId,
      timeMs: elapsedTimeMs
    });
  } catch (error) {
    console.error('Error processing automatic login:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
});