import React, { useState } from 'react';
import { subscriptionPlans, SubscriptionPlan } from '@/lib/subscription/plans';
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
  const [selectedPlanId, setSelectedPlanId] = useState<string>(currentPlanId || 'basic');

  // Filter plans based on location count
  const filteredPlans = subscriptionPlans.filter(plan => {
    // Don't include enterprise in selector
    if (plan.id === 'enterprise') return false;
    
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
    const annualCost = plan.price.annual * 12;
    return Math.round((monthlyCost - annualCost) / monthlyCost * 100);
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Billing Cycle Selector */}
      <div className="flex items-center justify-center mb-8 gap-3">
        <span className={`${billingCycle === 'monthly' ? 'font-medium' : 'text-gray-500'}`}>
          Monthly
        </span>
        <Switch
          checked={billingCycle === 'annual'}
          onCheckedChange={(checked) => setBillingCycle(checked ? 'annual' : 'monthly')}
        />
        <span className={`${billingCycle === 'annual' ? 'font-medium' : 'text-gray-500'}`}>
          Annual
          <span className="ml-1 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
            Save up to 20%
          </span>
        </span>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredPlans.map((plan) => (
          <Card
            key={plan.id}
            className={`p-6 cursor-pointer transition-all ${
              selectedPlanId === plan.id 
                ? 'ring-2 ring-blue-500 shadow-lg' 
                : 'hover:shadow-md'
            } ${plan.isPopular ? 'relative' : ''}`}
            onClick={() => handlePlanSelect(plan.id)}
          >
            {plan.isPopular && (
              <div className="absolute top-0 right-0 bg-blue-500 text-white px-4 py-1 text-sm font-medium rounded-bl-lg rounded-tr-lg">
                POPULAR
              </div>
            )}
            
            <h3 className="text-xl font-bold">{plan.name}</h3>
            <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
            
            <div className="mb-6">
              <span className="text-3xl font-bold">
                ${plan.price[billingCycle]}
              </span>
              <span className="text-gray-600 ml-1">per location/month</span>
              
              {billingCycle === 'annual' && getAnnualSavings(plan) > 0 && (
                <div className="text-green-600 text-sm mt-1">
                  Save {getAnnualSavings(plan)}% with annual billing
                </div>
              )}
            </div>
            
            <div className="text-sm mb-6">
              <div className="font-medium mb-2">For {plan.locationRange.min}-{plan.locationRange.max || '∞'} locations</div>
            </div>
            
            <div className="space-y-3 mb-6">
              {plan.features
                .filter(feature => feature.included)
                .map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>
                      {feature.name}
                      {feature.limit && <span className="text-gray-600 ml-1">({feature.limit})</span>}
                    </span>
                  </div>
                ))}
            </div>
            
            <Button
              className={`w-full ${selectedPlanId === plan.id ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
              onClick={(e) => {
                e.stopPropagation();
                handlePlanSelect(plan.id);
              }}
            >
              {selectedPlanId === plan.id ? 'Selected' : 'Select Plan'}
            </Button>
          </Card>
        ))}
      </div>
      
      {/* Action Button */}
      <div className="mt-8 text-center">
        <Button
          size="lg"
          onClick={handleProceed}
          className="px-8"
        >
          Continue with {billingCycle === 'annual' ? 'Annual' : 'Monthly'} Billing
        </Button>
        <p className="text-sm text-gray-500 mt-2">
          You can change your plan at any time
        </p>
      </div>
    </div>
  );
}