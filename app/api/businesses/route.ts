import { NextRequest, NextResponse } from 'next/server';
import { createAuthRoute } from '@/lib/auth-middleware';
import AuthService from '@/services/auth-service';
import PostgresService from '@/services/postgres-service';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Proper businesses API endpoints

// Handle DELETE requests for businesses
export const DELETE = createAuthRoute(async (req: NextRequest, userId: number) => {
  try {
    // Get business ID from the request URL
    const url = new URL(req.url);
    const businessId = url.searchParams.get('businessId');
    
    if (!businessId) {
      return NextResponse.json({
        success: false,
        error: 'Business ID is required'
      }, { status: 400 });
    }
    
    console.log(`Deleting business ${businessId} for user ID: ${userId}`);
    
    // Get auth service
    const authService = AuthService.getInstance();
    
    // Delete the business
    const result = await authService.deleteBusiness(userId, businessId);
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to delete business'
      }, { status: 500 });
    }
    
    // Clear cache for this user to ensure fresh data on next fetch
    businessesCache.delete(userId);
    
    // Return success
    return NextResponse.json({
      success: true,
      message: 'Business deleted successfully'
    }, { 
      status: 200,
      headers: {
        // Add cache control headers to prevent browser caching
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error deleting business:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

// Get businesses for the authenticated user
// Cache for businesses data (in-memory cache for development, would use Redis in production)
const CACHE_TTL = 60 * 1000; // 1 minute in milliseconds
const businessesCache = new Map<number, { data: any, timestamp: number }>();

export const GET = createAuthRoute(async (req: NextRequest, userId: number) => {
  try {
    // Parse pagination parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    
    // Check cache first
    const cacheKey = userId;
    const cachedData = businessesCache.get(cacheKey);
    const now = Date.now();
    
    if (cachedData && (now - cachedData.timestamp < CACHE_TTL)) {
      // Return cached data if it's fresh
      return NextResponse.json({
        success: true,
        businesses: cachedData.data.businesses || [],
        cached: true
      }, { 
        status: 200,
        headers: {
          'Cache-Control': 'max-age=60', // Browser caching
        }
      });
    }
    
    // Get auth service
    const authService = AuthService.getInstance();
    
    // Fetch businesses from the database for this user
    const result = await authService.getBusinesses(userId);
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to fetch businesses'
      }, { status: 500 });
    }
    
    // Store in cache
    businessesCache.set(cacheKey, {
      data: result,
      timestamp: now
    });
    
    // Return businesses list with cache headers
    return NextResponse.json({
      success: true,
      businesses: result.businesses || []
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'max-age=60' // Browser caching
      }
    });
  } catch (error) {
    console.error('Error getting businesses:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

// Add a new business for the authenticated user
export const POST = createAuthRoute(async (req: NextRequest, userId: number) => {
  try {
    console.log(`Creating new business for user ID: ${userId}, type: ${typeof userId}`);
    
    // Double check user id and ensure it's a valid number
    if (!userId || isNaN(Number(userId))) {
      console.error(`POST business: userId is invalid: ${userId}, type: ${typeof userId}`);
      
      // Check request cookies and headers to diagnose authentication issues
      const cookieHeader = req.headers.get('cookie') || '';
      const cookies = Array.from(req.cookies.getAll());
      const cookieNames = cookies.map(c => c.name);
      
      console.error(`Authentication context: Session cookie present: ${
        cookies.some(c => c.name === 'session' || c.name === 'sessionId')
      }, Cookie names: [${cookieNames.join(', ')}]`);
      
      // Check if we have an Authorization header that might contain a token
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        console.log(`Authorization header present: ${authHeader.substring(0, 15)}...`);
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid or expired session. Please refresh the page and try again.',
        context: {
          cookiesPresent: cookieNames.length > 0,
          sessionCookiePresent: cookies.some(c => c.name === 'session' || c.name === 'sessionId'),
          authHeaderPresent: !!authHeader,
          xSessionIdPresent: !!req.headers.get('x-session-id')
        }
      }, { status: 401 });
    }
    
    // Convert to number if it's a string (sometimes happens with NextJS)
    const userIdNum = Number(userId);
    
    // Get auth service
    const authService = AuthService.getInstance();
    
    // Parse request body (with fallback for parsing errors)
    let body;
    try {
      const bodyText = await req.text();
      body = JSON.parse(bodyText);
      console.log('Request body parsed:', { 
        name: body.name ? `"${body.name}"` : 'Missing',
        type: body.type || 'Not specified',
        authPending: body.authPending || false,
        email: body.email ? 'Present' : 'Not provided'
      });
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid request format. Please provide a valid JSON body.' 
      }, { status: 400 });
    }
    
    // Extract and validate business data
    const { name } = body;
    
    if (!name) {
      return NextResponse.json({ 
        success: false, 
        error: 'Business name is required' 
      }, { status: 400 });
    }
    
    // Create business in database
    try {
      console.log(`Creating business for user ${userIdNum} with name "${name}"`);
      
      // Create the business with validated userId
      const result = await authService.addBusiness(userIdNum, name);
      console.log('Business creation result:', result);
      
      if (!result.success) {
        console.error(`Failed to add business: ${result.error}`);
        return NextResponse.json({
          success: false,
          error: result.error || 'Failed to add business'
        }, { status: 500 });
      }
      
      // Clear cache for this user to ensure fresh data on next fetch
      businessesCache.delete(userIdNum);
      
      // Add session cookie to response if it's missing from the request
      // This helps with session continuity in case the client lost its cookie
      const response = NextResponse.json({
        success: true,
        businessId: result.businessId
      }, { 
        status: 201,
        headers: {
          // Add cache control headers to prevent browser caching
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      // Return success with the new business ID
      console.log(`Business created successfully with ID: ${result.businessId}`);
      return response;
    } catch (error) {
      console.error('Error adding business:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add business'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Unexpected error adding business:', error);
    console.error(error instanceof Error ? error.stack : 'No stack available');
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});