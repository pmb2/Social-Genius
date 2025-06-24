import { NextRequest, NextResponse } from 'next/server';
import { createAuthRoute } from '@/lib/auth/middleware';
import AuthService from '@/services/auth/auth-service';
import PostgresService from '@/services/database/postgres-service';
import { 
  logBrowserOperation, 
  LogLevel, 
  OperationCategory,
  generateTraceId,
  createFunctionContext,
  logFileEntry
} from '@/lib/utilities/browser-logging';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Cache for businesses data (in-memory cache for development, would use Redis in production)
const CACHE_TTL = 60 * 1000; // 1 minute in milliseconds
const businessesCache = new Map<number, { data: any, timestamp: number }>();

// Handle DELETE requests for businesses
export const DELETE = createAuthRoute(async (req: NextRequest, userId: number) => {
  // Generate a unique trace ID for tracking this request
  const traceId = req.traceId || generateTraceId('business-delete');
  
  // Create a function context for enhanced logging
  const { log, logEntry, logExit } = createFunctionContext(
    'DELETE',
    '/app/api/businesses/route.ts',
    OperationCategory.API,
    'business-delete-api',
    traceId
  );
  
  // Log entry with basic request info
  logEntry({
    userId,
    method: req.method,
    url: req.url
  });
  
  try {
    // Get business ID from the request URL
    const url = new URL(req.url);
    const businessId = url.searchParams.get('businessId');
    
    if (!businessId) {
      log(`Missing business ID parameter`, LogLevel.WARN);
      
      const response = NextResponse.json({
        success: false,
        error: 'Business ID is required',
        traceId
      }, { status: 400 });
      
      logExit({ status: 400, success: false });
      return response;
    }
    
    log(`Deleting business ${businessId} for user ID: ${userId}`, LogLevel.INFO);
    
    // Get auth service
    const authService = AuthService.getInstance();
    
    // Delete the business
    const startDelete = Date.now();
    const result = await authService.deleteBusiness(userId, businessId);
    const deleteTime = Date.now() - startDelete;
    
    log(`Business deletion completed in ${deleteTime}ms`, 
      result.success ? LogLevel.INFO : LogLevel.ERROR,
      { success: result.success, error: result.error }
    );
    
    if (!result.success) {
      const response = NextResponse.json({
        success: false,
        error: result.error || 'Failed to delete business',
        traceId
      }, { status: 500 });
      
      logExit({ status: 500, success: false, error: result.error });
      return response;
    }
    
    // Clear cache for this user to ensure fresh data on next fetch
    businessesCache.delete(userId);
    log(`Cache cleared for user ${userId}`, LogLevel.INFO);
    
    // Return success
    const response = NextResponse.json({
      success: true,
      message: 'Business deleted successfully',
      traceId
    }, { 
      status: 200,
      headers: {
        // Add cache control headers to prevent browser caching
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    logExit({ status: 200, success: true });
    return response;
  } catch (error) {
    log(`Error deleting business`, LogLevel.ERROR, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack available'
    });
    
    const response = NextResponse.json({
      success: false,
      error: 'Internal server error',
      traceId
    }, { status: 500 });
    
    logExit({ status: 500, success: false, error }, error);
    return response;
  }
});

// Get businesses for the authenticated user
export const GET = createAuthRoute(async (req: NextRequest, userId: number) => {
  // Generate a unique trace ID for tracking this request
  const traceId = req.traceId || generateTraceId('business-get');
  
  // Create a function context for enhanced logging
  const { log, logEntry, logExit } = createFunctionContext(
    'GET',
    '/app/api/businesses/route.ts',
    OperationCategory.API,
    'business-get-api',
    traceId
  );
  
  // Log entry with basic request info
  logEntry({
    userId,
    method: req.method,
    url: req.url
  });
  
  try {
    // Parse pagination parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const includeSocialAccounts = searchParams.get('includeSocialAccounts') === 'true'; // NEW: Check for this param
    
    log(`Getting businesses for user ${userId}`, LogLevel.INFO, {
      page,
      limit,
      includeSocialAccounts,
      searchParams: Object.fromEntries(searchParams.entries())
    });
    
    // Check cache first
    const cacheKey = userId;
    const cachedData = businessesCache.get(cacheKey);
    const now = Date.now();
    
    // Only use cache if social accounts are NOT requested, or if the cached data already includes them
    if (cachedData && (now - cachedData.timestamp < CACHE_TTL) && (!includeSocialAccounts || cachedData.data.businesses?.[0]?.socialAccounts)) {
      log(`Returning cached businesses data (age: ${now - cachedData.timestamp}ms)`, LogLevel.INFO, {
        businessCount: cachedData.data.businesses?.length || 0,
        cacheAge: now - cachedData.timestamp,
        fromCache: true
      });
      
      const response = NextResponse.json({
        success: true,
        businesses: cachedData.data.businesses || [],
        cached: true,
        traceId
      }, { 
        status: 200,
        headers: {
          'Cache-Control': 'max-age=60', // Browser caching
        }
      });
      
      logExit({ 
        status: 200, 
        success: true, 
        cached: true, 
        businessCount: cachedData.data.businesses?.length || 0 
      });
      
      return response;
    }
    
    // Get services
    const authService = AuthService.getInstance();
    const dbService = PostgresService.getInstance(); // Use PostgresService directly for DB operations
    
    // Fetch businesses from the database for this user
    const startFetch = Date.now();
    const result = await authService.getBusinesses(userId); // This gets basic business info
    const fetchTime = Date.now() - startFetch;
    
    log(`Fetched basic businesses from database in ${fetchTime}ms`, 
      result.success ? LogLevel.INFO : LogLevel.ERROR,
      { 
        success: result.success, 
        businessCount: result.businesses?.length || 0,
        error: result.error 
      }
    );
    
    if (!result.success) {
      const response = NextResponse.json({
        success: false,
        error: result.error || 'Failed to fetch businesses',
        traceId
      }, { status: 500 });
      
      logExit({ status: 500, success: false, error: result.error });
      return response;
    }

    let businessesToReturn = result.businesses || [];

    // NEW: Fetch social accounts if requested
    if (includeSocialAccounts && businessesToReturn.length > 0) {
      log(`Fetching social accounts for ${businessesToReturn.length} businesses`, LogLevel.INFO);
      const socialAccountsFetchStart = Date.now();
      
      businessesToReturn = await Promise.all(businessesToReturn.map(async (business: any) => {
        const socialAccounts = await dbService.getSocialAccountsForBusiness(business.businessId);
        return {
          ...business,
          socialAccounts: socialAccounts.map(acc => ({
            id: acc.id,
            platform: acc.platform,
            username: acc.username,
            profilePictureUrl: acc.profile_picture_url,
          })),
        };
      }));
      const socialAccountsFetchTime = Date.now() - socialAccountsFetchStart;
      log(`Fetched social accounts in ${socialAccountsFetchTime}ms`, LogLevel.INFO);
    }
    
    // Store in cache
    businessesCache.set(cacheKey, {
      data: { businesses: businessesToReturn },
      timestamp: now
    });
    
    log(`Updated cache for user ${userId}`, LogLevel.INFO, {
      businessCount: businessesToReturn.length
    });
    
    // Return businesses list with cache headers
    const response = NextResponse.json({
      success: true,
      businesses: businessesToReturn,
      traceId
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'max-age=60'
      }
    });
    
    logExit({ 
      status: 200, 
      success: true, 
      cached: false, 
      businessCount: businessesToReturn.length 
    });
    
    return response;
  } catch (error) {
    log(`Error getting businesses`, LogLevel.ERROR, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack available'
    });
    
    const response = NextResponse.json({
      success: false,
      error: 'Internal server error',
      traceId
    }, { status: 500 });
    
    logExit({ status: 500, success: false, error }, error);
    return response;
  }
});

// Handle POST requests for business creation
export const POST = createAuthRoute(async (req: NextRequest, userId: number) => {
  // Generate a unique trace ID for tracking this request
  const traceId = req.traceId || generateTraceId('business-post');
  
  // Create a function context for enhanced logging
  const { log, logEntry, logExit } = createFunctionContext(
    'POST',
    '/app/api/businesses/route.ts',
    OperationCategory.API,
    'business-post-api',
    traceId
  );
  
  logEntry({
    userId,
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });
  
  try {
    // Get auth service
    const authService = AuthService.getInstance();
    
    // Parse request body
    let body;
    try {
      const bodyText = await req.text();
      body = JSON.parse(bodyText);
      log(`Request body parsed successfully`, LogLevel.INFO, { 
        name: body.name ? `"${body.name}"` : 'Missing',
        type: body.type || 'Not specified', // Still log if sent, but not used for addBusiness
        bodySize: bodyText.length
      });
    } catch (parseError) {
      log(`Error parsing request body`, LogLevel.ERROR, {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        stack: parseError instanceof Error ? parseError.stack : 'No stack available'
      });
      
      const response = NextResponse.json({ 
        success: false, 
        error: 'Invalid request format. Please provide a valid JSON body.',
        traceId
      }, { status: 400 });
      
      logExit({ status: 400, success: false, error: 'JSON parse error' }, parseError);
      return response;
    }
    
    // Extract and validate business name
    const { name } = body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      log(`Missing or invalid business name`, LogLevel.WARN, { name });
      
      const response = NextResponse.json({ 
        success: false, 
        error: 'Business name is required',
        traceId
      }, { status: 400 });
      
      logExit({ status: 400, success: false, error: 'Missing business name' });
      return response;
    }
    
    // Create business in database
    log(`Creating business for user ID: ${userId} with name "${name}"`, LogLevel.INFO);
    
    const startCreate = Date.now();
    const result = await authService.addBusiness(userId, name.trim()); // Use authService.addBusiness
    const createTime = Date.now() - startCreate;
    
    log(`Business creation completed in ${createTime}ms`, 
      result.success ? LogLevel.INFO : LogLevel.ERROR,
      { success: result.success, businessId: result.businessId, error: result.error }
    );
    
    if (!result.success) {
      log(`Failed to add business: ${result.error}`, LogLevel.ERROR);
      
      const response = NextResponse.json({
        success: false,
        error: result.error || 'Failed to add business',
        traceId
      }, { status: 500 });
      
      logExit({ status: 500, success: false, error: result.error });
      return response;
    }
    
    // Clear cache for this user to ensure fresh data on next fetch
    businessesCache.delete(userId);
    log(`Cache cleared for user ${userId}`, LogLevel.INFO);
    
    const response = NextResponse.json({
      success: true,
      businessId: result.businessId,
      traceId
    }, { 
      status: 201,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    logExit({ 
      status: 201, 
      success: true, 
      businessId: result.businessId 
    });
    
    return response;
  } catch (error) {
    log(`Unexpected error adding business`, LogLevel.ERROR, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack available'
    });
    
    const response = NextResponse.json({
      success: false,
      error: 'Internal server error',
      traceId
    }, { status: 500 });
    
    logExit({ status: 500, success: false, error }, error);
    return response;
  }
});
