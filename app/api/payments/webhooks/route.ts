import { NextRequest, NextResponse } from 'next/server';
import PaymentService from '@/services/payment-service';

// Process Helcim webhook events
export async function POST(request: NextRequest) {
  try {
    // Get the webhook signature from header
    const signature = request.headers.get('x-helcim-signature') || '';
    
    // Get webhook secret from environment variable
    const webhookSecret = process.env.HELCIM_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('Webhook secret not configured');
      return NextResponse.json({ success: false, error: 'Webhook configuration error' }, { status: 500 });
    }

    // Parse the request body
    const payload = await request.json();
    
    // Validate webhook signature
    const isValid = PaymentService.validateWebhookSignature(payload, signature, webhookSecret);
    
    if (!isValid) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
    }

    // Process the event based on type
    const { event, data } = payload;
    
    switch (event) {
      case 'subscription.created':
        await handleSubscriptionCreated(data);
        break;
      
      case 'subscription.updated':
        await handleSubscriptionUpdated(data);
        break;
      
      case 'subscription.cancelled':
        await handleSubscriptionCancelled(data);
        break;
      
      case 'payment.succeeded':
        await handlePaymentSucceeded(data);
        break;
      
      case 'payment.failed':
        await handlePaymentFailed(data);
        break;
      
      case 'customer.updated':
        await handleCustomerUpdated(data);
        break;
      
      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    
    // Still return 200 to avoid Helcim retrying the webhook
    // But log the error for investigation
    return NextResponse.json({ success: true });
  }
}

// Handler functions for different webhook events

async function handleSubscriptionCreated(data: any) {
  // TODO: Update database with new subscription
  // Example: await db.update('businesses', { helcimCustomerId: data.customer.id }, {
  //   subscriptionId: data.id,
  //   subscriptionStatus: data.status,
  //   subscriptionPlan: data.planId,
  //   nextBillingDate: data.nextBillingDate
  // });
  
  console.log('Subscription created:', data.id);
}

async function handleSubscriptionUpdated(data: any) {
  // TODO: Update subscription details in database
  // Example: await db.update('businesses', { subscriptionId: data.id }, {
  //   subscriptionStatus: data.status,
  //   subscriptionPlan: data.planId,
  //   nextBillingDate: data.nextBillingDate
  // });
  
  console.log('Subscription updated:', data.id);
}

async function handleSubscriptionCancelled(data: any) {
  // TODO: Update subscription status in database
  // Example: await db.update('businesses', { subscriptionId: data.id }, {
  //   subscriptionStatus: 'cancelled',
  //   cancellationDate: data.cancelledAt
  // });
  
  console.log('Subscription cancelled:', data.id);
}

async function handlePaymentSucceeded(data: any) {
  // TODO: Record successful payment
  // Example: await db.insert('payments', {
  //   subscriptionId: data.subscriptionId,
  //   amount: data.amount,
  //   status: 'succeeded',
  //   transactionId: data.id,
  //   paymentDate: data.createdAt
  // });
  
  console.log('Payment succeeded:', data.id);
}

async function handlePaymentFailed(data: any) {
  // TODO: Record failed payment and notify user
  // Example: await db.insert('payments', {
  //   subscriptionId: data.subscriptionId,
  //   amount: data.amount,
  //   status: 'failed',
  //   transactionId: data.id,
  //   failureReason: data.failureReason,
  //   paymentDate: data.createdAt
  // });
  
  // TODO: Send notification email to customer
  // await sendPaymentFailureNotification(data.customer.email, data);
  
  console.log('Payment failed:', data.id);
}

async function handleCustomerUpdated(data: any) {
  // TODO: Update customer details in database
  // Example: await db.update('businesses', { helcimCustomerId: data.id }, {
  //   paymentMethod: data.defaultPaymentMethod ? 'updated' : 'none'
  // });
  
  console.log('Customer updated:', data.id);
}