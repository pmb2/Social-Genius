/**
 * Subscription plan configuration for Social Genius
 * These plans match the tiers shown on the marketing site
 */

export type PlanFeature = {
  name: string;
  included: boolean;
  limit?: number | string;
  description?: string;
};

export type SubscriptionPlan = {
  id: string;                  // Internal plan ID
  helcimPlanId: string;        // Helcim plan ID
  name: string;                // Display name
  description: string;         // Short description
  price: {
    monthly: number;           // Monthly price per location
    annual: number;            // Annual price per location (discounted)
  };
  locationRange: {
    min: number;               // Minimum locations
    max: number | null;        // Maximum locations (null for unlimited)
  };
  features: PlanFeature[];     // List of included features
  isPopular?: boolean;         // Whether this is the popular/recommended plan
};

// Shared features across all plans
const coreFeatures: PlanFeature[] = [
  { name: 'AI-Driven Post Creation', included: true },
  { name: 'Review Response Automation', included: true },
  { name: 'Basic Analytics', included: true },
  { name: 'Multi-Location Dashboard', included: true },
];

// Plan-specific features
const basicFeatures: PlanFeature[] = [
  ...coreFeatures,
  { name: 'Posts per month', included: true, limit: 4 },
  { name: 'Review responses', included: true, limit: '100/mo' },
  { name: 'Team members', included: true, limit: 2 },
  { name: 'White-label reports', included: false },
  { name: 'Competitor analysis', included: false },
  { name: 'Priority support', included: false },
];

const professionalFeatures: PlanFeature[] = [
  ...coreFeatures,
  { name: 'Posts per month', included: true, limit: 8 },
  { name: 'Review responses', included: true, limit: '500/mo' },
  { name: 'Team members', included: true, limit: 5 },
  { name: 'White-label reports', included: true },
  { name: 'Competitor analysis', included: true, limit: 'Basic' },
  { name: 'Priority support', included: true },
];

const businessFeatures: PlanFeature[] = [
  ...coreFeatures,
  { name: 'Posts per month', included: true, limit: 12 },
  { name: 'Review responses', included: true, limit: 'Unlimited' },
  { name: 'Team members', included: true, limit: 'Unlimited' },
  { name: 'White-label reports', included: true },
  { name: 'Competitor analysis', included: true, limit: 'Advanced' },
  { name: 'Priority support', included: true },
  { name: 'Dedicated account manager', included: true },
];

const enterpriseFeatures: PlanFeature[] = [
  ...coreFeatures,
  { name: 'Posts per month', included: true, limit: 'Custom' },
  { name: 'Review responses', included: true, limit: 'Unlimited' },
  { name: 'Team members', included: true, limit: 'Unlimited' },
  { name: 'White-label reports', included: true },
  { name: 'Competitor analysis', included: true, limit: 'Enterprise' },
  { name: 'Priority support', included: true },
  { name: 'Dedicated account manager', included: true },
  { name: 'Custom integrations', included: true },
  { name: 'API access', included: true },
];

// Export subscription plans
export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'basic',
    helcimPlanId: 'hlm_plan_basic',
    name: 'Basic',
    description: 'Perfect for agencies managing a few locations',
    price: {
      monthly: 199,
      annual: 179,
    },
    locationRange: {
      min: 1,
      max: 10,
    },
    features: basicFeatures,
  },
  {
    id: 'professional',
    helcimPlanId: 'hlm_plan_professional',
    name: 'Professional',
    description: 'Ideal for growing agencies',
    price: {
      monthly: 169,
      annual: 149,
    },
    locationRange: {
      min: 11,
      max: 50,
    },
    features: professionalFeatures,
    isPopular: true,
  },
  {
    id: 'business',
    helcimPlanId: 'hlm_plan_business',
    name: 'Business',
    description: 'For established agencies with multiple locations',
    price: {
      monthly: 119,
      annual: 99,
    },
    locationRange: {
      min: 51,
      max: 250,
    },
    features: businessFeatures,
  },
  {
    id: 'enterprise',
    helcimPlanId: 'hlm_plan_enterprise',
    name: 'Enterprise',
    description: 'Custom solutions for large-scale agencies',
    price: {
      monthly: 0, // Custom pricing
      annual: 0,  // Custom pricing
    },
    locationRange: {
      min: 251,
      max: null, // Unlimited
    },
    features: enterpriseFeatures,
  },
];

/**
 * Helper function to get plan by ID
 */
export function getPlanById(planId: string): SubscriptionPlan | undefined {
  return subscriptionPlans.find(plan => plan.id === planId);
}

/**
 * Helper function to get recommended plan based on location count
 */
export function getRecommendedPlan(locationCount: number): SubscriptionPlan {
  for (const plan of subscriptionPlans) {
    if (plan.locationRange.max === null || locationCount <= plan.locationRange.max) {
      if (locationCount >= plan.locationRange.min) {
        return plan;
      }
    }
  }
  
  // Default to enterprise if location count exceeds all plans
  return subscriptionPlans[subscriptionPlans.length - 1];
}

/**
 * Calculate subscription price based on plan, billing cycle, and quantity
 */
export function calculatePrice(
  planId: string,
  billingCycle: 'monthly' | 'annual',
  quantity: number
): number | null {
  const plan = getPlanById(planId);
  
  if (!plan || plan.price[billingCycle] === 0) {
    return null; // Custom pricing
  }
  
  return plan.price[billingCycle] * quantity;
}