// src/services/subscription/plans.ts

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  features: {
    name: string;
    included: boolean;
    limit?: string;
  }[];
  price: {
    monthly: number;
    annual: number;
  };
  locationRange: {
    min: number;
    max: number | null;
  };
  isPopular?: boolean;
}

// Define subscription plans
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    description: 'For small businesses with 1-10 locations',
    features: [
      { name: 'Basic AI-driven posting', included: true, limit: 'one post per week' },
      { name: 'Response reviews', included: true },
      { name: 'Detailed analytics', included: true },
      { name: 'GBP automation', included: true },
      { name: 'Email support', included: true }
    ],
    price: {
      monthly: 199,
      annual: 2149, // 10% discount for annual
    },
    locationRange: {
      min: 1,
      max: 10
    }
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'For marketing agencies with 11-50 locations',
    features: [
      { name: 'Everything in Basic', included: true },
      { name: 'Advanced competitor analytics', included: true },
      { name: 'Increased posting frequency', included: true },
      { name: 'Additional social media platforms', included: true },
      { name: 'Priority support', included: true },
      { name: 'Bulk operations', included: true }
    ],
    price: {
      monthly: 169,
      annual: 1825, // 10% discount for annual
    },
    locationRange: {
      min: 11,
      max: 50
    },
    isPopular: true
  },
  {
    id: 'business',
    name: 'Business',
    description: 'For growing agencies with 51-250 locations',
    features: [
      { name: 'Everything in Professional', included: true },
      { name: 'Higher posting frequency', included: true },
      { name: 'Multi-location support', included: true },
      { name: 'Enriched AI-generated content', included: true },
      { name: 'Prioritized customer service', included: true },
      { name: 'Advanced reporting tools', included: true }
    ],
    price: {
      monthly: 119,
      annual: 1285, // 10% discount for annual
    },
    locationRange: {
      min: 51,
      max: 250
    }
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large enterprises with 251+ locations',
    features: [
      { name: 'Everything in Business', included: true },
      { name: 'Full customization options', included: true },
      { name: 'API access', included: true },
      { name: 'White-labeling', included: true },
      { name: 'Dedicated support', included: true },
      { name: 'Multi-location management', included: true },
      { name: 'Custom integrations', included: true },
      { name: 'Quarterly strategy sessions', included: true },
      { name: 'Custom feature development', included: true }
    ],
    price: {
      monthly: 0, // Custom pricing
      annual: 0, // Custom pricing
    },
    locationRange: {
      min: 251,
      max: null // Essentially unlimited
    }
  }
];

// Helper functions to get plan information
export function getPlanById(id: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find(plan => plan.id === id);
}

export function calculatePlanPrice(planId: string, billingCycle: 'monthly' | 'annual', quantity: number = 1): number {
  const plan = getPlanById(planId);
  if (!plan) return 0;
  
  const basePrice = billingCycle === 'monthly' ? plan.price.monthly : plan.price.annual;
  return basePrice * quantity;
}

export function getNextTierPlan(currentPlanId: string): SubscriptionPlan | undefined {
  const currentIndex = SUBSCRIPTION_PLANS.findIndex(plan => plan.id === currentPlanId);
  if (currentIndex === -1 || currentIndex === SUBSCRIPTION_PLANS.length - 1) {
    return undefined;
  }
  return SUBSCRIPTION_PLANS[currentIndex + 1];
}

// Export an alias for the subscription plans for backward compatibility
export const subscriptionPlans = SUBSCRIPTION_PLANS;
