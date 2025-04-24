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
    
    log(`Getting businesses for user ${userId}`, LogLevel.INFO, {
      page,
      limit,
      searchParams: Object.fromEntries(searchParams.entries())
    });
    
    // Check cache first
    const cacheKey = userId;
    const cachedData = businessesCache.get(cacheKey);
    const now = Date.now();
    
    if (cachedData && (now - cachedData.timestamp < CACHE_TTL)) {
      log(`Returning cached businesses data (age: ${now - cachedData.timestamp}ms)`, LogLevel.INFO, {
        businessCount: cachedData.data.businesses?.length || 0,
        cacheAge: now - cachedData.timestamp
      });
      
      // Return cached data if it's fresh
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
    
    // Get auth service
    const authService = AuthService.getInstance();
    
    // Fetch businesses from the database for this user
    const startFetch = Date.now();
    const result = await authService.getBusinesses(userId);
    const fetchTime = Date.now() - startFetch;
    
    log(`Fetched businesses from database in ${fetchTime}ms`, 
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
    
    // Store in cache
    businessesCache.set(cacheKey, {
      data: result,
      timestamp: now
    });
    
    log(`Updated cache for user ${userId}`, LogLevel.INFO, {
      businessCount: result.businesses?.length || 0
    });
    
    // Return businesses list with cache headers
    const response = NextResponse.json({
      success: true,
      businesses: result.businesses || [],
      traceId
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'max-age=60' // Browser caching
      }
    });
    
    logExit({ 
      status: 200, 
      success: true, 
      cached: false, 
      businessCount: result.businesses?.length || 0 
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

// Add a new business for the authenticated user
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
  
  try {
    // Log entry with basic request info
    logEntry({
      userId,
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString(),
      userIdType: typeof userId
    });
    
    log(`Creating new business for user ID: ${userId}, type: ${typeof userId}`, LogLevel.INFO);
    
    // Double check user id and ensure it's a valid number
    if (!userId || isNaN(Number(userId))) {
      log(`Invalid user ID: ${userId}`, LogLevel.ERROR, {
        userId,
        userIdType: typeof userId
      });
      
      // Enhanced safe cookie access pattern - always check if cookies exists first
      const cookieHeader = req.headers.get('cookie') || '';
      // Safe cookie access using our enhanced pattern 
      const allCookies = req.cookies ? Array.from(req.cookies.getAll()) : [];
      const cookieNames = allCookies.map(c => c.name);
      
      // Check if we have particular cookies of interest
      const hasSessionCookie = allCookies.some(c => c.name === 'session' || c.name === 'sessionId');
      
      log(`Session cookie not found before adding business`, LogLevel.ERROR, {
        cookiesPresent: allCookies.length > 0,
        sessionCookiePresent: hasSessionCookie,
        cookieNames: cookieNames.join(', '),
        cookieHeader: cookieHeader ? 'Present' : 'Missing',
        cookieHeaderLength: cookieHeader.length
      });
      
      // Check for alternative authentication methods
      const authHeader = req.headers.get('authorization');
      const xSessionHeader = req.headers.get('x-session-id');
      
      if (authHeader) {
        log(`Authorization header present: ${authHeader.substring(0, 15)}...`, LogLevel.INFO);
      }
      
      if (xSessionHeader) {
        log(`X-Session-Id header present: ${xSessionHeader.substring(0, 8)}...`, LogLevel.INFO);
      }
      
      // Session recovery attempt - get cookie from cookie header directly
      let recoveredSessionId = null;
      let recoveredSession = null;
      
      if (cookieHeader) {
        const sessionMatch = cookieHeader.match(/session=([^;]+)/);
        const sessionIdMatch = cookieHeader.match(/sessionId=([^;]+)/);
        recoveredSessionId = sessionMatch?.[1] || sessionIdMatch?.[1];
        
        if (recoveredSessionId) {
          log(`Recovered session ID from cookie header: ${recoveredSessionId.substring(0, 8)}...`, LogLevel.INFO);
          
          // Try to verify this session directly
          try {
            const authService = AuthService.getInstance();
            const sessionVerified = await authService.verifySession(recoveredSessionId, traceId);
            
            if (sessionVerified) {
              log(`Session recovery successful! User ID: ${sessionVerified.user_id}`, LogLevel.INFO, {
                recoveredUserId: sessionVerified.user_id,
                userEmail: sessionVerified.user_email
              });
              
              recoveredSession = sessionVerified;
              
              // Return with the recovered user ID
              const response = NextResponse.json({ 
                success: false, 
                error: 'Session found but not properly validated. Please try again.',
                recoveryPossible: true,
                traceId,
                context: {
                  recoveredSessionId: recoveredSessionId.substring(0, 8) + '...',
                  recoveredUserId: sessionVerified.user_id
                }
              }, { status: 401 });
              
              logExit({ 
                status: 401, 
                success: false, 
                recoveryPossible: true,
                recoveredUserId: sessionVerified.user_id
              });
              
              return response;
            } else {
              log(`Session recovery attempted but verification failed`, LogLevel.WARN);
            }
          } catch (recoveryError) {
            log(`Error during session recovery attempt`, LogLevel.ERROR, {
              error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
              stack: recoveryError instanceof Error ? recoveryError.stack : 'No stack available'
            });
          }
        }
      }
      
      const response = NextResponse.json({ 
        success: false, 
        error: 'Invalid or expired session. Please refresh the page and try again.',
        traceId,
        context: {
          cookiesPresent: allCookies.length > 0,
          sessionCookiePresent: hasSessionCookie,
          authHeaderPresent: !!authHeader,
          xSessionIdPresent: !!xSessionHeader,
          requestTime: new Date().toISOString(),
          cookieHeader: cookieHeader ? 'Present' : 'Missing',
          cookieHeaderLength: cookieHeader.length,
          recoveryAttempted: recoveredSessionId !== null,
          recoverySuccessful: recoveredSession !== null
        }
      }, { status: 401 });
      
      logExit({ 
        status: 401, 
        success: false, 
        recoveryAttempted: recoveredSessionId !== null,
        recoverySuccessful: recoveredSession !== null 
      });
      
      return response;
    }
    
    // Convert to number if it's a string (sometimes happens with NextJS)
    const userIdNum = Number(userId);
    log(`User ID validated as number: ${userIdNum}`, LogLevel.INFO);
    
    // Get auth service
    const authService = AuthService.getInstance();
    
    // Parse request body (with fallback for parsing errors)
    let body;
    try {
      const bodyStartTime = Date.now();
      const bodyText = await req.text();
      body = JSON.parse(bodyText);
      const bodyParseTime = Date.now() - bodyStartTime;
      
      log(`Request body parsed successfully in ${bodyParseTime}ms`, LogLevel.INFO, { 
        name: body.name ? `"${body.name}"` : 'Missing',
        type: body.type || 'Not specified',
        authPending: body.authPending || false,
        email: body.email ? 'Present' : 'Not provided',
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
    
    // Extract and validate business data
    const { name } = body;
    
    if (!name) {
      log(`Missing required field: name`, LogLevel.WARN, { body });
      
      const response = NextResponse.json({ 
        success: false, 
        error: 'Business name is required',
        traceId
      }, { status: 400 });
      
      logExit({ status: 400, success: false, error: 'Missing business name' });
      return response;
    }
    
    // Create business in database
    try {
      log(`Creating business for user ${userIdNum} with name "${name}"`, LogLevel.INFO);
      
      // Create the business with validated userId
      const startCreate = Date.now();
      const result = await authService.addBusiness(userIdNum, name);
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
      businessesCache.delete(userIdNum);
      log(`Cache cleared for user ${userIdNum}`, LogLevel.INFO);
      
      // Add session cookie to response if it's missing from the request
      // This helps with session continuity in case the client lost its cookie
      const response = NextResponse.json({
        success: true,
        businessId: result.businessId,
        traceId
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
      log(`Business created successfully with ID: ${result.businessId}`, LogLevel.INFO);
      
      logExit({ 
        status: 201, 
        success: true, 
        businessId: result.businessId 
      });
      
      return response;
    } catch (error) {
      log(`Error adding business`, LogLevel.ERROR, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack available'
      });
      
      const response = NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add business',
        traceId
      }, { status: 500 });
      
      logExit({ status: 500, success: false, error }, error);
      return response;
    }
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