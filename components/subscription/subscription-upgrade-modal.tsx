'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../ui/dialog';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { subscriptionPlans } from '../../lib/subscription/plans';

interface SubscriptionUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: string;
  requiredPlan: string;
  limitType: 'locations' | 'feature';
  currentCount?: number;
}

export function SubscriptionUpgradeModal({
  isOpen,
  onClose,
  currentPlan,
  requiredPlan,
  limitType,
  currentCount,
}: SubscriptionUpgradeModalProps) {
  const router = useRouter();

  const currentPlanDetails = subscriptionPlans.find((plan) => plan.id === currentPlan);
  const requiredPlanDetails = subscriptionPlans.find((plan) => plan.id === requiredPlan);

  const handleUpgrade = () => {
    router.push('/subscription');
    onClose();
  };

  if (!currentPlanDetails || !requiredPlanDetails) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <div className="relative">
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 h-8 w-8 rounded-full bg-white border shadow-md hover:bg-gray-50 z-10"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
          
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#FF1681]">
              Upgrade Your Plan
            </DialogTitle>
            <DialogDescription>
            {limitType === 'locations' ? (
              <>
                You've reached the limit of {currentPlanDetails.businessLimit} locations for your {currentPlanDetails.name} plan.
                Upgrade to the {requiredPlanDetails.name} plan to add more locations and unlock additional features.
              </>
            ) : (
              <>
                This feature is only available on the {requiredPlanDetails.name} plan or higher.
                Upgrade now to unlock this feature and more!
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-medium">{requiredPlanDetails.name} Plan</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-2">${requiredPlanDetails.priceMonthly}/month per location</p>
            <ul className="space-y-2">
              {requiredPlanDetails.features.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
              {limitType === 'locations' && (
                <li className="flex items-center font-medium">
                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Up to {requiredPlanDetails.businessLimit === 9999 ? 'unlimited' : requiredPlanDetails.businessLimit} locations
                </li>
              )}
            </ul>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="mr-2">
            Maybe Later
          </Button>
          <Button onClick={handleUpgrade} className="bg-[#FF1681] hover:bg-[#FF1681]/90">
            Upgrade Now
          </Button>
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}