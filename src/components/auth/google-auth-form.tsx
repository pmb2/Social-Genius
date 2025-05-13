'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import Image from 'next/image';

interface GoogleAuthFormProps {
  businessId: string;
  onSuccess: (taskId: string) => void;
  onCancel: () => void;
}

export function GoogleAuthForm({ businessId, onSuccess, onCancel }: GoogleAuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSecureConnection, setIsSecureConnection] = useState(false);

  // Check for HTTPS connection on mount
  React.useEffect(() => {
    setIsSecureConnection(
      typeof window !== 'undefined' && 
      (window.location.protocol === 'https:' || window.location.hostname === 'localhost')
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!email || !password) {
      setError('Please provide both email and password');
      return;
    }
    
    // Check for Google account format
    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address');
      return;
    }

    // Warn about insecure connection
    if (!isSecureConnection) {
      const proceed = window.confirm(
        'WARNING: You are about to submit sensitive information over an insecure connection. ' +
        'This is not recommended. Continue anyway?'
      );
      
      if (!proceed) return;
    }
    
    setError(null);
    setIsAuthenticating(true);
    
    try {
      // Generate a unique request ID for this authentication attempt
      const requestId = `auth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      
      // Call the API to authenticate with Google
      const response = await fetch('/api/google-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        },
        body: JSON.stringify({
          businessId,
          email,
          password,
          options: {
            takeScreenshots: true, // Always take screenshots
            debug: true, // Enable debug mode for more detailed logs
          }
        })
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        // Check if there are screenshots even though authentication failed
        if (data.screenshots && data.screenshots.length > 0) {
          console.log(`Authentication failed but ${data.screenshots.length} screenshots were captured:`, data.screenshots);
        }
        
        throw new Error(data.error || 'Authentication failed');
      }
      
      // Log screenshot information if available
      if (data.screenshots && data.screenshots.length > 0) {
        console.log(`Authentication successful with ${data.screenshots.length} screenshots captured:`, data.screenshots);
      }
      
      // Clear the form and notify parent component of success
      setEmail('');
      setPassword('');
      onSuccess(data.taskId);
      
    } catch (err) {
      console.error('Google authentication error:', err);
      setError(err instanceof Error ? err.message : 'Failed to authenticate with Google');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6 bg-white p-6 rounded-lg shadow-md">
      <div className="flex flex-col items-center space-y-2 mb-6">
        <Image 
          src="https://www.gstatic.com/images/branding/googlelogo/svg/googlelogo_clr_74x24px.svg"
          alt="Google Logo"
          width={74}
          height={24}
          priority
        />
        <h2 className="text-lg font-medium">Connect your Google Business Profile</h2>
        <p className="text-sm text-gray-500 text-center">
          We need your Google credentials to automatically manage your business profile
        </p>
      </div>
      
      {!isSecureConnection && (
        <div className="flex items-center space-x-2 p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-md text-sm">
          <AlertCircle size={16} />
          <span className="font-medium">Security Notice: You are on an insecure connection. Consider using HTTPS.</span>
        </div>
      )}
      
      {error && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="google-email" className="text-sm font-medium">Email address</Label>
          <Input
            id="google-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.email@gmail.com"
            autoComplete="email"
            className="w-full"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="google-password" className="text-sm font-medium">Password</Label>
          <Input
            id="google-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full"
            required
          />
          <p className="text-xs text-gray-500">
            Your credentials are securely used only for automation and are not stored in plaintext.
          </p>
        </div>
        
        <div className="flex justify-between pt-2">
          <Button 
            type="button" 
            variant="outline"
            onClick={onCancel}
            disabled={isAuthenticating}
          >
            Cancel
          </Button>
          
          <Button 
            type="submit"
            disabled={isAuthenticating}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isAuthenticating ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                Connecting...
              </>
            ) : 'Connect Account'}
          </Button>
        </div>
        
        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs text-center text-gray-500">
            Your login information is securely processed through our automation service and is not visible to our staff.
            We use this access only for the specific tasks you authorize.
          </p>
        </div>
      </form>
    </div>
  );
}