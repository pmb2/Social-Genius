// src/components/subscription/subscription-selector.tsx

import React, { useState, useEffect } from 'react'; // Add useEffect
import { subscriptionPlans, SubscriptionPlan } from '@/services/subscription/plans';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Check } from 'lucide-react';
// Assuming a Badge component exists or creating a simple one
// If you have a pre-existing Badge component, import it here:
// import { Badge } from '@/components/ui/badge'; 

interface SubscriptionSelectorProps {
  onSelectPlan: (planId: string, billingCycle: 'monthly' | 'annual') => void;
  currentPlanId?: string; // Added currentPlanId
  locationCount?: number;
}

export function SubscriptionSelector({
  onSelectPlan,
  currentPlanId, // Destructure currentPlanId
  locationCount = 1,
}: SubscriptionSelectorProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  // Initialize selectedPlanId with currentPlanId if available, otherwise 'basic'
  const [selectedPlanId, setSelectedPlanId] = useState<string>(currentPlanId || 'basic');

  // Update selectedPlanId if currentPlanId changes (e.g., user logs in or plan changes externally)
  useEffect(() => {
    if (currentPlanId && selectedPlanId !== currentPlanId) {
      setSelectedPlanId(currentPlanId);
    }
  }, [currentPlanId, selectedPlanId]);

  // Filter plans based on location count
  const filteredPlans = subscriptionPlans.filter(plan => {
    // Don't include enterprise in selector unless it's the current plan
    if (plan.id === 'enterprise' && plan.id !== currentPlanId) return false;
    
    return locationCount >= plan.locationRange.min && 
           (plan.locationRange.max === null || locationCount <= plan.locationRange.max);
  });

  const handlePlanSelect = (planId: string) => {
    setSelectedPlanId(planId);
  };

  const handleProceed = () => {
    onSelectPlan(selectedPlanId, billingCycle);
  };

  // Calculate annual savings percentage
  const getAnnualSavings = (plan: SubscriptionPlan) => {
    if (plan.price.annual === 0 || plan.price.monthly === 0) return 0;
    const monthlyCost = plan.price.monthly * 12;
    const annualCost = plan.price.annual; // Annual price is already for the year
    const savings = monthlyCost - annualCost;
    return Math.round((savings / monthlyCost) * 100);
  };

  // Determine the selected plan object
  const selectedPlan = subscriptionPlans.find(plan => plan.id === selectedPlanId);
  const currentPlan = subscriptionPlans.find(plan => plan.id === currentPlanId);

  // Determine button text for the main action button
  let mainButtonText = 'Continue with Payment';
  if (selectedPlan && currentPlan && selectedPlan.id !== currentPlan.id) {
    const selectedPrice = selectedPlan.price[billingCycle];
    const currentPrice = currentPlan.price[billingCycle];
    if (selectedPrice > currentPrice) {
      mainButtonText = `Upgrade to ${selectedPlan.name}`;
    } else if (selectedPrice < currentPrice) {
      mainButtonText = `Downgrade to ${selectedPlan.name}`;
    } else {
      mainButtonText = `Change to ${selectedPlan.name}`; // Same price, different plan
    }
  } else if (selectedPlan && !currentPlan) {
    mainButtonText = `Select ${selectedPlan.name} Plan`;
  }


  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Billing Cycle Selector */}
      <div className="flex items-center justify-center mb-8 gap-3">
        <span className={`${billingCycle === 'monthly' ? 'font-medium text-white' : 'text-gray-400'}`}> {/* Adjusted text color */}
          Monthly
        </span>
        <Switch
          checked={billingCycle === 'annual'}
          onCheckedChange={(checked) => setBillingCycle(checked ? 'annual' : 'monthly')}
          className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-600" // Added switch styling
        />
        <span className={`${billingCycle === 'annual' ? 'font-medium text-white' : 'text-gray-400'}`}> {/* Adjusted text color */}
          Annual
          <span className="ml-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full"> {/* Adjusted badge color */}
            Save up to 20%
          </span>
        </span>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredPlans.map((plan) => {
          const isCurrentPlan = plan.id === currentPlanId;
          const isSelected = plan.id === selectedPlanId;

          return (
            <Card
              key={plan.id}
              className={`p-6 cursor-pointer transition-all duration-200 border-2 ${
                isCurrentPlan
                  ? 'border-green-500 shadow-lg bg-green-900/20' // Highlight current plan
                  : isSelected
                  ? 'border-blue-500 shadow-lg bg-blue-900/20' // Highlight selected plan
                  : 'border-gray-700 hover:border-gray-500 bg-gray-800/50' // Default styling
              } ${plan.isPopular ? 'relative' : ''}`}
              onClick={() => !isCurrentPlan && handlePlanSelect(plan.id)} // Prevent selecting current plan
            >
              {plan.isPopular && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white px-4 py-1 text-sm font-medium rounded-bl-lg rounded-tr-lg">
                  POPULAR
                </div>
              )}
              {isCurrentPlan && (
                <div className="absolute top-0 left-0 bg-green-500 text-white px-4 py-1 text-sm font-medium rounded-br-lg rounded-tl-lg">
                  CURRENT PLAN
                </div>
              )}
              
              <h3 className="text-white text-xl font-bold mt-4">{plan.name}</h3> {/* Adjusted text color and margin */}
              <p className="text-sm text-gray-400 mb-4">{plan.description}</p> {/* Adjusted text color */}
              
              <div className="mb-6">
                <span className="text-white text-3xl font-bold"> {/* Adjusted text color */}
                  ${plan.price[billingCycle]}
                </span>
                <span className="text-gray-400 ml-1">per location/month</span> {/* Adjusted text color */}
                
                {billingCycle === 'annual' && getAnnualSavings(plan) > 0 && (
                  <div className="text-green-400 text-sm mt-1"> {/* Adjusted text color */}
                    Save {getAnnualSavings(plan)}% with annual billing
                  </div>
                )}
              </div>
              
              <div className="text-sm mb-6">
                <div className="font-medium text-white">For {plan.locationRange.min}-{plan.locationRange.max === null ? '∞' : plan.locationRange.max} locations</div> {/* Adjusted text color */}
              </div>
              
              <div className="space-y-3 mb-6">
                {plan.features
                  .filter(feature => feature.included)
                  .map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300"> {/* Adjusted text color */}
                        {feature.name}
                        {feature.limit && <span className="text-gray-400 ml-1">({feature.limit})</span>} {/* Adjusted text color */}
                      </span>
                    </div>
                  ))}
              </div>
              
              <Button
                className={`w-full ${isCurrentPlan ? 'bg-gray-600 text-gray-300 cursor-not-allowed' : isSelected ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isCurrentPlan) {
                    handlePlanSelect(plan.id);
                  }
                }}
                disabled={isCurrentPlan}
              >
                {isCurrentPlan ? 'Current Plan' : isSelected ? 'Selected' : 'Select Plan'}
              </Button>
            </Card>
          );
        })}
      </div>
      
      {/* Action Button */}
      <div className="mt-8 text-center">
        <Button
          size="lg"
          onClick={handleProceed}
          className="px-8 bg-blue-600 hover:bg-blue-700 text-white" // Ensure consistent button styling
          disabled={selectedPlanId === currentPlanId} // Disable if current plan is selected
        >
          {mainButtonText}
        </Button>
        <p className="text-sm text-gray-400 mt-2"> {/* Adjusted text color */}
          You can change your plan at any time
        </p>
      </div>
    </div>
  );
}
