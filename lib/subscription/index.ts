// Subscription library exports
export * from './plans';

// Current user subscription status
export interface UserSubscription {
  planId: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  quantity: number;
  billingCycle: 'monthly' | 'annual';
  customerId: string;
  subscriptionId: string;
}

// Helper to check if the user can add more businesses
export function canAddMoreBusinesses(
  currentBusinessCount: number, 
  subscription?: UserSubscription | null
): boolean {
  // If no subscription, use the free tier limit (1)
  if (!subscription) {
    return currentBusinessCount < 1;
  }
  
  // Otherwise check against the plan from the subscription
  const { planId } = subscription;
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
  
  if (!plan) return false;
  
  return currentBusinessCount < plan.businessLimit;
}

// Import plan definitions
import { SUBSCRIPTION_PLANS } from './plans';