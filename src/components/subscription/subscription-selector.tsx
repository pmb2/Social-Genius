// src/components/subscription/subscription-selector.tsx

import React, { useState, useEffect } from 'react';
import { subscriptionPlans, SubscriptionPlan } from '@/services/subscription/plans';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Check } from 'lucide-react';

interface SubscriptionSelectorProps {
  onSelectPlan: (planId: string, billingCycle: 'monthly' | 'annual') => void;
  currentPlanId?: string;
  locationCount?: number;
}

export function SubscriptionSelector({
  onSelectPlan,
  currentPlanId,
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
    // or if the locationCount is within its range and it's the only suitable plan
    const isEnterprise = plan.id === 'enterprise';
    const isCurrentEnterprise = isEnterprise && plan.id === currentPlanId;
    const isSuitableForEnterprise = locationCount >= plan.locationRange.min && (plan.locationRange.max === null || locationCount <= plan.locationRange.max);

    if (isEnterprise && !isCurrentEnterprise && !isSuitableForEnterprise) {
      return false; // Hide enterprise if not current and not suitable
    }
    
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
    const annualCost = plan.price.annual;
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
        <span className={`${billingCycle === 'monthly' ? 'font-medium text-white' : 'text-gray-400'}`}>
          Monthly
        </span>
        <Switch
          checked={billingCycle === 'annual'}
          onCheckedChange={(checked) => setBillingCycle(checked ? 'annual' : 'monthly')}
          className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-600"
        />
        <span className={`${billingCycle === 'annual' ? 'font-medium text-white' : 'text-gray-400'}`}>
          Annual
          <span className="ml-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
            Save up to 10%
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
              className={`p-6 cursor-pointer transition-all duration-200 border-2 rounded-xl ${ // Added rounded-xl for more rounded corners
                isCurrentPlan
                  ? 'border-green-500 shadow-lg bg-green-900/20'
                  : isSelected
                  ? 'border-blue-500 shadow-lg bg-blue-900/20'
                  : 'border-gray-700 hover:border-gray-500 bg-gray-800/50'
              } ${plan.isPopular ? 'relative' : ''}`}
              onClick={() => !isCurrentPlan && handlePlanSelect(plan.id)}
            >
              {plan.isPopular && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white px-4 py-1 text-sm font-medium rounded-bl-lg rounded-tr-xl"> {/* Adjusted rounded corner */}
                  POPULAR
                </div>
              )}
              {isCurrentPlan && (
                <div className="absolute top-0 left-0 bg-green-500 text-white px-4 py-1 text-sm font-medium rounded-br-lg rounded-tl-xl"> {/* Adjusted rounded corner */}
                  CURRENT PLAN
                </div>
              )}
              
              <h3 className="text-white text-2xl font-bold mt-4 mb-2">{plan.name}</h3> {/* Increased font size, adjusted margin */}
              <p className="text-sm text-gray-400 mb-4">{plan.description}</p>
              
              <div className="mb-6">
                <span className="text-white text-4xl font-bold"> {/* Increased font size */}
                  ${plan.price[billingCycle]}
                </span>
                <span className="text-gray-400 ml-1">/location/month</span> {/* Clarified unit */}
                
                {billingCycle === 'annual' && getAnnualSavings(plan) > 0 && (
                  <div className="text-green-400 text-sm mt-1">
                    Save {getAnnualSavings(plan)}% with annual billing
                  </div>
                )}
              </div>
              
              <div className="text-sm mb-6">
                <div className="font-medium text-white">For {plan.locationRange.min}-{plan.locationRange.max === null ? '∞' : plan.locationRange.max} locations</div>
              </div>
              
              <div className="space-y-3 mb-6">
                {plan.features
                  .filter(feature => feature.included)
                  .map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300">
                        {feature.name}
                        {feature.limit && <span className="text-gray-400 ml-1">({feature.limit})</span>}
                      </span>
                    </div>
                  ))}
              </div>
              
              <Button
                className={`w-full py-2.5 text-base rounded-lg ${ // Adjusted padding, font size, and rounded corners
                  isCurrentPlan ? 'bg-gray-600 text-gray-300 cursor-not-allowed' : isSelected ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}
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
      <div className="mt-10 text-center"> {/* Increased top margin */}
        <Button
          size="lg"
          onClick={handleProceed}
          className="px-10 py-3.5 text-lg rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold" // Enhanced styling
          disabled={selectedPlanId === currentPlanId}
        >
          {mainButtonText}
        </Button>
        <p className="text-sm text-gray-400 mt-2">
          You can change your plan at any time
        </p>
      </div>
    </div>
  );
}
