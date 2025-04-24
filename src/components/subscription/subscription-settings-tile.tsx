'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { subscriptionPlans } from '@/services/subscription/plans';

export function SubscriptionSettingsTile() {
  const { user } = useAuth();
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [businessCount, setBusinessCount] = useState(0);

  useEffect(() => {
    if (user) {
      // Set subscription plan
      const subscription = user.subscription || 'basic';
      const plan = subscriptionPlans.find(p => p.id === subscription);
      setCurrentPlan(plan || subscriptionPlans[0]);
      
      // Get business count from auth context
      setBusinessCount(user.businessProfiles?.length || 0);
      
      setLoading(false);
    }
  }, [user]);

  const handleManageSubscription = () => {
    router.push('/subscription');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Loading subscription details...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">{currentPlan?.name} Plan</h3>
              <p className="text-sm text-gray-500">${currentPlan?.priceMonthly}/month per location</p>
            </div>
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
              Active
            </span>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Plan Features:</h4>
            <ul className="space-y-1 text-sm">
              {currentPlan?.features.map((feature: string, index: number) => (
                <li key={index} className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
            <p className="text-sm">
              <span className="font-medium">Locations:</span> {businessCount} / {currentPlan?.businessLimit === 9999 ? 'Unlimited' : currentPlan?.businessLimit}
            </p>
          </div>

          <Button 
            onClick={handleManageSubscription} 
            className="w-full bg-[#FF1681] hover:bg-[#FF1681]/90"
          >
            Manage Subscription
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}