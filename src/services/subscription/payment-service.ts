import axios from 'axios';

// Types for Helcim API
interface CustomerData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  companyName?: string;
  address?: {
    street: string;
    city: string;
    province: string;
    country: string;
    postalCode: string;
  };
}

interface CardData {
  cardToken: string;
  cardNumber?: string; // Last 4 digits for display only
  cardExpiry?: string; // MM/YY format
}

interface SubscriptionData {
  customerId: string;
  planId: string;
  quantity: number;
  billingCycle: 'monthly' | 'annual';
  startDate?: string;
  metadata?: Record<string, string>;
}

interface PaymentData {
  customerId: string;
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
}

// Configuration and utility functions
const getApiConfig = () => {
  const apiKey = process.env.HELCIM_API_KEY;
  const accountId = process.env.HELCIM_ACCOUNT_ID;
  const baseURL = process.env.HELCIM_ENVIRONMENT === 'production'
    ? 'https://api.helcim.com/v2'
    : 'https://api.helcim.com/v2/test';

  if (!apiKey || !accountId) {
    throw new Error('Helcim API credentials not configured');
  }

  return {
    baseURL,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Account-Id': accountId
    }
  };
};

// Core payment functions
export const PaymentService = {
  /**
   * Create a new customer in Helcim
   */
  async createCustomer(data: CustomerData): Promise<any> {
    try {
      const config = getApiConfig();
      const response = await axios.post(`${config.baseURL}/customers`, data, { headers: config.headers });
      return {
        success: true,
        customerId: response.data.id,
        message: 'Customer created successfully'
      };
    } catch (error: any) {
      console.error('Error creating customer:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  },

  /**
   * Add a payment method to customer
   */
  async addPaymentMethod(customerId: string, cardData: CardData): Promise<any> {
    try {
      const config = getApiConfig();
      const response = await axios.post(
        `${config.baseURL}/customers/${customerId}/payment-methods`,
        cardData,
        { headers: config.headers }
      );
      return {
        success: true,
        paymentMethodId: response.data.id,
        message: 'Payment method added successfully'
      };
    } catch (error: any) {
      console.error('Error adding payment method:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  },

  /**
   * Create a new subscription
   */
  async createSubscription(data: SubscriptionData): Promise<any> {
    try {
      const config = getApiConfig();
      const response = await axios.post(
        `${config.baseURL}/subscriptions`,
        data,
        { headers: config.headers }
      );
      return {
        success: true,
        subscriptionId: response.data.id,
        status: response.data.status,
        nextBillingDate: response.data.nextBillingDate
      };
    } catch (error: any) {
      console.error('Error creating subscription:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  },

  /**
   * Update an existing subscription
   */
  async updateSubscription(
    subscriptionId: string,
    updates: Partial<SubscriptionData> & { prorate?: boolean }
  ): Promise<any> {
    try {
      const config = getApiConfig();
      const response = await axios.put(
        `${config.baseURL}/subscriptions/${subscriptionId}`,
        updates,
        { headers: config.headers }
      );
      return {
        success: true,
        subscriptionId: response.data.id,
        planId: response.data.planId,
        prorationAmount: response.data.prorationAmount,
        nextBillingDate: response.data.nextBillingDate
      };
    } catch (error: any) {
      console.error('Error updating subscription:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  },

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelImmediately: boolean = false,
    reason?: string
  ): Promise<any> {
    try {
      const config = getApiConfig();
      const response = await axios.post(
        `${config.baseURL}/subscriptions/${subscriptionId}/cancel`,
        {
          cancelImmediately,
          reason
        },
        { headers: config.headers }
      );
      return {
        success: true,
        subscriptionId: response.data.id,
        status: response.data.status,
        effectiveDate: response.data.effectiveDate
      };
    } catch (error: any) {
      console.error('Error canceling subscription:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  },

  /**
   * Process a one-time payment
   */
  async processPayment(data: PaymentData): Promise<any> {
    try {
      const config = getApiConfig();
      const response = await axios.post(
        `${config.baseURL}/payments`,
        data,
        { headers: config.headers }
      );
      return {
        success: true,
        transactionId: response.data.id,
        amount: response.data.amount,
        status: response.data.status
      };
    } catch (error: any) {
      console.error('Error processing payment:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  },

  /**
   * Retrieve customer details
   */
  async getCustomer(customerId: string): Promise<any> {
    try {
      const config = getApiConfig();
      const response = await axios.get(
        `${config.baseURL}/customers/${customerId}`,
        { headers: config.headers }
      );
      return {
        success: true,
        customer: response.data
      };
    } catch (error: any) {
      console.error('Error retrieving customer:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  },

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<any> {
    try {
      const config = getApiConfig();
      const response = await axios.get(
        `${config.baseURL}/subscriptions/${subscriptionId}`,
        { headers: config.headers }
      );
      return {
        success: true,
        subscription: response.data
      };
    } catch (error: any) {
      console.error('Error retrieving subscription:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  },

  /**
   * List customer subscriptions
   */
  async listCustomerSubscriptions(customerId: string): Promise<any> {
    try {
      const config = getApiConfig();
      const response = await axios.get(
        `${config.baseURL}/customers/${customerId}/subscriptions`,
        { headers: config.headers }
      );
      return {
        success: true,
        subscriptions: response.data.items
      };
    } catch (error: any) {
      console.error('Error listing subscriptions:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  },

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(
    payload: any,
    signature: string,
    webhookSecret: string
  ): boolean {
    // Implementation will depend on Helcim's webhook signature format
    // This is a placeholder for the actual implementation
    try {
      // Webhook signature validation logic here
      return true;
    } catch (error) {
      console.error('Error validating webhook signature:', error);
      return false;
    }
  }
};

export default PaymentService;