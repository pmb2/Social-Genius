import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/lib/ui/toast';
import { encryptPassword } from '@/utils/password-encryption';

export interface AddBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddBusinessModal = ({ isOpen, onClose, onSuccess }: AddBusinessModalProps) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [businessData, setBusinessData] = useState({
    businessName: '',
    businessType: 'local',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [authScreenshots, setAuthScreenshots] = useState<Record<string, string> | null>(null);
  const { toast } = useToast();
  
  // Generate trace ID for tracking the entire flow
  const [traceId] = useState(() => `auth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
  
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
    
    console.log(`[BUSINESS_AUTH:${traceId}] Proceeding to credentials page`);
    setError('');
    setStep(2);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      console.log(`[BUSINESS_AUTH:${traceId}] Starting Google auth process for ${businessData.businessName}`);
      console.log(`[BUSINESS_AUTH:${traceId}] Using email: ${businessData.email}`);
      
      // Validate email format
      if (!businessData.email || !businessData.email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }
      
      // Validate password
      if (!businessData.password || businessData.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      
      // Check session cookies before submitting
      console.log(`[BUSINESS_AUTH:${traceId}] Checking session cookies`);
      const hasSessionCookie = document.cookie.split(';').some(cookie => 
        cookie.trim().startsWith('session=') || cookie.trim().startsWith('sessionId=')
      );
      
      if (!hasSessionCookie) {
        console.log(`[BUSINESS_AUTH:${traceId}] No session cookie found, refreshing session`);
        await fetch('/api/auth/session', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
      }
      
      // Encrypt password for security
      const passwordData = encryptPassword(businessData.password);
      
      // Call authentication API
      const response = await fetch('/api/compliance/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Trace-ID': traceId,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        credentials: 'include',
        body: JSON.stringify({
          businessName: businessData.businessName,
          businessType: businessData.businessType,
          email: businessData.email,
          encryptedPassword: passwordData.encryptedPassword,
          nonce: passwordData.nonce,
          version: passwordData.version,
          traceId,
          persistBrowser: true,
          enableExtendedLogging: true
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Authentication failed');
      }
      
      // Store task ID for polling
      if (result.taskId) {
        setTaskId(result.taskId);
        console.log(`[BUSINESS_AUTH:${traceId}] Authentication task started: ${result.taskId}`);
        await pollTaskStatus(result.taskId, traceId);
      } else {
        handleAuthSuccess();
      }
    } catch (error) {
      console.error(`[BUSINESS_AUTH:${traceId}] Authentication error:`, error);
      
      // Format error message for user-friendly display
      let userErrorMessage = '';
      if (error instanceof Error) {
        // Special cases of errors
        if (error.message.includes('CAPTCHA') || error.message.includes('captcha')) {
          userErrorMessage = 'Google CAPTCHA detected. Please try again in a few minutes or login to your Google account manually first, then retry.';
        } 
        else if (error.message.includes('TWO_FACTOR') || error.message.includes('2FA') || error.message.includes('two-factor')) {
          userErrorMessage = 'Two-factor authentication is enabled on your account. Please temporarily disable it, or create an app password for this application.';
        }
        else if (error.message.includes('WRONG_PASSWORD') || error.message.includes('incorrect password')) {
          userErrorMessage = 'The password you entered is incorrect. Please check your credentials and try again.';
        }
        else if (error.message.includes('ACCOUNT_LOCKED') || error.message.includes('locked')) {
          userErrorMessage = 'Your account is locked. Please visit Google account recovery to unlock it.';
        }
        else {
          userErrorMessage = error.message;
        }
      } else {
        userErrorMessage = 'An unexpected error occurred. Please try again later.';
      }
      
      setError(userErrorMessage);
      setIsLoading(false);
    }
  };
  
  const pollTaskStatus = async (taskId: string, traceId: string) => {
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        console.log(`[BUSINESS_AUTH:${traceId}] Polling task status (${attempts}/${maxAttempts})`);
        
        // Wait with exponential backoff
        const backoff = Math.min(1000 * Math.pow(1.5, attempts - 1), 8000);
        await new Promise(resolve => setTimeout(resolve, backoff));
        
        // Get task status
        const response = await fetch(`/api/compliance/task-status?taskId=${taskId}&traceId=${traceId}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'X-Trace-ID': traceId
          },
          credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.status === 'completed') {
          console.log(`[BUSINESS_AUTH:${traceId}] Task completed successfully`);
          
          // If the task included screenshots, store them
          if (result.result && result.result.screenshots) {
            setAuthScreenshots(result.result.screenshots);
          }
          
          // Fetch screenshots if available
          try {
            const screenshotsResponse = await fetch(`/api/compliance/auth-screenshots?taskId=${taskId}&businessId=${result.businessId}`, {
              headers: {
                'Cache-Control': 'no-cache',
                'X-Trace-ID': traceId
              },
              credentials: 'include'
            });
            
            if (screenshotsResponse.ok) {
              const screenshotsData = await screenshotsResponse.json();
              if (screenshotsData.screenshots) {
                setAuthScreenshots(screenshotsData.screenshots);
                console.log(`[BUSINESS_AUTH:${traceId}] Retrieved ${Object.keys(screenshotsData.screenshots).length} authentication screenshots`);
              }
            }
          } catch (screenshotError) {
            console.warn(`[BUSINESS_AUTH:${traceId}] Failed to fetch screenshots:`, screenshotError);
          }
          
          handleAuthSuccess();
          return;
        } else if (result.status === 'failed') {
          console.error(`[BUSINESS_AUTH:${traceId}] Task failed:`, result.error);
          
          // Format the error message based on error code
          let userFriendlyError = result.error || 'Authentication failed';
          
          // Handle specific error codes
          if (result.errorCode === 'WRONG_PASSWORD') {
            userFriendlyError = 'The password you entered is incorrect. Please check your credentials and try again.';
          } else if (result.errorCode === 'ACCOUNT_LOCKED') {
            userFriendlyError = 'Your account has been temporarily locked due to too many failed attempts. Please try again in 30 minutes or reset your password through Google.';
          } else if (result.errorCode === 'TWO_FACTOR_REQUIRED') {
            userFriendlyError = 'Your account has two-factor authentication enabled. Please temporarily disable it or use an app password.';
          } else if (result.errorCode === 'CAPTCHA_REQUIRED') {
            userFriendlyError = 'A CAPTCHA challenge was detected. Please try again in a few minutes or login to your Google account manually first, then retry.';
          }
          
          setError(userFriendlyError);
          setIsLoading(false);
          return;
        }
        
        // Continue polling for in-progress tasks
      } catch (error) {
        console.error(`[BUSINESS_AUTH:${traceId}] Error polling task:`, error);
      }
    }
    
    setError('Authentication timed out after multiple attempts');
    setIsLoading(false);
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
      email: '',
      password: ''
    });
    setStep(1);
    setError('');
    setTaskId(null);
  };
  
  // Reset form when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setBusinessData({
        businessName: '',
        businessType: 'local',
        email: '',
        password: ''
      });
      setStep(1);
      setError('');
      setTaskId(null);
    }
  }, [isOpen]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <Dialog.Content className="sm:max-w-[425px]">
        <Dialog.Header>
          <Dialog.Title>
            {step === 1 ? 'Add Business' : (
              <div className="flex items-center justify-center">
                <img 
                  src="https://www.svgrepo.com/show/303108/google-icon-logo.svg" 
                  alt="Google" 
                  width={28} 
                  height={28} 
                  className="mr-3"
                />
                <span className="text-[#5F6368] font-normal">Sign in with Google</span>
              </div>
            )}
          </Dialog.Title>
          <Dialog.Description>
            {step === 1 
              ? 'Enter your business details below.'
              : 'Provide your Google Business Profile credentials.'
            }
          </Dialog.Description>
        </Dialog.Header>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={(e) => step === 1 ? handleNext() : handleSubmit(e)}>
          {step === 1 ? (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label htmlFor="businessName">Business Name</label>
                <Input
                  id="businessName"
                  name="businessName"
                  value={businessData.businessName}
                  onChange={handleInputChange}
                  placeholder="Your Business Name"
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <label htmlFor="businessType">Business Type</label>
                <select
                  id="businessType"
                  name="businessType"
                  value={businessData.businessType}
                  onChange={handleInputChange}
                  className="input"
                >
                  <option value="local">Local Business</option>
                  <option value="online">Online Business</option>
                  <option value="service">Service Business</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="email" className="block text-sm font-medium text-[#5F6368]">
                    Email or phone
                  </label>
                  {businessData.email && !businessData.email.includes('@') && (
                    <span className="text-red-500 text-xs">Invalid email format</span>
                  )}
                </div>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={businessData.email}
                  onChange={handleInputChange}
                  placeholder="youremail@gmail.com"
                  disabled={isLoading}
                  required
                  className={businessData.email && !businessData.email.includes('@')
                    ? 'border-red-300'
                    : ''
                  }
                />
              </div>
              
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-[#5F6368]">
                    Password
                  </label>
                  {businessData.password && businessData.password.length < 6 && (
                    <span className="text-red-500 text-xs">Min. 6 characters</span>
                  )}
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={businessData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  disabled={isLoading}
                  required
                  className={businessData.password && businessData.password.length < 6
                    ? 'border-red-300'
                    : ''
                  }
                />
              </div>
              
              <div className="w-full flex justify-between mt-4 mb-2">
                <button
                  type="button"
                  className="text-sm text-[#1a73e8] hover:text-blue-700 hover:underline font-medium"
                  onClick={() => setStep(1)}
                  disabled={isLoading}
                >
                  Back
                </button>
                <a 
                  href="https://accounts.google.com/signin/recovery"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#1a73e8] hover:text-blue-700 hover:underline font-medium"
                >
                  Forgot password?
                </a>
              </div>
            </div>
          )}
          
          <Dialog.Footer>
            {step === 2 && (
              <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={isLoading}>
                Back
              </Button>
            )}
            
            <Button 
              type="submit" 
              disabled={isLoading || (step === 2 && (!businessData.email || !businessData.password || businessData.password.length < 6))}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 mr-2 border-t-2 border-white border-solid rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : step === 1 ? 'Next' : 'Sign in'}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
};