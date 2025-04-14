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
    description: 'Perfect for small businesses just getting started',
    features: [
      'Up to 5 business profiles',
      'Basic compliance monitoring',
      'Brand alignment checks',
      'Limited competitor research'
    ],
    priceMonthly: 29.99,
    priceAnnual: 299.99,
    businessLimit: 5
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Ideal for growing businesses',
    features: [
      'Up to 20 business profiles',
      'Advanced compliance monitoring',
      'Full brand alignment analysis',
      'Competitor research & monitoring',
      'Priority support'
    ],
    priceMonthly: 79.99,
    priceAnnual: 799.99,
    businessLimit: 20,
    isPopular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For agencies and large businesses',
    features: [
      'Unlimited business profiles',
      'Full compliance suite with alerts',
      'Advanced brand alignment tools',
      'Comprehensive competitor intelligence',
      'API access',
      'Dedicated support',
      'Custom integration options'
    ],
    priceMonthly: 199.99,
    priceAnnual: 1999.99,
    businessLimit: 9999
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