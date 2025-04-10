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
      customerId, 
      planId, 
      quantity, 
      billingCycle, 
      startDate,
      businessId, 
      metadata 
    } = requestData;

    // Validate required fields
    if (!customerId || !planId || !quantity || !billingCycle) {
      return NextResponse.json({
        success: false,
        error: 'Missing required subscription information'
      }, { status: 400 });
    }

    // Validate billing cycle
    if (billingCycle !== 'monthly' && billingCycle !== 'annual') {
      return NextResponse.json({
        success: false,
        error: 'Invalid billing cycle. Must be "monthly" or "annual"'
      }, { status: 400 });
    }

    // Create subscription data
    const subscriptionData = {
      customerId,
      planId,
      quantity,
      billingCycle,
      startDate,
      metadata: {
        businessId: businessId.toString(),
        ...metadata
      }
    };

    // Create subscription in Helcim
    const result = await PaymentService.createSubscription(subscriptionData);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    // TODO: Update our database with subscription information
    // Example: await db.update('businesses', businessId, { 
    //   subscriptionId: result.subscriptionId,
    //   subscriptionStatus: result.status,
    //   subscriptionPlan: planId,
    //   nextBillingDate: result.nextBillingDate
    // });

    return NextResponse.json({
      success: true,
      subscriptionId: result.subscriptionId,
      status: result.status,
      nextBillingDate: result.nextBillingDate
    });

  } catch (error: any) {
    console.error('Error in create-subscription API:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create subscription'
    }, { status: 500 });
  }
}