'use client';

import React, { useState } from 'react';
import { SubscriptionSelector } from '@/components/subscription/subscription-selector';
import { PaymentForm } from '@/components/subscription/payment-form';
import { Card } from '@/components/ui/card';

enum SubscriptionStep {
  SELECT_PLAN,
  PAYMENT,
  CONFIRMATION
}

export default function SubscriptionPage() {
  const [currentStep, setCurrentStep] = useState<SubscriptionStep>(SubscriptionStep.SELECT_PLAN);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [locationCount, setLocationCount] = useState<number>(1);
  const [customerId, setCustomerId] = useState<string>('');
  const [subscriptionId, setSubscriptionId] = useState<string>('');

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

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold text-center mb-2">Social Genius Subscription</h1>
      <p className="text-center text-gray-600 mb-10">
        Choose the plan that best fits your needs
      </p>

      {/* Progress Steps */}
      <div className="flex justify-center mb-10">
        <ol className="flex items-center w-full max-w-3xl">
          <li className={`flex w-full items-center after:content-[''] after:w-full after:h-1 after:border-b after:border-gray-200 after:border-1 after:hidden sm:after:inline-block after:mx-6 xl:after:mx-10 ${
            currentStep >= SubscriptionStep.SELECT_PLAN ? 'text-blue-600' : 'text-gray-500'
          }`}>
            <span className={`flex items-center justify-center w-8 h-8 rounded-full border ${
              currentStep >= SubscriptionStep.SELECT_PLAN 
                ? 'border-blue-600 bg-blue-600 text-white' 
                : 'border-gray-500'
            }`}>
              1
            </span>
            <span className="ml-2 text-sm font-medium">Select Plan</span>
          </li>
          <li className={`flex w-full items-center after:content-[''] after:w-full after:h-1 after:border-b after:border-gray-200 after:border-1 after:hidden sm:after:inline-block after:mx-6 xl:after:mx-10 ${
            currentStep >= SubscriptionStep.PAYMENT ? 'text-blue-600' : 'text-gray-500'
          }`}>
            <span className={`flex items-center justify-center w-8 h-8 rounded-full border ${
              currentStep >= SubscriptionStep.PAYMENT 
                ? 'border-blue-600 bg-blue-600 text-white' 
                : 'border-gray-500'
            }`}>
              2
            </span>
            <span className="ml-2 text-sm font-medium">Payment</span>
          </li>
          <li className={`flex items-center ${
            currentStep >= SubscriptionStep.CONFIRMATION ? 'text-blue-600' : 'text-gray-500'
          }`}>
            <span className={`flex items-center justify-center w-8 h-8 rounded-full border ${
              currentStep >= SubscriptionStep.CONFIRMATION 
                ? 'border-blue-600 bg-blue-600 text-white' 
                : 'border-gray-500'
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
          <Card className="max-w-2xl mx-auto p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Subscription Activated!</h2>
            <p className="text-gray-600 mb-6">
              Thank you for subscribing to Social Genius. Your account has been successfully activated.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mb-6 text-left">
              <div className="mb-2">
                <span className="font-medium">Subscription ID:</span> 
                <span className="ml-2 text-gray-600">{subscriptionId}</span>
              </div>
              <div>
                <span className="font-medium">Customer ID:</span> 
                <span className="ml-2 text-gray-600">{customerId}</span>
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
                className="block w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors"
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