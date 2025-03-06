'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';

type RegisterFormProps = {
  onSuccess?: () => void;
};

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Security check - warn about insecure connections
    if (typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
      const confirmSubmit = window.confirm(
        'Warning: You are submitting sensitive information over an insecure connection. Continue anyway?'
      );
      if (!confirmSubmit) {
        return;
      }
    }
    
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all required fields');
      return;
    }
    
    // Name is optional, so we don't check for it
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) { // Changed to 6 to match backend validation
      setError('Password must be at least 6 characters long');
      return;
    }
    
    setError('');
    setIsLoading(true);
    
    try {
      // Use the context's register method
      console.log('Registering user with email:', email);
      const result = await register(email, password, name);
      
      console.log('Registration result:', result);
      
      if (result.success) {
        // Redirect to dashboard on successful registration and login
        window.location.href = '/dashboard';
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Check for insecure connection
  const isInsecure = typeof window !== 'undefined' && 
                    window.location.protocol === 'http:' && 
                    window.location.hostname !== 'localhost';

  return (
    <div className="w-full space-y-6">
      {isInsecure && (
        <div className="flex items-center space-x-2 p-3 bg-red-100 border border-red-400 text-red-800 rounded-md text-sm">
          <AlertCircle size={16} />
          <span className="font-bold">Security Warning: You are submitting registration information over an insecure connection. Your password could be intercepted. Please contact the site administrator.</span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium text-gray-700">
            Full name <span className="text-gray-500 text-xs">(optional)</span>
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="Enter your full name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-11 px-4 rounded-md border border-gray-300 focus:border-black focus:ring-1 focus:ring-black"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="register-email" className="text-sm font-medium text-gray-700">Email address <span className="text-red-500">*</span></Label>
          <Input
            id="register-email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 px-4 rounded-md border border-gray-300 focus:border-black focus:ring-1 focus:ring-black"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="register-password" className="text-sm font-medium text-gray-700">Password <span className="text-red-500">*</span></Label>
          <Input
            id="register-password"
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="Create a secure password (min. 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 px-4 rounded-md border border-gray-300 focus:border-black focus:ring-1 focus:ring-black"
            required
          />
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <span>Must be at least 6 characters</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">Confirm password <span className="text-red-500">*</span></Label>
          <Input
            id="confirm-password"
            type="password"
            name="confirm-password"
            autoComplete="new-password"
            placeholder="Re-enter your password to confirm"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full h-11 px-4 rounded-md border border-gray-300 focus:border-black focus:ring-1 focus:ring-black"
            required
          />
        </div>
        
        <div className="pt-2">
          <Button
            type="submit"
            className="w-full h-11 bg-black hover:bg-gray-900 text-white font-medium rounded-md transition-colors"
            disabled={isLoading}
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </Button>
        </div>
        
        <p className="text-xs text-center text-gray-500 mt-4">
          By creating an account, you agree to our{' '}
          <a href="#" className="text-gray-900 underline">Terms of Service</a>{' '}
          and{' '}
          <a href="#" className="text-gray-900 underline">Privacy Policy</a>.
        </p>
      </form>
    </div>
  );
}