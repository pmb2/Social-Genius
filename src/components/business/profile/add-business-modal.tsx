/**
 * Add Business Modal
 * 
 * Improved modal with Google OAuth integration that matches the app's styling.
 * This modal allows users to add a business by connecting with Google Business Profile.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/lib/ui/useToast';
import { FeatureFlag, FeatureFlagService } from '@/services/feature-flag-service/index';

export interface AddBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId?: string | number;
}

export const AddBusinessModal = ({ isOpen, onClose, onSuccess, userId }: AddBusinessModalProps) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [businessData, setBusinessData] = useState({
    businessName: '',
    businessType: 'local',
  });
  const [error, setError] = useState('');
  const { toast } = useToast();
  
  // Check if OAuth is enabled
  const featureFlags = FeatureFlagService.getInstance();
  const useOAuth = featureFlags.isEnabled(FeatureFlag.GoogleAuthWithOAuth, userId);
  
  // Reset form when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setBusinessData({
        businessName: '',
        businessType: 'local',
      });
      setStep(1);
      setError('');
    }
  }, [isOpen]);
  
  const handleInputChange = (e) => {
    setBusinessData({
      ...businessData,
      [e.target.name]: e.target.value
    });
  };
  
  const handleNext = () => {
    if (!businessData.businessName) {
      setError('Please enter a business name');
      return;
    }
    
    setError('');
    setStep(2);
  };
  
  // Handle OAuth-based authentication flow
  const handleGoogleSignIn = async () => {
    if (!businessData.businessName.trim()) {
      setError('Please enter a business name');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      // Get auth URL from backend without checking credentials first
      // This avoids database connection issues in the browser
      const response = await fetch('/api/google-auth/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessName: businessData.businessName.trim(),
          businessType: businessData.businessType
        }),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        console.error('Error response from auth URL endpoint:', data);
        throw new Error(data.error || 'Failed to generate authentication URL');
      }
      
      // Redirect to Google OAuth
      window.location.href = data.url;
    } catch (err) {
      console.error('Error initiating Google sign-in:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to Google');
      toast({
        title: 'Authentication Error',
        description: err instanceof Error ? err.message : 'Failed to connect to Google',
        variant: 'destructive'
      });
      setIsLoading(false);
    }
  };
  
  // Fallback to legacy authentication if needed
  const handleLegacySubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      // Check session cookies before submitting
      const hasSessionCookie = document.cookie.split(';').some(cookie => 
        cookie.trim().startsWith('session=') || cookie.trim().startsWith('sessionId=')
      );
      
      if (!hasSessionCookie) {
        await fetch('/api/auth/session', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
      }
      
      // Legacy flow - redirect to browser auth flow prep page
      const response = await fetch('/api/compliance/auth-prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessName: businessData.businessName.trim(),
          businessType: businessData.businessType
        }),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to prepare authentication');
      }
      
      // Close modal and redirect to the legacy auth flow
      onClose();
      window.location.href = data.redirectUrl;
    } catch (error) {
      console.error('Authentication error:', error);
      
      let userErrorMessage = '';
      if (error instanceof Error) {
        userErrorMessage = error.message;
      } else {
        userErrorMessage = 'An unexpected error occurred. Please try again later.';
      }
      
      setError(userErrorMessage);
      setIsLoading(false);
    }
  };
  
  const handleAuthSuccess = () => {
    toast({
      title: 'Business Added',
      description: `${businessData.businessName} has been successfully added and connected to Google.`
    });
    
    setIsLoading(false);
    onSuccess();
    onClose();
    
    // Reset form
    setBusinessData({
      businessName: '',
      businessType: 'local',
    });
    setStep(1);
    setError('');
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-[#FFAB1A] via-[#FF1681] to-[#0080FF] text-white p-6">
          <DialogTitle className="text-xl font-medium">
            {step === 1 ? 'Add Business' : 'Connect with Google'}
          </DialogTitle>
          <DialogDescription className="text-white/80 mt-2">
            {step === 1 
              ? 'Enter your business details below to get started.'
              : 'Connect your Google Business Profile to manage it in Social Genius.'
            }
          </DialogDescription>
        </DialogHeader>
        
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}
        
        {step === 1 ? (
          <div className="p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName" className="text-gray-700">Business Name</Label>
                <Input
                  id="businessName"
                  name="businessName"
                  value={businessData.businessName}
                  onChange={handleInputChange}
                  placeholder="Your Business Name"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="businessType" className="text-gray-700">Business Type</Label>
                <select
                  id="businessType"
                  name="businessType"
                  value={businessData.businessType}
                  onChange={handleInputChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="local">Local Business</option>
                  <option value="online">Online Business</option>
                  <option value="service">Service Business</option>
                </select>
              </div>
              
              <div className="pt-4">
                <Button 
                  type="button" 
                  onClick={handleNext}
                  className="w-full bg-gradient-to-r from-[#0080FF] to-[#FF1681] hover:opacity-90"
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="mb-6 text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
              <h3 className="font-medium text-gray-800">Business Details</h3>
              <p className="text-base font-semibold text-black mt-1">{businessData.businessName}</p>
              <p className="text-xs text-gray-500 mt-1">
                {businessData.businessType === 'local' ? 'Local Business' : 
                 businessData.businessType === 'online' ? 'Online Business' : 'Service Business'}
              </p>
            </div>
            
            <div className="rounded-lg bg-white border border-gray-200 p-6 mb-4">
              <div className="flex items-center justify-center mb-4">
                <div className="h-14 w-14 bg-blue-50 rounded-full flex items-center justify-center">
                  <svg viewBox="0 0 24 24" width="28" height="28" className="text-blue-600">
                    <path
                      fill="currentColor" 
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                    />
                  </svg>
                </div>
              </div>
              
              <h3 className="text-center text-gray-900 font-medium mb-2">Google Business Profile</h3>
              
              <p className="text-center text-sm text-gray-600 mb-5">
                Connect with your Google account to manage your business directly from Social Genius.
              </p>
              
              <Button
                onClick={useOAuth ? handleGoogleSignIn : handleLegacySubmit}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" className="text-white">
                  <path
                    fill="currentColor"
                    d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                  />
                </svg>
                {isLoading ? "Connecting..." : "Sign in with Google"}
              </Button>
              
              <p className="text-xs text-center text-gray-500 mt-3">
                We'll securely connect to your Google Business Profile for management and analytics.
              </p>
            </div>
            
            <div className="flex justify-between">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setStep(1)}
                disabled={isLoading}
                className="border-gray-300"
              >
                Back
              </Button>
              
              {isLoading && (
                <div className="flex items-center text-sm text-gray-500">
                  <div className="w-4 h-4 mr-2 border-t-2 border-blue-500 border-solid rounded-full animate-spin"></div>
                  Processing...
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};