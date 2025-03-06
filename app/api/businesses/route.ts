import { NextRequest, NextResponse } from 'next/server';
import { createAuthRoute } from '@/lib/auth-middleware';
import AuthService from '@/services/auth-service';
import PostgresService from '@/services/postgres-service';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Proper businesses API endpoints

// Get businesses for the authenticated user
export const GET = createAuthRoute(async (req: NextRequest, userId: number) => {
  try {
    console.log(`Fetching businesses for user ID: ${userId}`);
    
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
    
    // Return businesses list
    return NextResponse.json({
      success: true,
      businesses: result.businesses || []
    }, { status: 200 });
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
    console.log(`Creating new business for user ID: ${userId}`);
    
    // Get auth service
    const authService = AuthService.getInstance();
    
    // Parse request body (with fallback for parsing errors)
    let body;
    try {
      const bodyText = await req.text();
      body = JSON.parse(bodyText);
      console.log('Request body parsed:', { name: body.name ? 'Present' : 'Missing' });
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
      const result = await authService.addBusiness(userId, name);
      
      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error || 'Failed to add business'
        }, { status: 500 });
      }
      
      // Return success with the new business ID
      return NextResponse.json({
        success: true,
        businessId: result.businessId
      }, { status: 201 });
    } catch (error) {
      console.error('Error adding business:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to add business'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Unexpected error adding business:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});