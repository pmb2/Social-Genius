/**
 * Add Business Modal with OAuth
 * 
 * This component provides a streamlined OAuth-based authentication flow 
 * for connecting Google Business Profile to Social Genius.
 * 
 * Design follows the app's gradient color scheme and styling patterns.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/lib/ui/useToast';
import { FeatureFlag, FeatureFlagService } from '@/services/feature-flag-service/index';

export interface AddBusinessModalOAuthProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId?: string | number;
}

export function AddBusinessModalOAuth({ isOpen, onClose, onSuccess, userId }: AddBusinessModalOAuthProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('local');
  const [error, setError] = useState('');
  const { toast } = useToast();
  
  // Check if we should use the API or fallback to browser automation
  const featureFlags = FeatureFlagService.getInstance();
  const useOAuth = featureFlags.isEnabled(FeatureFlag.GoogleAuthWithOAuth, userId);
  
  // Verify OAuth configuration on component mount
  useEffect(() => {
    const verifyOAuthSetup = async () => {
      if (!useOAuth) return; // Skip if not using OAuth
      
      try {
        const response = await fetch('/api/google-auth/check-credentials', {
          method: 'GET',
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
          console.warn('OAuth configuration issue detected:', data.error);
          if (data.missingVars) {
            console.warn('Missing OAuth variables:', data.missingVars);
          }
        }
      } catch (err) {
        console.error('Failed to verify OAuth setup:', err);
      }
    };
    
    if (isOpen) {
      verifyOAuthSetup();
    }
  }, [isOpen, useOAuth]);
  
  const handleGoogleSignIn = async () => {
    if (!businessName.trim()) {
      setError('Please enter a business name');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      // First, we'll initialize OAuth tables if needed
      try {
        await fetch('/api/init-oauth-db', {
          method: 'POST',
          credentials: 'include'
        });
        console.log('OAuth database tables initialized');
      } catch (dbErr) {
        console.error('Failed to initialize OAuth tables:', dbErr);
        // Continue anyway, the URL endpoint should handle this too
      }
      
      // Get auth URL from backend including error handling
      const response = await fetch('/api/google-auth/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessName: businessName.trim(),
          businessType
        }),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        console.error('Error response from auth URL endpoint:', data);
        
        // Handle specific error cases
        if (data.details && data.details.includes('environment variables')) {
          throw new Error('Google OAuth is not properly configured. Please contact support.');
        }
        
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
    if (!businessName.trim()) {
      setError('Please enter a business name');
      return;
    }

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
          businessName: businessName.trim(),
          businessType
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
        setBusinessName('');
        setBusinessType('local');
        setError('');
        setIsLoading(false);
      }
      onClose();
    }}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-lg">
        <DialogHeader className="bg-gradient-to-r from-[#FFAB1A] via-[#FF1681] to-[#0080FF] text-white p-6">
          <DialogTitle className="flex items-center justify-center text-xl font-medium">
            <svg className="w-5 h-5 mr-2 text-white" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
              />
            </svg>
            Connect Business Profile
          </DialogTitle>
          <DialogDescription className="text-white/80 mt-2 text-center">
            Connect your Google Business Profile to manage it in Social Genius
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <div className="mb-6">
            <div className="flex justify-center">
              <div className="h-20 w-20 bg-gradient-to-r from-[#FFAB1A] via-[#FF1681] to-[#0080FF] rounded-full p-1 mb-4">
                <div className="h-full w-full bg-white rounded-full flex items-center justify-center">
                  <svg viewBox="0 0 24 24" width="32" height="32" className="text-[#FF1681]">
                    <path d="M12 12.75c1.14 0 2.25.1 3.327.268a3.745 3.745 0 0 1-2.557 5.857 3.745 3.745 0 0 1-3.834-1.392A12.404 12.404 0 0 1 12 12.75Zm.75-4.5a3.745 3.745 0 0 0-3.745 3.745c0 .968.6 1.835 1.245 2.3A12.519 12.519 0 0 0 8.25 12a.75.75 0 0 0-.75.75v.981c0 .311.177.669.38.916C7.87 14.645 7.9 14.663 7.9 14.663a12.48 12.48 0 0 0 8.1 2.992c2.76 0 5.302-.571 7.5-1.567v-4.238a.75.75 0 0 0-.75-.75h-.75a12.475 12.475 0 0 0-2.251-.25 3.75 3.75 0 0 0-6.749-2.625.75.75 0 0 1-1.11.25A3.754 3.754 0 0 0 12.75 8.25Z" fill="currentColor" />
                    <path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM19.5 12c0 2.413-1.163 4.564-2.962 5.933A11.08 11.08 0 0 1 12 19.5c-1.618 0-3.115-.345-4.532-.955a7.515 7.515 0 0 1-2.257-1.62A7.447 7.447 0 0 1 4.5 12a7.5 7.5 0 0 1 5.956-7.335A11.059 11.059 0 0 1 12 4.5c1.352 0 2.638.221 3.85.48A7.495 7.495 0 0 1 19.5 12Z" fill="currentColor" />
                  </svg>
                </div>
              </div>
            </div>
            
            <h3 className="text-center text-gray-900 font-semibold mb-2">Google Business Profile</h3>
            
            <p className="text-center text-sm text-gray-600 mb-4">
              Enter your business details and connect with Google to manage your business profile.
            </p>
          </div>
          
          <div className="space-y-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-gray-700">Business Name</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your Business Name"
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="businessType" className="text-gray-700">Business Type</Label>
              <select
                id="businessType"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-background px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                disabled={isLoading}
              >
                <option value="local">Local Business</option>
                <option value="online">Online Business</option>
                <option value="service">Service Business</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-3">
            <Button
              onClick={useOAuth ? handleGoogleSignIn : handleLegacyAuth}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#0080FF] to-[#FF1681] hover:opacity-90 flex items-center justify-center gap-2 h-12"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" className="text-white">
                <path
                  fill="currentColor"
                  d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                />
              </svg>
              {isLoading ? "Connecting..." : "Sign in with Google"}
            </Button>
            
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={isLoading}
              className="w-full border-gray-300"
            >
              Cancel
            </Button>
            
            <p className="text-xs text-center text-gray-500 mt-2">
              We'll securely connect to your Google Business Profile for management and analytics.
            </p>
          </div>
          
          {isLoading && (
            <div className="flex items-center justify-center mt-4 text-sm text-gray-500">
              <div className="w-4 h-4 mr-2 border-t-2 border-blue-500 border-solid rounded-full animate-spin"></div>
              Preparing connection...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}