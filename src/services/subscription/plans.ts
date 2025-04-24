// Subscription plan definitions

export interface Plan {
  id: string;
  name: string;
  description: string;
  features: string[];
  priceMonthly: number;
  priceAnnual: number;
  businessLimit: number;
  isPopular?: boolean;
}

// Define subscription plans
export const SUBSCRIPTION_PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    description: 'For small businesses with 1-10 locations',
    features: [
      'Basic AI-driven posting (one post per week)',
      'Response reviews',
      'Detailed analytics',
      'GBP automation',
      'Email support'
    ],
    priceMonthly: 199,
    priceAnnual: 2149, // 10% discount for annual
    businessLimit: 10
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'For marketing agencies with 11-50 locations',
    features: [
      'Everything in Basic, plus:',
      'Advanced competitor analytics',
      'Increased posting frequency',
      'Additional social media platforms',
      'Priority support',
      'Bulk operations'
    ],
    priceMonthly: 169,
    priceAnnual: 1825, // 10% discount for annual
    businessLimit: 50,
    isPopular: true
  },
  {
    id: 'business',
    name: 'Business',
    description: 'For growing agencies with 51-250 locations',
    features: [
      'Everything in Professional, plus:',
      'Higher posting frequency',
      'Multi-location support',
      'Enriched AI-generated content',
      'Prioritized customer service',
      'Advanced reporting tools'
    ],
    priceMonthly: 119,
    priceAnnual: 1285, // 10% discount for annual
    businessLimit: 250
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large enterprises with 251+ locations',
    features: [
      'Everything in Business, plus:',
      'Full customization options',
      'API access',
      'White-labeling',
      'Dedicated support',
      'Multi-location management',
      'Custom integrations',
      'Quarterly strategy sessions',
      'Custom feature development'
    ],
    priceMonthly: 0, // Custom pricing
    priceAnnual: 0, // Custom pricing
    businessLimit: 9999 // Essentially unlimited
  }
];

// Helper functions to get plan information
export function getPlanById(id: string): Plan | undefined {
  return SUBSCRIPTION_PLANS.find(plan => plan.id === id);
}

export function calculatePlanPrice(planId: string, billingCycle: 'monthly' | 'annual', quantity: number = 1): number {
  const plan = getPlanById(planId);
  if (!plan) return 0;
  
  const basePrice = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceAnnual;
  return basePrice * quantity;
}

export function getNextTierPlan(currentPlanId: string): Plan | undefined {
  const currentIndex = SUBSCRIPTION_PLANS.findIndex(plan => plan.id === currentPlanId);
  if (currentIndex === -1 || currentIndex === SUBSCRIPTION_PLANS.length - 1) {
    return undefined;
  }
  return SUBSCRIPTION_PLANS[currentIndex + 1];
}

// Export an alias for the subscription plans for backward compatibility
export const subscriptionPlans = SUBSCRIPTION_PLANS;