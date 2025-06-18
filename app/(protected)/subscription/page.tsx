// app/(protected)/subscription/page.tsx

'use client';

import React, { useState } from 'react';
import { SubscriptionSelector } from '@/components/subscription/subscription-selector';
import { PaymentForm } from '@/components/subscription/payment-form';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth/context'; // Import useAuth

enum SubscriptionStep {
  SELECT_PLAN,
  PAYMENT,
  CONFIRMATION
}

export default function SubscriptionPage() {
  const { user, loading } = useAuth(); // Get user and loading state from auth context

  const [currentStep, setCurrentStep] = useState<SubscriptionStep>(SubscriptionStep.SELECT_PLAN);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  // Assuming locationCount comes from user data or is a user input
  const [locationCount, setLocationCount] = useState<number>(user?.businessCount || 1); // Initialize with user's business count or default to 1
  const [customerId, setCustomerId] = useState<string>('');
  const [subscriptionId, setSubscriptionId] = useState<string>('');

  // Determine the current plan ID from the user object
  const currentPlanId = user?.planId; // Assuming user.planId holds the current subscription plan ID

  const handlePlanSelection = (planId: string, cycle: 'monthly' | 'annual') => {
    setSelectedPlan(planId);
    setBillingCycle(cycle);
    setCurrentStep(SubscriptionStep.PAYMENT);
  };

  const handlePaymentComplete = (customerId: string, subscriptionId: string) => {
    setCustomerId(customerId);
    setSubscriptionId(subscriptionId);
    setCurrentStep(SubscriptionStep.CONFIRMATION);
  };

  const handleCancelPayment = () => {
    setCurrentStep(SubscriptionStep.SELECT_PLAN);
  };

  // Show loading state while auth context is loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4 bg-gray-900 text-white min-h-screen"> {/* Added dark background */}
      <h1 className="text-4xl font-extrabold text-center mb-4 text-white">Social Genius Subscription</h1> {/* Adjusted text style */}
      <p className="text-center text-gray-300 mb-10"> {/* Adjusted text color */}
        Choose the plan that best fits your needs
      </p>

      {/* Progress Steps */}
      <div className="flex justify-center mb-10">
        <ol className="flex items-center w-full max-w-3xl">
          <li className={`flex w-full items-center after:content-[''] after:w-full after:h-1 after:border-b after:border-gray-700 after:border-1 after:hidden sm:after:inline-block after:mx-6 xl:after:mx-10 ${ // Adjusted border color
            currentStep >= SubscriptionStep.SELECT_PLAN ? 'text-blue-400' : 'text-gray-500' // Adjusted text color
          }`}>
            <span className={`flex items-center justify-center w-8 h-8 rounded-full border ${
              currentStep >= SubscriptionStep.SELECT_PLAN 
                ? 'border-blue-500 bg-blue-600 text-white' // Adjusted colors
                : 'border-gray-500 text-gray-300' // Adjusted colors
            }`}>
              1
            </span>
            <span className="ml-2 text-sm font-medium">Select Plan</span>
          </li>
          <li className={`flex w-full items-center after:content-[''] after:w-full after:h-1 after:border-b after:border-gray-700 after:border-1 after:hidden sm:after:inline-block after:mx-6 xl:after:mx-10 ${ // Adjusted border color
            currentStep >= SubscriptionStep.PAYMENT ? 'text-blue-400' : 'text-gray-500' // Adjusted text color
          }`}>
            <span className={`flex items-center justify-center w-8 h-8 rounded-full border ${
              currentStep >= SubscriptionStep.PAYMENT 
                ? 'border-blue-500 bg-blue-600 text-white' // Adjusted colors
                : 'border-gray-500 text-gray-300' // Adjusted colors
            }`}>
              2
            </span>
            <span className="ml-2 text-sm font-medium">Payment</span>
          </li>
          <li className={`flex items-center ${
            currentStep >= SubscriptionStep.CONFIRMATION ? 'text-blue-400' : 'text-gray-500' // Adjusted text color
          }`}>
            <span className={`flex items-center justify-center w-8 h-8 rounded-full border ${
              currentStep >= SubscriptionStep.CONFIRMATION 
                ? 'border-blue-500 bg-blue-600 text-white' // Adjusted colors
                : 'border-gray-500 text-gray-300' // Adjusted colors
            }`}>
              3
            </span>
            <span className="ml-2 text-sm font-medium">Confirmation</span>
          </li>
        </ol>
      </div>

      {/* Content based on current step */}
      <div>
        {currentStep === SubscriptionStep.SELECT_PLAN && (
          <SubscriptionSelector 
            onSelectPlan={handlePlanSelection}
            currentPlanId={currentPlanId} // Pass currentPlanId
            locationCount={locationCount}
          />
        )}

        {currentStep === SubscriptionStep.PAYMENT && (
          <PaymentForm 
            planId={selectedPlan}
            billingCycle={billingCycle}
            quantity={locationCount}
            onPaymentComplete={handlePaymentComplete}
            onCancel={handleCancelPayment}
          />
        )}

        {currentStep === SubscriptionStep.CONFIRMATION && (
          <Card className="max-w-2xl mx-auto p-8 text-center bg-gray-800 border border-gray-700"> {/* Adjusted card styling */}
            <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4"> {/* Adjusted background color */}
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">Subscription Activated!</h2> {/* Adjusted text color */}
            <p className="text-gray-300 mb-6"> {/* Adjusted text color */}
              Thank you for subscribing to Social Genius. Your account has been successfully activated.
            </p>
            <div className="bg-gray-700 p-4 rounded-lg mb-6 text-left text-gray-200"> {/* Adjusted background and text color */}
              <div className="mb-2">
                <span className="font-medium">Subscription ID:</span> 
                <span className="ml-2 text-gray-300">{subscriptionId}</span>
              </div>
              <div>
                <span className="font-medium">Customer ID:</span> 
                <span className="ml-2 text-gray-300">{customerId}</span>
              </div>
            </div>
            <div className="space-y-4">
              <a 
                href="/dashboard" 
                className="block w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Go to Dashboard
              </a>
              <a 
                href="/settings/subscription" 
                className="block w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors" // Adjusted button styling
              >
                Manage Subscription
              </a>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
