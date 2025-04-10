# Payment Integration with Helcim

This document outlines the integration of Helcim as our payment processor for Social Genius, detailing the features, benefits, and implementation plan.

## Why Helcim for Social Genius

Helcim is an excellent choice for our project for several key reasons:

1. **Cost-Effective Pricing Model**: Helcim offers transparent, interchange-plus pricing which is more affordable than Stripe's flat rates, especially for high-volume businesses like our tiered subscription model.

2. **Streamlined Ownership Transfer**: Helcim provides API-based ownership transfer processes, reducing delays and manual interventions during transitions between subscription tiers or when transferring accounts.

3. **Multi-Currency Support**: As we scale internationally, Helcim's support for multiple currencies will be essential for our global client base.

4. **Proactive Fraud Monitoring**: Helcim includes sophisticated fraud detection systems that minimize account freezes or service disruptions, ensuring continuity for our clients.

5. **Customizable Recurring Billing**: Aligns perfectly with our tiered subscription model (Basic/Professional/Business/Enterprise).

## Implementation Plan

### Phase 1: Setup & Configuration (Week 1)

1. **Account Setup**
   - Register for Helcim merchant account
   - Complete verification process
   - Obtain API credentials

2. **Environment Configuration**
   - Add Helcim API keys to environment variables:
     ```
     HELCIM_API_KEY=your_api_key
     HELCIM_ACCOUNT_ID=your_account_id
     HELCIM_ENVIRONMENT=production|sandbox
     ```
   - Update environment validation in `app/api/env-check/route.ts`

3. **Dependency Installation**
   - Install Helcim JavaScript SDK:
     ```bash
     npm install helcim-js-sdk
     ```

### Phase 2: Core API Integration (Week 2)

1. **Create Payment Service**
   - Create service file: `/services/payment-service.ts`
   - Implement core payment functions:
     - createCustomer
     - createSubscription
     - updateSubscription
     - cancelSubscription
     - processPayment

2. **API Route Implementation**
   - Create payment processing routes:
     - `/app/api/payments/create-customer/route.ts`
     - `/app/api/payments/create-subscription/route.ts`
     - `/app/api/payments/update-subscription/route.ts`
     - `/app/api/payments/cancel-subscription/route.ts`
     - `/app/api/payments/process-payment/route.ts`

3. **Data Model Updates**
   - Modify database schema to store:
     - Customer payment IDs
     - Subscription IDs
     - Payment histories
     - Current plan information

### Phase 3: Frontend Integration (Week 3)

1. **Payment Component Development**
   - Create reusable payment components:
     - `/components/payment/payment-form.tsx`
     - `/components/payment/subscription-selector.tsx`
     - `/components/payment/billing-info.tsx`
     - `/components/payment/payment-confirmation.tsx`

2. **Subscription Management UI**
   - Add subscription management interface:
     - Plan selection
     - Upgrade/downgrade options
     - Billing history
     - Payment method management

3. **Error Handling & Validation**
   - Implement comprehensive error handling
   - Add form validation for payment information
   - Create user-friendly error messages

### Phase 4: Webhook Implementation (Week 4)

1. **Setup Webhook Endpoints**
   - Create webhook handler route: `/app/api/payments/webhooks/route.ts`
   - Register webhooks with Helcim for:
     - Subscription created/updated/cancelled
     - Payment succeeded/failed
     - Card expiring notifications

2. **Handle Webhook Events**
   - Implement handlers for each webhook event type
   - Update database records based on webhook data
   - Send notifications for important events

3. **Testing Webhooks**
   - Use Helcim's webhook testing tools
   - Verify proper handling of all event types
   - Set up logging for webhook events

### Phase 5: Testing & Launch (Week 5)

1. **Sandbox Testing**
   - Test complete payment flows in Helcim sandbox
   - Verify subscription creation, updates, and cancellations
   - Test webhook functionality

2. **Integration Testing**
   - Run end-to-end tests for all payment scenarios
   - Test tier upgrades and downgrades
   - Verify proper handling of payment failures

3. **Launch Preparation**
   - Complete security review
   - Update documentation
   - Prepare announcement for clients

## API Endpoints Design

### 1. Create Customer (`/api/payments/create-customer`)

**Purpose:** Register a new customer with Helcim and store their payment information.

**Request:**
- Method: `POST`
- Format: `JSON`
- Parameters:
  - `businessId`: Internal business ID
  - `customerName`: Customer's full name
  - `email`: Customer's email address
  - `paymentDetails`: Card information (tokenized)
  - `billingAddress`: Billing address information

**Response:**
```json
{
  "success": true,
  "customerId": "hlm_cus_123456",
  "message": "Customer created successfully"
}
```

### 2. Create Subscription (`/api/payments/create-subscription`)

**Purpose:** Set up a recurring subscription for a customer.

**Request:**
- Method: `POST`
- Format: `JSON`
- Parameters:
  - `customerId`: Helcim customer ID
  - `planId`: Subscription plan ID
  - `quantity`: Number of locations/seats
  - `billingCycle`: "monthly" or "annual"
  - `startDate`: When to start the subscription

**Response:**
```json
{
  "success": true,
  "subscriptionId": "hlm_sub_123456",
  "status": "active",
  "nextBillingDate": "2025-05-01T00:00:00Z"
}
```

### 3. Update Subscription (`/api/payments/update-subscription`)

**Purpose:** Change subscription plan or details.

**Request:**
- Method: `PUT`
- Format: `JSON`
- Parameters:
  - `subscriptionId`: Helcim subscription ID
  - `planId`: New plan ID (optional)
  - `quantity`: New quantity (optional)
  - `prorate`: Whether to prorate charges (default: true)

**Response:**
```json
{
  "success": true,
  "subscriptionId": "hlm_sub_123456",
  "planId": "business_plan",
  "prorationAmount": 25.50,
  "nextBillingDate": "2025-05-01T00:00:00Z"
}
```

### 4. Cancel Subscription (`/api/payments/cancel-subscription`)

**Purpose:** Cancel an active subscription.

**Request:**
- Method: `POST`
- Format: `JSON`
- Parameters:
  - `subscriptionId`: Helcim subscription ID
  - `cancelImmediately`: Whether to cancel immediately or at period end
  - `reason`: Cancellation reason (optional)

**Response:**
```json
{
  "success": true,
  "subscriptionId": "hlm_sub_123456",
  "status": "cancelled",
  "effectiveDate": "2025-04-30T23:59:59Z"
}
```

### 5. Process One-Time Payment (`/api/payments/process-payment`)

**Purpose:** Process a one-time payment (for add-ons or setup fees).

**Request:**
- Method: `POST`
- Format: `JSON`
- Parameters:
  - `customerId`: Helcim customer ID
  - `amount`: Payment amount
  - `currency`: Payment currency (default: USD)
  - `description`: Payment description

**Response:**
```json
{
  "success": true,
  "transactionId": "hlm_txn_123456",
  "amount": 99.00,
  "status": "completed"
}
```

## Security Considerations

1. **PCI Compliance**
   - Use Helcim's JavaScript SDK for tokenization
   - Never handle raw card data on our servers
   - Ensure TLS 1.2+ for all payment communications

2. **API Key Security**
   - Store API keys in environment variables only
   - Use different keys for development and production
   - Implement key rotation procedures

3. **Webhook Security**
   - Validate webhook signatures
   - Implement idempotency to prevent duplicate processing
   - Set up IP restrictions for webhook endpoints

4. **Data Privacy**
   - Store only necessary payment information
   - Implement proper data retention policies
   - Follow GDPR requirements for payment data

## Testing and Validation

1. **Test Cards**
   - Visa Test: 4242 4242 4242 4242
   - Mastercard Test: 5555 5555 5555 4444
   - Discover Test: 6011 1111 1111 1117

2. **Subscription Testing**
   - Test all subscription flows in sandbox
   - Verify upgrade and downgrade paths
   - Test cancellation and reactivation

3. **Error Handling Tests**
   - Insufficient funds scenarios
   - Card expiration handling
   - Declined transactions

## Future Enhancements

1. **Advanced Analytics**
   - Implement subscription analytics dashboard
   - Track MRR, churn, and LTV metrics
   - Forecast revenue based on subscription data

2. **Multi-Currency Expansion**
   - Add support for EUR, GBP, and other currencies
   - Implement currency conversion display
   - Handle tax requirements for multiple regions

3. **Payment Method Expansion**
   - Add support for ACH/EFT transfers
   - Integrate alternative payment methods
   - Support digital wallets (Apple Pay, Google Pay)