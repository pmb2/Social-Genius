/**
 * Add Business Modal with OAuth
 * 
 * This component replaces the existing add-business-modal.tsx with an OAuth-based
 * authentication flow for Google Business Profile.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/lib/ui/toast';
import { FeatureFlag, FeatureFlagService } from '@/services/feature-flag-service';

export interface AddBusinessModalOAuthProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId?: string | number;
}

export function AddBusinessModalOAuth({ isOpen, onClose, onSuccess, userId }: AddBusinessModalOAuthProps) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const { toast } = useToast();
  
  // Check if we should use the API or fallback to browser automation
  const featureFlags = FeatureFlagService.getInstance();
  const useOAuth = featureFlags.isEnabled(FeatureFlag.GoogleAuthWithOAuth, userId);
  
  const handleNext = () => {
    if (!businessName.trim()) {
      setError('Please enter a business name');
      return;
    }
    
    setError('');
    setStep(2);
  };
  
  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // Get auth URL from backend
      const response = await fetch('/api/google-auth/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessName: businessName.trim()
        }),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
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
  
  // Fallback to the legacy browser automation flow if OAuth is not enabled
  const handleLegacyAuth = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // This will use the browser automation API
      const response = await fetch('/api/compliance/auth-prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessName: businessName.trim()
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
    } catch (err) {
      console.error('Error initiating legacy auth flow:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to Google');
      toast({
        title: 'Authentication Error',
        description: err instanceof Error ? err.message : 'Failed to connect to Google',
        variant: 'destructive'
      });
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        // Reset state when closing
        setStep(1);
        setBusinessName('');
        setError('');
        setIsLoading(false);
      }
      onClose();
    }}>
      <Dialog.Content className="sm:max-w-[425px]">
        <Dialog.Header>
          <Dialog.Title>
            {step === 1 ? 'Add Business' : 'Connect Google Business Profile'}
          </Dialog.Title>
          <Dialog.Description>
            {step === 1 
              ? 'Enter your business details below.'
              : 'Connect your Google Business Profile to manage it through Social Genius.'}
          </Dialog.Description>
        </Dialog.Header>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}
        
        {step === 1 ? (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your Business Name"
                disabled={isLoading}
              />
            </div>
            
            <Dialog.Footer>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleNext}
                disabled={isLoading}
              >
                Next
              </Button>
            </Dialog.Footer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6">
            <img 
              src="/google-business-profile-logo.png" 
              alt="Google Business Profile" 
              className="w-24 h-24 mb-4"
              onError={(e) => {
                // Fallback if image doesn't exist
                e.currentTarget.src = 'https://www.gstatic.com/images/branding/product/2x/google_business_profile_48dp.png';
              }}
            />
            
            <p className="text-center text-sm text-gray-600 mb-6">
              Click the button below to sign in with your Google account and authorize access to your Business Profile.
            </p>
            
            <Button
              onClick={useOAuth ? handleGoogleSignIn : handleLegacyAuth}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 py-2 px-4 rounded-md w-full"
            >
              <img 
                src="/google-logo.svg" 
                alt="Google" 
                className="w-5 h-5"
                onError={(e) => {
                  // Fallback if image doesn't exist
                  e.currentTarget.src = 'https://www.gstatic.com/images/branding/product/2x/google_48dp.png';
                }} 
              />
              {isLoading ? "Connecting..." : "Sign in with Google"}
            </Button>
            
            <div className="mt-4">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                disabled={isLoading}
              >
                Back
              </Button>
            </div>
          </div>
        )}
      </Dialog.Content>
    </Dialog>
  );
}