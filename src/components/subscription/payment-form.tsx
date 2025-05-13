import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { getPlanById } from '@/services/subscription/plans';

interface PaymentFormProps {
  planId: string;
  billingCycle: 'monthly' | 'annual';
  quantity: number;
  onPaymentComplete: (customerId: string, subscriptionId: string) => void;
  onCancel: () => void;
}

export function PaymentForm({
  planId,
  billingCycle,
  quantity,
  onPaymentComplete,
  onCancel
}: PaymentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    cardNumber: '',
    cardExpiry: '',
    cardCvc: '',
    address: {
      line1: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US'
    }
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const plan = getPlanById(planId);
  
  if (!plan) {
    return <div>Invalid plan selected</div>;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData({
        ...formData,
        [parent]: {
          ...(formData as any)[parent],
          [child]: value
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Basic validation
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    // Card validation
    if (!formData.cardNumber) {
      newErrors.cardNumber = 'Card number is required';
    } else if (!/^\d{16}$/.test(formData.cardNumber.replace(/\s/g, ''))) {
      newErrors.cardNumber = 'Card number is invalid';
    }
    
    if (!formData.cardExpiry) {
      newErrors.cardExpiry = 'Expiration date is required';
    } else if (!/^\d{2}\/\d{2}$/.test(formData.cardExpiry)) {
      newErrors.cardExpiry = 'Format should be MM/YY';
    }
    
    if (!formData.cardCvc) {
      newErrors.cardCvc = 'CVC is required';
    } else if (!/^\d{3,4}$/.test(formData.cardCvc)) {
      newErrors.cardCvc = 'CVC is invalid';
    }
    
    // Address validation
    if (!formData.address.line1) newErrors['address.line1'] = 'Address is required';
    if (!formData.address.city) newErrors['address.city'] = 'City is required';
    if (!formData.address.state) newErrors['address.state'] = 'State is required';
    if (!formData.address.postal_code) newErrors['address.postal_code'] = 'ZIP code is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Step 1: Create customer
      const customerResponse = await fetch('/api/payments/create-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          companyName: formData.company,
          address: {
            street: formData.address.line1,
            city: formData.address.city,
            province: formData.address.state,
            country: formData.address.country,
            postalCode: formData.address.postal_code,
          },
        }),
      });
      
      const customerData = await customerResponse.json();
      
      if (!customerData.success) {
        throw new Error(customerData.error || 'Failed to create customer');
      }
      
      // In a real implementation, you would use Helcim.js to tokenize card data
      // This is a mock implementation that simulates that process
      const cardToken = 'tok_' + Math.random().toString(36).substring(2, 15);
      
      // Step 2: Add payment method
      const paymentMethodResponse = await fetch('/api/payments/add-payment-method', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customerData.customerId,
          cardToken,
          cardNumber: formData.cardNumber.slice(-4), // Only send last 4 digits for display
          cardExpiry: formData.cardExpiry,
        }),
      });
      
      const paymentMethodData = await paymentMethodResponse.json();
      
      if (!paymentMethodData.success) {
        throw new Error(paymentMethodData.error || 'Failed to add payment method');
      }
      
      // Step 3: Create subscription
      const subscriptionResponse = await fetch('/api/payments/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customerData.customerId,
          planId: planId,
          quantity: quantity,
          billingCycle: billingCycle,
          metadata: {
            billingCycle: billingCycle,
          }
        }),
      });
      
      const subscriptionData = await subscriptionResponse.json();
      
      if (!subscriptionData.success) {
        throw new Error(subscriptionData.error || 'Failed to create subscription');
      }
      
      // Complete the payment process
      onPaymentComplete(customerData.customerId, subscriptionData.subscriptionId);
      
    } catch (error: any) {
      console.error('Payment error:', error);
      setErrors({
        form: error.message || 'An error occurred while processing your payment.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price);
  };

  // Calculate total
  const unitPrice = plan.price[billingCycle];
  const totalAmount = unitPrice * quantity;
  const billingLabel = billingCycle === 'annual' 
    ? `annually (${formatPrice(totalAmount * 12)} per year)` 
    : 'monthly';

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Payment Form */}
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.form && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {errors.form}
              </div>
            )}
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Personal Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className={errors.firstName ? 'border-red-500' : ''}
                  />
                  {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
                </div>
                
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className={errors.lastName ? 'border-red-500' : ''}
                  />
                  {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              </div>
              
              <div>
                <Label htmlFor="company">Company Name (Optional)</Label>
                <Input
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            
            <div className="space-y-4 mt-8">
              <h3 className="text-lg font-medium">Payment Information</h3>
              
              <div>
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input
                  id="cardNumber"
                  name="cardNumber"
                  placeholder="1234 5678 9012 3456"
                  value={formData.cardNumber}
                  onChange={handleInputChange}
                  className={errors.cardNumber ? 'border-red-500' : ''}
                />
                {errors.cardNumber && <p className="text-red-500 text-sm mt-1">{errors.cardNumber}</p>}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cardExpiry">Expiration Date</Label>
                  <Input
                    id="cardExpiry"
                    name="cardExpiry"
                    placeholder="MM/YY"
                    value={formData.cardExpiry}
                    onChange={handleInputChange}
                    className={errors.cardExpiry ? 'border-red-500' : ''}
                  />
                  {errors.cardExpiry && <p className="text-red-500 text-sm mt-1">{errors.cardExpiry}</p>}
                </div>
                
                <div>
                  <Label htmlFor="cardCvc">CVC</Label>
                  <Input
                    id="cardCvc"
                    name="cardCvc"
                    placeholder="123"
                    value={formData.cardCvc}
                    onChange={handleInputChange}
                    className={errors.cardCvc ? 'border-red-500' : ''}
                  />
                  {errors.cardCvc && <p className="text-red-500 text-sm mt-1">{errors.cardCvc}</p>}
                </div>
              </div>
            </div>
            
            <div className="space-y-4 mt-8">
              <h3 className="text-lg font-medium">Billing Address</h3>
              
              <div>
                <Label htmlFor="address.line1">Address</Label>
                <Input
                  id="address.line1"
                  name="address.line1"
                  value={formData.address.line1}
                  onChange={handleInputChange}
                  className={errors['address.line1'] ? 'border-red-500' : ''}
                />
                {errors['address.line1'] && <p className="text-red-500 text-sm mt-1">{errors['address.line1']}</p>}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="address.city">City</Label>
                  <Input
                    id="address.city"
                    name="address.city"
                    value={formData.address.city}
                    onChange={handleInputChange}
                    className={errors['address.city'] ? 'border-red-500' : ''}
                  />
                  {errors['address.city'] && <p className="text-red-500 text-sm mt-1">{errors['address.city']}</p>}
                </div>
                
                <div>
                  <Label htmlFor="address.state">State</Label>
                  <Input
                    id="address.state"
                    name="address.state"
                    value={formData.address.state}
                    onChange={handleInputChange}
                    className={errors['address.state'] ? 'border-red-500' : ''}
                  />
                  {errors['address.state'] && <p className="text-red-500 text-sm mt-1">{errors['address.state']}</p>}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="address.postal_code">ZIP Code</Label>
                  <Input
                    id="address.postal_code"
                    name="address.postal_code"
                    value={formData.address.postal_code}
                    onChange={handleInputChange}
                    className={errors['address.postal_code'] ? 'border-red-500' : ''}
                  />
                  {errors['address.postal_code'] && <p className="text-red-500 text-sm mt-1">{errors['address.postal_code']}</p>}
                </div>
                
                <div>
                  <Label htmlFor="address.country">Country</Label>
                  <Input
                    id="address.country"
                    name="address.country"
                    value={formData.address.country}
                    onChange={handleInputChange}
                    disabled
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-4 mt-8">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : `Pay ${formatPrice(totalAmount)}`}
              </Button>
            </div>
          </form>
        </div>
        
        {/* Order Summary */}
        <div className="md:col-span-1">
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Order Summary</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Plan</span>
                <span className="font-medium">{plan.name}</span>
              </div>
              
              <div className="flex justify-between">
                <span>Locations</span>
                <span className="font-medium">{quantity}</span>
              </div>
              
              <div className="flex justify-between">
                <span>Price per location</span>
                <span className="font-medium">{formatPrice(unitPrice)}/month</span>
              </div>
              
              <div className="flex justify-between">
                <span>Billing cycle</span>
                <span className="font-medium">{billingCycle === 'annual' ? 'Annual' : 'Monthly'}</span>
              </div>
              
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>{formatPrice(totalAmount)} {billingLabel}</span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 text-xs text-gray-500">
              <p>By proceeding with this purchase, you agree to our Terms of Service and Privacy Policy.</p>
              <p className="mt-2">You can cancel or change your subscription at any time from your account settings.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}