'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../ui/dialog';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { CheckIcon, StarIcon, X } from 'lucide-react';
import { cleanupAfterModalClose, prepareForModalOpen } from '@/lib/ui/modal/cleanup';

interface SubscriptionPlan {
  name: string;
  price: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  buttonText: string;
}

interface SubscriptionPlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: string;
  locationsUsed: number;
  locationsLimit: number;
}

export function SubscriptionPlansModal({
  isOpen,
  onClose,
  currentPlan,
  locationsUsed,
  locationsLimit,
}: SubscriptionPlansModalProps) {
  const router = useRouter();

  const plans: SubscriptionPlan[] = [
    {
      name: "Basic",
      price: "$199/mo per location",
      description: "For small businesses with 1-10 locations",
      features: [
        "Basic AI-driven posting (one post per week)",
        "Response reviews",
        "Detailed analytics",
        "GBP automation",
        "Email support"
      ],
      buttonText: currentPlan === "basic" ? "Current Plan" : "Upgrade"
    },
    {
      name: "Professional",
      price: "$169/mo per location",
      description: "For marketing agencies with 11-50 locations",
      features: [
        "Everything in Basic, plus:",
        "Advanced competitor analytics",
        "Increased posting frequency",
        "Additional social media platforms",
        "Priority support",
        "Bulk operations"
      ],
      isPopular: true,
      buttonText: currentPlan === "professional" ? "Current Plan" : "Upgrade"
    },
    {
      name: "Business",
      price: "$119/mo per location",
      description: "For growing agencies with 51-250 locations",
      features: [
        "Everything in Professional, plus:",
        "Higher posting frequency",
        "Multi-location support",
        "Enriched AI-generated content",
        "Prioritized customer service",
        "Advanced reporting tools"
      ],
      buttonText: currentPlan === "business" ? "Current Plan" : "Upgrade"
    },
    {
      name: "Enterprise",
      price: "Custom Pricing",
      description: "For large enterprises with 251+ locations",
      features: [
        "Everything in Business, plus:",
        "Full customization options",
        "API access",
        "White-labeling",
        "Dedicated support",
        "Multi-location management",
        "Custom integrations",
        "Quarterly strategy sessions",
        "Custom feature development"
      ],
      buttonText: currentPlan === "enterprise" ? "Current Plan" : "Contact Us"
    }
  ];

  const handleUpgrade = (planName: string) => {
    if (planName.toLowerCase() === currentPlan.toLowerCase()) {
      // Already on this plan
      return;
    }
    
    // First close the modal properly
    handleClose();
    
    // Small delay before navigation to ensure modal is fully closed
    setTimeout(() => {
      // Go to subscription page
      router.push('/subscription');
    }, 100);
  };

  // Keep internal state to prevent race conditions between open/close operations
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Synchronize with parent open state
  useEffect(() => {
    if (isOpen && !internalOpen) {
      // Only trigger open if we're currently closed
      setInternalOpen(true);
      // Prepare for opening
      prepareForModalOpen();
    } else if (!isOpen && internalOpen) {
      // We'll use a delay to close to avoid immediate closure
      const timeout = setTimeout(() => {
        setInternalOpen(false);
      }, 50);
      
      return () => clearTimeout(timeout);
    }
  }, [isOpen, internalOpen]);
  
  // Handle explicit close with cleanup
  const handleClose = (open: boolean) => {
    // Only process actual closing events
    if (!open && internalOpen) {
      // First set internal state
      setInternalOpen(false);
      
      // Run cleanup immediately to ensure DOM is in good state
      cleanupAfterModalClose();
      
      // Then notify parent but avoid nested timeouts which cause race conditions
      onClose();
    }
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupAfterModalClose();
    };
  }, []);

  return (
    <Dialog 
      open={internalOpen} 
      onOpenChange={handleClose}
      modal={true} // Ensure it's treated as a true modal
    >
      <DialogContent className="max-w-4xl p-0 overflow-auto max-h-[90vh]">
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
          
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-[#FFAB1A] via-[#FF1681] to-[#0080FF] text-transparent bg-clip-text">
              Subscription Plans
            </DialogTitle>
            <DialogDescription>
              You are currently using {locationsUsed} of {locationsLimit} locations on your {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} plan.
            </DialogDescription>
          </DialogHeader>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 pt-2">
          {plans.map((plan, index) => (
            <div 
              key={index} 
              className={`rounded-xl border shadow-sm overflow-hidden transition-all ${
                currentPlan === plan.name.toLowerCase() 
                  ? 'border-[#FF1681] shadow-[#FF1681]/10' 
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
              } ${plan.isPopular ? 'transform hover:-translate-y-1' : ''}`}
            >
              {plan.isPopular && (
                <div className="bg-[#FF1681] text-white py-1 px-2 text-xs font-medium text-center">
                  MOST POPULAR
                </div>
              )}
              <div className="p-5">
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                <p className="text-2xl font-bold">{plan.price}</p>
                <p className="text-sm text-gray-500 mt-1 mb-4">{plan.description}</p>
                
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex gap-2 text-sm">
                      <CheckIcon className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  className={`w-full ${
                    currentPlan === plan.name.toLowerCase() 
                      ? 'bg-gray-100 text-gray-800 hover:bg-gray-200 cursor-default' 
                      : 'bg-gradient-to-r from-[#FFAB1A] via-[#FF1681] to-[#0080FF] text-white hover:opacity-90'
                  }`}
                  onClick={() => handleUpgrade(plan.name)}
                  disabled={currentPlan === plan.name.toLowerCase()}
                >
                  {plan.buttonText}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}