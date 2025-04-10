import { NextRequest, NextResponse } from 'next/server';
import PaymentService from '@/services/payment-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    // Parse request body
    const requestData = await request.json();
    const { 
      firstName, 
      lastName, 
      email, 
      phone, 
      companyName, 
      address, 
      businessId 
    } = requestData;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return NextResponse.json({
        success: false,
        error: 'Missing required customer information'
      }, { status: 400 });
    }

    // Create customer in Helcim
    const customerData = {
      firstName,
      lastName,
      email,
      phone,
      companyName,
      address
    };

    const result = await PaymentService.createCustomer(customerData);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    // TODO: Store the Helcim customer ID in our database
    // This would link to the user or business in our system
    // Example: await db.update('businesses', businessId, { helcimCustomerId: result.customerId });

    return NextResponse.json({
      success: true,
      customerId: result.customerId,
      message: result.message
    });

  } catch (error: any) {
    console.error('Error in create-customer API:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create customer'
    }, { status: 500 });
  }
}