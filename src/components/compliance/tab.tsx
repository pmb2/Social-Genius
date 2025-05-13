"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { steps } from "@/types/business-profile"
import { triggerComplianceCheck, getComplianceReport, resolveComplianceIssue } from "@/services/compliance/compliance-service"
import { CheckCircle, AlertCircle, XCircle, RefreshCw, Lock } from "lucide-react"
import Image from "next/image"

interface ComplianceTabProps {
  businessId: number
}

export function ComplianceTab({ businessId }: ComplianceTabProps) {
  const [activeStep, setActiveStep] = useState(0)
  const [isRunningCheck, setIsRunningCheck] = useState(false)
  const [isCompliant, setIsCompliant] = useState(false)
  const [countdown, setCountdown] = useState({ minutes: 59, seconds: 59 })
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false)
  const [currentIssueId, setCurrentIssueId] = useState<string | null>(null)
  const [issues, setIssues] = useState<{
    id?: string;
    title: string;
    description: string;
    severity: "high" | "medium" | "low";
    type?: string;
    suggestedAction?: string;
  }[]>([
    {
      title: "Missing business hours",
      description: "Add your business hours to improve customer experience",
      severity: "high"
    },
    {
      title: "Logo resolution too low",
      description: "Upload a higher resolution logo (minimum 250x250px)",
      severity: "medium"
    },
    {
      title: "No posts in last 7 days",
      description: "Regular posting improves visibility",
      severity: "medium"
    }
  ])

  // Countdown timer effect - uses React refs to avoid unnecessary re-renders
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let isMounted = true; // Track if component is mounted
    
    if (isCompliant && isMounted) {
      // Reset countdown when compliance is achieved
      setCountdown({ minutes: 59, seconds: 59 });
      
      // Using timer ref to ensure cleanup works properly
      const startTimer = () => {
        // Clear any existing timers first
        if (timer) clearInterval(timer);
        
        timer = setInterval(() => {
          if (!isMounted) return; // Don't update state if unmounted
          
          setCountdown(prev => {
            if (prev.seconds > 0) {
              return { ...prev, seconds: prev.seconds - 1 };
            } else if (prev.minutes > 0) {
              return { minutes: prev.minutes - 1, seconds: 59 };
            } else {
              // When timer reaches 00:00, we would trigger a background compliance check
              // but we're just resetting the timer for now
              
              // Reset to 59:59 after triggering the check
              return { minutes: 59, seconds: 59 };
            }
          });
        }, 1000);
      };
      
      startTimer();
    }
    
    // Clean up function - crucial for preventing memory leaks and stray timers
    return () => {
      isMounted = false;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, [isCompliant]);

  // Function to perform compliance check logic
  const performComplianceCheck = async (showProgress = true) => {
    try {
      console.log(`Starting compliance check for business ID: ${businessId}, showProgress: ${showProgress}`);
      
      if (showProgress) {
        // Step 1: Gathering info
        setActiveStep(0)
        await new Promise(resolve => setTimeout(resolve, 1500))
        setActiveStep(1)
      }
      
      // Step 2: Checking compliance
      console.log(`Triggering compliance check for business ID: ${businessId}`);
      
      let triggerResponse;
      try {
        triggerResponse = await triggerComplianceCheck(businessId)
        
        if (!triggerResponse.success) {
          console.error(`Failed to trigger compliance check for business ID: ${businessId}:`, triggerResponse.error)
          return false
        }
        
        console.log(`Successfully triggered compliance check for business ID: ${businessId}, job ID: ${triggerResponse.jobId}`);
      } catch (error) {
        console.error(`Error triggering compliance check for business ID: ${businessId}:`, error)
        // Continue anyway to show something to the user
      }
      
      if (showProgress) {
        // Show progress for a minimum amount of time to avoid UI flickering
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      
      // Step 3: Results - Poll for results with timeout
      if (showProgress) {
        setActiveStep(2)
      }
      
      // Wait for the report to be ready (with polling)
      let retries = 0;
      const maxRetries = 7;  // Increased from 5 to 7 for better reliability
      let report = await getComplianceReport(businessId);
      
      console.log(`Initial compliance report for business ID: ${businessId}, status: ${report.status}`);
      
      // If we get a PENDING status, poll with exponential backoff
      while (report.status === "PENDING" && retries < maxRetries) {
        // Exponential backoff with jitter (1s, 2s, 4s, etc. plus random jitter)
        const backoffTime = Math.min(1000 * Math.pow(2, retries), 8000) + Math.random() * 500;
        console.log(`Waiting ${Math.round(backoffTime)}ms before retry ${retries + 1} for business ID: ${businessId}`);
        
        await new Promise(resolve => setTimeout(resolve, backoffTime))
        report = await getComplianceReport(businessId)
        console.log(`Compliance report retry ${retries + 1} for business ID: ${businessId}, status: ${report.status}`);
        retries++
      }
      
      // Handle authentication required case
      if (report.status === "AUTH_REQUIRED") {
        console.log(`Authentication required for business ID: ${businessId}`);
        
        // Find the auth_required issue
        const authIssue = report.issues.find(issue => issue.type === "auth_required");
        if (authIssue) {
          // Stop in step 1 if no login is found, showing clear login required message
          if (showProgress) {
            setActiveStep(0) // Reset to step 1 for authentication
          }
          
          // Set auth required issues with clear messaging
          const mappedIssues = [{
            id: authIssue.id || "auth-issue",
            title: "Google Business Profile Login Required",
            description: authIssue.description || 
                        "You need to login to your Google Business Profile before we can gather compliance data",
            severity: "high",
            type: "auth_required",
            suggestedAction: authIssue.suggestedAction || 
                            "Please provide your Google Business Profile credentials to continue"
          }];
          
          console.log(`Setting auth required issues for business ID: ${businessId}`);
          setIssues(mappedIssues);
          setIsCompliant(false);
          
          // Automatically show auth modal
          setCurrentIssueId(mappedIssues[0].id);
          setIsAuthModalOpen(true);
          
          return false;
        }
      }
      
      // Check for result status after all retries
      if (report.status === "PENDING") {
        console.warn(`Compliance check still pending after ${maxRetries} retries for business ID: ${businessId}`);
        setIssues([{
          title: "Check Taking Longer Than Expected",
          description: "We're still processing your compliance check. Please try again in a few moments.",
          severity: "medium"
        }]);
        setIsCompliant(false);
        return false;
      }
      
      if (report.status === "ERROR") {
        console.error(`Compliance check error for business ID: ${businessId}`);
        const errorIssue = report.issues.find(issue => issue.type === "system_error");
        setIssues([{
          title: "System Error",
          description: errorIssue?.description || "We encountered a problem checking compliance. Please try again later.",
          severity: "high"
        }]);
        setIsCompliant(false);
        return false;
      }
      
      // Use real compliance status from the API response
      const isCompliant = report.status === "PASS";
      console.log(`Setting compliance status for business ID: ${businessId} to: ${isCompliant}`);
      setIsCompliant(isCompliant)
      
      // If we're compliant, clear issues and reset countdown
      if (isCompliant) {
        setIssues([])
        setCountdown({ minutes: 59, seconds: 59 })
        console.log(`Business ID: ${businessId} is compliant, cleared issues and reset countdown`);
      } else {
        // Map issues from API to component format with more detailed formatting
        const mappedIssues = report.issues.map(issue => ({
          id: issue.id,
          title: issue.type
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '),
          description: issue.description || 
                      issue.suggestedAction || 
                      "Please fix this issue to improve your compliance score.",
          severity: issue.severity as "high" | "medium" | "low",
          type: issue.type,
          suggestedAction: issue.suggestedAction
        }));
        
        console.log(`Business ID: ${businessId} has ${mappedIssues.length} compliance issues:`, 
          mappedIssues.map(i => i.title));
        setIssues(mappedIssues);
      }
      
      return isCompliant
    } catch (error) {
      console.error(`Unexpected error running compliance check for business ID: ${businessId}:`, error)
      // Set default error issue when check fails
      setIssues([{
        title: "System Error",
        description: "We encountered a problem while checking compliance. Please try again later.",
        severity: "high"
      }]);
      return false
    }
  }

  // Function to start a user-initiated compliance check
  const startComplianceCheck = async () => {
    setIsRunningCheck(true)
    setActiveStep(0)
    
    try {
      await performComplianceCheck(true)
    } catch (error) {
      console.error("Error running compliance check:", error)
    } finally {
      setIsRunningCheck(false)
    }
  }
  
  // Function to handle GBP authentication form submission
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Generate a unique trace ID for comprehensive logging
    const traceId = `auth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[BUSINESS_AUTH:${traceId}] 🚀 STARTING GOOGLE AUTH FLOW - FRONTEND INITIATED`);
    console.log(`[BUSINESS_AUTH:${traceId}] Business ID: ${businessId}`);
    console.log(`[BUSINESS_AUTH:${traceId}] Flow initiated from: Compliance Tab`);
    console.log(`[BUSINESS_AUTH:${traceId}] Process timestamp: ${new Date().toISOString()}`);
    
    // Log system information for troubleshooting
    console.log(`[BUSINESS_AUTH:${traceId}] 🖥️ Browser: ${navigator.userAgent}`);
    console.log(`[BUSINESS_AUTH:${traceId}] Browser language: ${navigator.language}`);
    console.log(`[BUSINESS_AUTH:${traceId}] Screen dimensions: ${window.screen.width}x${window.screen.height}`);
    console.log(`[BUSINESS_AUTH:${traceId}] Window size: ${window.innerWidth}x${window.innerHeight}`);
    console.log(`[BUSINESS_AUTH:${traceId}] Time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    
    // Check for cookies before submitting to catch issues early
    console.log(`[BUSINESS_AUTH:${traceId}] 🍪 CHECKING SESSION COOKIES`);
    const allCookies = document.cookie;
    const cookieNames = allCookies.length > 0 
      ? allCookies.split(';').map(c => c.trim().split('=')[0]) 
      : [];
    
    const hasSessionCookie = document.cookie.split(';').some(cookie => 
      cookie.trim().startsWith('session=') || cookie.trim().startsWith('sessionId=')
    );
    
    console.log(`[BUSINESS_AUTH:${traceId}] Session cookie present: ${hasSessionCookie}, Cookie names: [${cookieNames.join(', ')}]`);
    
    // If no session cookie, try to refresh the session
    if (!hasSessionCookie) {
      console.error(`[BUSINESS_AUTH:${traceId}] ⚠️ No session cookie found before adding business, refreshing session`);
      
      try {
        // Try to set a test cookie to check if cookies are enabled
        console.log(`[BUSINESS_AUTH:${traceId}] Testing cookie functionality`);
        document.cookie = "test_cookie=1; path=/; max-age=30";
        const cookiesEnabled = document.cookie.includes("test_cookie");
        
        console.log(`[BUSINESS_AUTH:${traceId}] Cookies ${cookiesEnabled ? 'are' : 'are NOT'} enabled in browser`);
        
        if (!cookiesEnabled) {
          console.error(`[BUSINESS_AUTH:${traceId}] ❌ COOKIES DISABLED - Authentication cannot proceed`);
          setAuthError("Cookies appear to be disabled in your browser. Please enable cookies and try again.");
          return;
        }
        
        // Attempt to refresh session by making a low-impact request
        try {
          console.log(`[BUSINESS_AUTH:${traceId}] 🔄 Refreshing session before API call`);
          console.log(`[BUSINESS_AUTH:${traceId}] Calling /api/auth/session with random query param to bypass cache`);
          
          const sessionStartTime = Date.now();
          const sessionResponse = await fetch('/api/auth/session?r=' + Math.random(), {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
              'X-Trace-ID': traceId
            }
          });
          
          const sessionTime = Date.now() - sessionStartTime;
          console.log(`[BUSINESS_AUTH:${traceId}] Session refresh took ${sessionTime}ms, status: ${sessionResponse.status}`);
          
          // Check cookies again after refresh
          const hasSessionAfterRefresh = document.cookie.split(';').some(cookie => 
            cookie.trim().startsWith('session=') || cookie.trim().startsWith('sessionId=')
          );
          
          const cookiesAfterRefresh = document.cookie.length > 0 
            ? document.cookie.split(';').map(c => c.trim().split('=')[0]) 
            : [];
          
          console.log(`[BUSINESS_AUTH:${traceId}] After refresh: session cookie ${hasSessionAfterRefresh ? 'found' : 'still missing'}`);
          console.log(`[BUSINESS_AUTH:${traceId}] Cookies after refresh: [${cookiesAfterRefresh.join(', ')}]`);
          
          if (!hasSessionAfterRefresh) {
            console.error(`[BUSINESS_AUTH:${traceId}] ⚠️ Session cookie still missing after refresh attempt`);
          }
        } catch (refreshError) {
          console.error(`[BUSINESS_AUTH:${traceId}] ❌ SESSION REFRESH ERROR:`, refreshError);
          console.error(`[BUSINESS_AUTH:${traceId}] Error message: ${refreshError.message}`);
          console.error(`[BUSINESS_AUTH:${traceId}] Error stack: ${refreshError.stack}`);
        }
      } catch (cookieError) {
        console.error(`[BUSINESS_AUTH:${traceId}] ❌ COOKIE ACCESS ERROR:`, cookieError);
        console.error(`[BUSINESS_AUTH:${traceId}] Error message: ${cookieError.message}`);
        console.error(`[BUSINESS_AUTH:${traceId}] Error stack: ${cookieError.stack}`);
      }
    }
    
    // Input validation with detailed logging
    console.log(`[BUSINESS_AUTH:${traceId}] 🔍 VALIDATING USER INPUT`);
    let validationPassed = true;
    
    if (!email) {
      console.log(`[BUSINESS_AUTH:${traceId}] ❌ Validation failed: Email is empty`);
      setAuthError("Please enter your email address");
      validationPassed = false;
      return;
    }
    
    if (!email.includes('@')) {
      console.log(`[BUSINESS_AUTH:${traceId}] ❌ Validation failed: Invalid email format (missing @)`);
      setAuthError("Please enter a valid email address");
      validationPassed = false;
      return;
    }
    
    if (!password) {
      console.log(`[BUSINESS_AUTH:${traceId}] ❌ Validation failed: Password is empty`);
      setAuthError("Please enter your password");
      validationPassed = false;
      return;
    }
    
    if (password.length < 6) {
      console.log(`[BUSINESS_AUTH:${traceId}] ❌ Validation failed: Password too short (${password.length} chars)`);
      setAuthError("Password must be at least 6 characters long");
      validationPassed = false;
      return;
    }
    
    console.log(`[BUSINESS_AUTH:${traceId}] ✅ Validation passed, proceeding with authentication`);
    
    // Show loading state
    setIsSubmittingAuth(true);
    setAuthError("Preparing to authenticate...");
    
    // Record performance metrics and include in logs
    const requestStartTime = Date.now();
    console.log(`[BUSINESS_AUTH:${traceId}] ⏱️ Auth flow started at: ${new Date(requestStartTime).toISOString()}`);
    
    // Enter function: API request preparation
    console.log(`[BUSINESS_AUTH:${traceId}] 📦 PREPARING API REQUEST`);
    console.log(`[BUSINESS_AUTH:${traceId}] Request will include: businessId, email, password`);
    
    try {
      // Step 1: In a production environment, we would encrypt the password
      // import { encryptPassword } from '@/lib/utilities/password-encryption'
      console.log(`[BUSINESS_AUTH:${traceId}] 🔐 Preparing credentials for secure transmission`);
      
      // Use password encryption for security
      // In a production environment, we would properly encrypt the password
      // For now, create a simple credential object with minimal security
      const encryptedPassword = btoa(password); // Basic encoding (not secure for production)
      const nonce = Date.now().toString(36) + Math.random().toString(36).substring(2);
      const version = "dev";
      
      // Include a business ID if none provided
      if (!businessId) {
        console.log(`[BUSINESS_AUTH:${traceId}] ⚠️ No business ID provided, creating temporary ID`);
        businessId = `temp-business-${Date.now()}`;
      }
      
      console.log(`[BUSINESS_AUTH:${traceId}] 🔑 Created encrypted credential object for business: ${businessId}`);
      
      // Log request event
      console.log(`[BUSINESS_AUTH:${traceId}] 📡 SENDING AUTHENTICATION REQUEST`);
      console.log(`[BUSINESS_AUTH:${traceId}] Endpoint: /api/compliance/auth`);
      console.log(`[BUSINESS_AUTH:${traceId}] Method: POST`);
      console.log(`[BUSINESS_AUTH:${traceId}] Parameters: businessId=${businessId}, email=${email}, enableExtendedLogging=true`);
      
      // Measure API request time
      const fetchStartTime = Date.now();
      const response = await fetch('/api/compliance/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Trace-ID': traceId,
          'X-Request-Time': new Date().toISOString(),
          'X-Request-Source': 'compliance-tab'
        },
        body: JSON.stringify({
          businessId,
          email,
          encryptedPassword, // Send encoded password instead of plaintext
          nonce,             // Include nonce for encryption
          version,           // Include version for encryption algorithm
          persistBrowser: true,
          enableExtendedLogging: true,
          traceId // Include trace ID in body for correlation
        }),
      });
      
      // Log response metrics
      const fetchTime = Date.now() - fetchStartTime;
      console.log(`[BUSINESS_AUTH:${traceId}] ⏱️ API request completed in ${fetchTime}ms`);
      console.log(`[BUSINESS_AUTH:${traceId}] 📊 Response status: ${response.status}`);
      
      // Log response headers for debugging
      const headerEntries = [...response.headers.entries()];
      const importantHeaders = headerEntries.filter(([key]) => 
        ['content-type', 'x-request-id', 'set-cookie', 'x-response-time'].includes(key.toLowerCase())
      );
      console.log(`[BUSINESS_AUTH:${traceId}] 📋 Important response headers:`, 
        Object.fromEntries(importantHeaders)
      );
      
      // Parse response with timing
      console.log(`[BUSINESS_AUTH:${traceId}] 🔄 Parsing API response`);
      const responseParseStart = Date.now();
      const result = await response.json();
      const parseTime = Date.now() - responseParseStart;
      
      console.log(`[BUSINESS_AUTH:${traceId}] ⏱️ Response parsing took ${parseTime}ms`);
      console.log(`[BUSINESS_AUTH:${traceId}] 📄 API response received:`, { 
        success: result.success,
        message: result.message,
        taskId: result.taskId ? `${result.taskId.substring(0, 8)}...` : undefined
      });
      
      // Check if the request was successful and we have a task ID
      if (result.success && result.taskId) {
        console.log(`[BUSINESS_AUTH:${traceId}] ✅ AUTHENTICATION REQUEST ACCEPTED`);
        console.log(`[BUSINESS_AUTH:${traceId}] Task ID: ${result.taskId}`);
        console.log(`[BUSINESS_AUTH:${traceId}] Browser instance ID: ${result.browserInstanceId || 'none'}`);
        
        // Enter function: Status polling
        console.log(`[BUSINESS_AUTH:${traceId}] 🔄 ENTERING POLLING PHASE`);
        console.log(`[BUSINESS_AUTH:${traceId}] Will poll for status until completion or timeout`);
        
        // Status polling variables
        let progressCheck = 0;
        let authStatus = 'in_progress';
        let authResult: any = null;
        let errorCode: string | null = null;
        let errorMessage: string | null = null;
        let screenshot: string | null = null;
        
        // Update the UI to show that we're waiting for authentication
        setAuthError("Authenticating your Google account. This may take a moment...");
        
        // Log correlation IDs for tracing
        console.log(`[BUSINESS_AUTH:${traceId}] 📍 CORRELATION IDS`);
        console.log(`[BUSINESS_AUTH:${traceId}] Frontend trace ID: ${traceId}`);
        console.log(`[BUSINESS_AUTH:${traceId}] Backend task ID: ${result.taskId}`);
        
        // Poll for status until we get a final result or timeout
        const maxPolls = 30; // Maximum number of polling attempts (~90 seconds with 3s interval)
        console.log(`[BUSINESS_AUTH:${traceId}] Will attempt up to ${maxPolls} status checks`);
        
        while (authStatus === 'in_progress' && progressCheck < maxPolls) {
          progressCheck++;
          
          try {
            // Wait between checks
            const waitTime = 3000; // 3 seconds between checks
            console.log(`[BUSINESS_AUTH:${traceId}] ⏱️ Waiting ${waitTime}ms before poll attempt ${progressCheck}/${maxPolls}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Log polling attempt
            console.log(`[BUSINESS_AUTH:${traceId}] 🔄 POLL ATTEMPT ${progressCheck}/${maxPolls}`);
            
            // Check the status with cache-busting
            const pollStartTime = Date.now();
            const statusUrl = `/api/compliance/task-status?taskId=${result.taskId}&t=${Date.now()}&pollAttempt=${progressCheck}&traceId=${traceId}`;
            console.log(`[BUSINESS_AUTH:${traceId}] Polling URL: ${statusUrl}`);
            
            const statusResponse = await fetch(statusUrl, {
              headers: {
                'X-Trace-ID': traceId,
                'Cache-Control': 'no-cache'
              }
            });
            const pollTime = Date.now() - pollStartTime;
            
            console.log(`[BUSINESS_AUTH:${traceId}] ⏱️ Poll took ${pollTime}ms, status: ${statusResponse.status}`);
            
            if (!statusResponse.ok) {
              console.error(`[BUSINESS_AUTH:${traceId}] ❌ POLL ERROR: Status ${statusResponse.status}`);
              throw new Error(`Failed to check authentication status: ${statusResponse.status}`);
            }
            
            // Parse the status response
            const pollParseStart = Date.now();
            const statusResult = await statusResponse.json();
            const parseTime = Date.now() - pollParseStart;
            
            console.log(`[BUSINESS_AUTH:${traceId}] Poll result parsed in ${parseTime}ms`);
            console.log(`[BUSINESS_AUTH:${traceId}] Poll result status: ${statusResult.status}`);
            console.log(`[BUSINESS_AUTH:${traceId}] Progress: ${statusResult.progress || 'unknown'}`);
            
            // Process based on status
            if (statusResult.status === 'in_progress') {
              // Still in progress - update UI with progress if available
              console.log(`[BUSINESS_AUTH:${traceId}] Task still in progress`);
              
              const progressMsg = statusResult.progress 
                ? `Authenticating your Google account (${statusResult.progress}%)...`
                : `Authenticating your Google account, please wait...`;
              
              setAuthError(progressMsg);
              authStatus = 'in_progress';
              
              // Log detailed progress if available
              if (statusResult.statusDetail) {
                console.log(`[BUSINESS_AUTH:${traceId}] Status detail: ${statusResult.statusDetail}`);
              }
            } 
            else if (statusResult.status === 'success') {
              // Authentication succeeded
              console.log(`[BUSINESS_AUTH:${traceId}] ✅ AUTHENTICATION SUCCEEDED`);
              authStatus = 'success';
              authResult = statusResult;
              screenshot = statusResult.screenshot;
              
              // Log success details
              if (statusResult.result) {
                console.log(`[BUSINESS_AUTH:${traceId}] Result details:`, {
                  completionTime: statusResult.completionTime,
                  hasScreenshot: !!statusResult.screenshot,
                  sessionSaved: statusResult.result.sessionSaved
                });
              }
              
              break;
            } 
            else if (statusResult.status === 'failed') {
              // Authentication failed - log detailed error
              console.error(`[BUSINESS_AUTH:${traceId}] ❌ AUTHENTICATION FAILED`);
              authStatus = 'failed';
              errorCode = statusResult.errorCode || 'AUTH_FAILED';
              errorMessage = statusResult.error || 'Authentication failed';
              screenshot = statusResult.screenshot;
              
              // Log failure details
              console.error(`[BUSINESS_AUTH:${traceId}] Error code: ${errorCode}`);
              console.error(`[BUSINESS_AUTH:${traceId}] Error message: ${errorMessage}`);
              console.error(`[BUSINESS_AUTH:${traceId}] Has screenshot: ${!!screenshot}`);
              
              if (statusResult.result?.details) {
                console.error(`[BUSINESS_AUTH:${traceId}] Additional details: ${statusResult.result.details}`);
              }
              
              break;
            }
            else {
              // Unknown status - treat as error
              console.error(`[BUSINESS_AUTH:${traceId}] ❓ UNKNOWN STATUS: ${statusResult.status}`);
              authStatus = 'failed';
              errorMessage = `Received unknown authentication status: ${statusResult.status}`;
              break;
            }
          } catch (pollError) {
            // Error during polling
            console.error(`[BUSINESS_AUTH:${traceId}] ❌ POLLING ERROR:`, pollError);
            console.error(`[BUSINESS_AUTH:${traceId}] Error message: ${pollError.message}`);
            console.error(`[BUSINESS_AUTH:${traceId}] Error stack: ${pollError.stack}`);
            
            errorMessage = `Failed to check authentication status: ${pollError.message}`;
            authStatus = 'failed';
            break;
          }
        }
        
        // Check if we timed out on polling
        if (authStatus === 'in_progress') {
          console.error(`[BUSINESS_AUTH:${traceId}] ⏱️ POLLING TIMEOUT: Reached max attempts (${maxPolls})`);
          authStatus = 'failed';
          errorMessage = 'Authentication is taking longer than expected. Please try again.';
          errorCode = 'TIMEOUT';
        }
        
        // Calculate total auth flow time
        const totalAuthTime = Date.now() - requestStartTime;
        console.log(`[BUSINESS_AUTH:${traceId}] ⏱️ Total authentication flow time: ${totalAuthTime}ms`);
        
        // Process the final result
        if (authStatus === 'success') {
          console.log(`[BUSINESS_AUTH:${traceId}] 🎉 AUTHENTICATION SUCCESSFUL`);
          console.log(`[BUSINESS_AUTH:${traceId}] Total time: ${totalAuthTime}ms`);
          console.log(`[BUSINESS_AUTH:${traceId}] Poll attempts: ${progressCheck}`);
          
          // If we have a screenshot, log it
          if (screenshot) {
            console.log(`[BUSINESS_AUTH:${traceId}] Authentication success screenshot available`);
          }
          
          // Close the auth modal
          setIsAuthModalOpen(false);
          
          // Clear the credentials from state for security
          setEmail("");
          setPassword("");
          
          // Run the compliance check again
          console.log(`[BUSINESS_AUTH:${traceId}] 🔄 Authentication successful, running compliance check`);
          await performComplianceCheck(true);
          
          // Log completion
          console.log(`[BUSINESS_AUTH:${traceId}] ✅ AUTHENTICATION FLOW COMPLETED SUCCESSFULLY`);
        } else {
          // Authentication failed - detailed error handling
          console.error(`[BUSINESS_AUTH:${traceId}] ❌ AUTHENTICATION FLOW FAILED`);
          console.error(`[BUSINESS_AUTH:${traceId}] Total time: ${totalAuthTime}ms`);
          console.error(`[BUSINESS_AUTH:${traceId}] Poll attempts: ${progressCheck}`);
          console.error(`[BUSINESS_AUTH:${traceId}] Error code: ${errorCode}`);
          console.error(`[BUSINESS_AUTH:${traceId}] Error message: ${errorMessage}`);
          
          // Get detailed error message based on error code
          let detailedErrorMessage = errorMessage || "Authentication failed. Please try again.";
          
          // Provide more specific error messages based on error codes
          if (errorCode === 'WRONG_PASSWORD') {
            detailedErrorMessage = "The email or password you entered is incorrect. Please check your credentials and try again.";
          } else if (errorCode === 'ACCOUNT_LOCKED') {
            detailedErrorMessage = "Your account has been temporarily locked due to too many failed attempts. Please try again in 30 minutes or reset your password through Google.";
          } else if (errorCode === 'VERIFICATION_REQUIRED') {
            detailedErrorMessage = "Google requires additional verification. Please sign in directly to Google first, then try again.";
          } else if (errorCode === 'TWO_FACTOR_REQUIRED') {
            detailedErrorMessage = "This account has two-factor authentication enabled. Please sign in directly to Google first, then try again.";
          } else if (errorCode === 'SUSPICIOUS_ACTIVITY') {
            detailedErrorMessage = "Google detected suspicious activity. Please sign in directly to Google to resolve this issue.";
          } else if (errorCode === 'BROWSER_SERVICE_UNHEALTHY') {
            detailedErrorMessage = "Our authentication service is currently unavailable. Please try again later.";
          } else if (errorCode === 'TIMEOUT') {
            detailedErrorMessage = "Authentication timed out. This could be due to slow internet connection or high server load. Please try again.";
          }
          
          // Add troubleshooting information for most errors
          if (errorCode !== 'WRONG_PASSWORD') {
            detailedErrorMessage += "\n\nTroubleshooting steps:\n1. Check your internet connection\n2. Try again in a few minutes\n3. Make sure you are using the same Google account that manages your Business Profile";
          }
          
          // If we have a screenshot, log it
          if (screenshot) {
            console.log(`[BUSINESS_AUTH:${traceId}] Authentication error screenshot available`);
          }
          
          // Update UI with error
          console.log(`[BUSINESS_AUTH:${traceId}] ⚠️ Setting user-facing error message: ${detailedErrorMessage.split('\n')[0]}`);
          setAuthError(detailedErrorMessage);
          
          // Log completion
          console.log(`[BUSINESS_AUTH:${traceId}] ❌ AUTHENTICATION FLOW COMPLETED WITH ERRORS`);
        }
      } else {
        // The API call itself failed
        console.error(`[BUSINESS_AUTH:${traceId}] ❌ API REQUEST FAILED`);
        console.error(`[BUSINESS_AUTH:${traceId}] Error: ${result.error || 'Unknown error'}`);
        console.error(`[BUSINESS_AUTH:${traceId}] Error code: ${result.errorCode || 'UNKNOWN'}`);
        
        // Format user-friendly error message
        const errorMessage = result.error || "Failed to start authentication. Please try again.";
        console.error(`[BUSINESS_AUTH:${traceId}] Auth API error for business ID ${businessId}: ${errorMessage}`);
        setAuthError(errorMessage);
        
        // Log completion
        console.log(`[BUSINESS_AUTH:${traceId}] ❌ AUTHENTICATION FLOW FAILED AT API REQUEST STAGE`);
      }
    } catch (error) {
      // Unhandled error during the entire process
      console.error(`[BUSINESS_AUTH:${traceId}] 💥 UNHANDLED EXCEPTION DURING AUTH FLOW`);
      console.error(`[BUSINESS_AUTH:${traceId}] Error type: ${error.name}`);
      console.error(`[BUSINESS_AUTH:${traceId}] Error message: ${error.message}`);
      console.error(`[BUSINESS_AUTH:${traceId}] Error stack: ${error.stack}`);
      
      // Log error analytics
      console.error(`[BUSINESS_AUTH:${traceId}] Total time before error: ${Date.now() - requestStartTime}ms`);
      console.error(`[BUSINESS_AUTH:${traceId}] Auth flow stage: ${isSubmittingAuth ? 'API Request/Polling' : 'Form Validation'}`);
      
      // Update UI with generic error
      setAuthError("An unexpected error occurred. Please try again later.");
      
      // Log completion
      console.log(`[BUSINESS_AUTH:${traceId}] ❌ AUTHENTICATION FLOW TERMINATED BY EXCEPTION`);
    } finally {
      // Always reset loading state
      setIsSubmittingAuth(false);
      
      // Final timing information
      const totalExecutionTime = Date.now() - requestStartTime;
      console.log(`[BUSINESS_AUTH:${traceId}] ⏱️ Total auth flow execution time: ${totalExecutionTime}ms`);
      
      // Log completion
      console.log(`[BUSINESS_AUTH:${traceId}] 🏁 AUTHENTICATION FLOW EXECUTION COMPLETED`);
    }
  }
  
  // Function to render the auth modal
  const renderAuthModal = () => {
    if (!isAuthModalOpen) return null
    
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="flex items-center mb-4">
            <div className="bg-[#0080FF]/10 p-2 rounded-full mr-3">
              <Lock className="h-6 w-6 text-[#0080FF]" />
            </div>
            <h3 className="text-xl font-semibold">Google Business Profile Login</h3>
          </div>
          
          <p className="text-gray-600 mb-4">
            Please enter your Google Business Profile credentials to continue with the compliance check.
          </p>
          
          {/* Enhanced error display with icon and more prominence */}
          {authError && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                {authError.split('\n').map((line, index) => (
                  <div key={index} className={index > 0 ? "mt-1" : ""}>
                    {line}
                    {/* Add a heading style to the troubleshooting section */}
                    {line === "Troubleshooting steps:" && <hr className="my-1 border-red-200" />}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <form onSubmit={handleAuthSubmit}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="flex items-center justify-between">
                  <span>Email</span>
                  {email && !email.includes('@') && (
                    <span className="text-red-500 text-xs">Invalid email format</span>
                  )}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="youremail@example.com"
                  className={`w-full mt-1 ${email && !email.includes('@') ? 'border-red-300 focus-visible:ring-red-400' : ''}`}
                  disabled={isSubmittingAuth}
                  autoComplete="email"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use <code>fail@example.com</code> to test error handling
                </p>
              </div>
              
              <div>
                <Label htmlFor="password" className="flex items-center justify-between">
                  <span>Password</span>
                  {password && password.length < 6 && (
                    <span className="text-red-500 text-xs">Min. 6 characters</span>
                  )}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full mt-1 ${password && password.length < 6 ? 'border-red-300 focus-visible:ring-red-400' : ''}`}
                  disabled={isSubmittingAuth}
                  autoComplete="current-password"
                  required
                />
              </div>
              
              <div className="flex justify-between items-center pt-2">
                <div className="text-sm">
                  <p className="text-gray-500">
                    Your credentials are used only to access your business profile
                  </p>
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAuthModalOpen(false)
                      setEmail("")
                      setPassword("")
                      setAuthError("")
                    }}
                    disabled={isSubmittingAuth}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingAuth || (email && !email.includes('@')) || (password && password.length < 6)}
                    className={`transition-all duration-200 ${isSubmittingAuth ? "opacity-70" : ""}`}
                  >
                    {isSubmittingAuth ? (
                      <span className="flex items-center">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                        Authenticating...
                      </span>
                    ) : (
                      "Submit"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // Function to render the steps with loading animations
  const renderSteps = () => {
    return (
      <div className="flex flex-col items-center max-w-2xl w-full mx-auto mt-[70px]">
        {steps.map((step, index) => {
          // Determine step status based on activeStep
          let status = "pending"
          if (index < activeStep) status = "completed"
          else if (index === activeStep) {
            status = isRunningCheck ? "in-progress" : (index === 2 && !isRunningCheck ? (isCompliant ? "completed" : "failed") : "pending")
          }
          
          // Format step's status for rendering
          const stepStatus = status as "completed" | "in-progress" | "failed" | "pending"
          
          return (
            <div key={index} className="mb-8 w-full">
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0 mt-1">
                  {stepStatus === "in-progress" ? (
                    <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-[#0080FF]/10 text-[#0080FF]">
                      <span className="absolute w-full h-full border-4 border-[#0080FF] rounded-full border-t-transparent animate-spin"></span>
                      <span>{index + 1}</span>
                    </div>
                  ) : stepStatus === "completed" ? (
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#0080FF] text-white">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                  ) : stepStatus === "failed" ? (
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#FF1681] text-white">
                      <XCircle className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-600">
                      <span>{index + 1}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="text-xl font-semibold flex items-center">
                      {step.title} 
                      {stepStatus === "in-progress" && (
                        <span className="ml-2 text-[#0080FF] text-sm animate-pulse">In progress...</span>
                      )}
                    </h3>
                    <p className="text-gray-600 mt-1">{step.description}</p>
                  </div>
                  
                  {/* For step 3, show compliance results if we're on that step and not running a check */}
                  {index === 2 && activeStep === 2 && !isRunningCheck && (
                    <div className="mt-4 p-4 rounded-lg border bg-gray-50">
                      {isCompliant ? (
                        <div className="flex items-center">
                          <div className="mr-4 flex-shrink-0">
                            <div className="bg-[#0080FF]/10 p-2 rounded-full">
                              <CheckCircle className="h-6 w-6 text-[#0080FF]" />
                            </div>
                          </div>
                          <div className="flex justify-between items-start w-full">
                            <div>
                              <p className="font-medium text-[#0080FF]">All set! Your profile is compliant</p>
                              <p className="text-sm text-gray-500">We'll check hourly to ensure continued compliance</p>
                            </div>
                            <div className="text-[#FF1681] font-mono font-bold">
                              {countdown.minutes.toString().padStart(2, '0')}:{countdown.seconds.toString().padStart(2, '0')}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center mb-4">
                            <div className="mr-4 flex-shrink-0">
                              <div className="bg-[#FF1681]/10 p-2 rounded-full">
                                <AlertCircle className="h-6 w-6 text-[#FF1681]" />
                              </div>
                            </div>
                            <div>
                              <p className="font-medium text-[#FF1681]">Compliance issues found</p>
                              <p className="text-sm text-gray-500">Please fix the following issues:</p>
                            </div>
                          </div>
                          
                          <div className="space-y-3 mt-2">
                            {issues.map((issue, idx) => (
                              <div 
                                key={idx} 
                                className={`p-3 rounded-lg border ${
                                  issue.severity === "high" ? "border-[#FF1681]/20 bg-[#FF1681]/5" : 
                                  issue.severity === "medium" ? "border-[#C939D6]/20 bg-[#C939D6]/5" : 
                                  "border-[#FFAB1A]/20 bg-[#FFAB1A]/5"
                                } ${issue.type === "auth_required" ? "cursor-pointer hover:bg-opacity-80" : ""}`}
                                onClick={() => {
                                  // When clicking on an auth_required issue, open the auth modal
                                  if (issue.type === "auth_required") {
                                    setCurrentIssueId(issue.id || "auth-issue");
                                    setIsAuthModalOpen(true);
                                  }
                                }}
                              >
                                <p className="font-medium">{issue.title}</p>
                                <p className="text-sm text-gray-700">{issue.description}</p>
                                {issue.type === "auth_required" && (
                                  <div className="mt-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-[#0080FF] border-[#0080FF] hover:bg-[#0080FF]/10"
                                      onClick={(e) => {
                                        e.stopPropagation();  // Prevent the parent div's onClick
                                        setCurrentIssueId(issue.id || "auth-issue");
                                        setIsAuthModalOpen(true);
                                      }}
                                    >
                                      <Lock className="w-4 h-4 mr-1" />
                                      Enter Credentials
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* For non-result steps, show loading animation when in progress */}
                  {stepStatus === "in-progress" && index !== 2 && (
                    <div className="flex flex-col items-center justify-center py-4">
                      <div className="w-8 h-8 border-t-2 border-[#0080FF] border-solid rounded-full animate-spin mb-2"></div>
                      <p className="text-[#0080FF] animate-pulse">
                        {index === 0 ? "Gathering information..." : "Analyzing compliance..."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Vertical connector between steps */}
              {index < steps.length - 1 && (
                <div className="ml-5 h-8 border-l-2 border-gray-200"></div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="m-0 p-6 h-full flex flex-col scrollbar-hide" data-tab="compliance">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-4xl font-bold">Compliance Check</h3>
            <Button
              variant="ghost"
              size="icon"
              className={`h-10 w-10 rounded-full border-2 flex-shrink-0 ${isRunningCheck ? 'border-[#0080FF] bg-[#0080FF]/10' : 'border-black hover:bg-[#0080FF]/5'}`}
              onClick={startComplianceCheck}
              disabled={isRunningCheck}
              aria-label="Run compliance check"
              title="Run compliance check"
            >
              <RefreshCw className={`h-5 w-5 ${isRunningCheck ? 'text-[#0080FF] animate-spin' : 'text-black'}`} />
            </Button>
          </div>
          <p className="text-gray-500 mt-1">We ensure your business profile meets all requirements</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusIndicator status={isCompliant ? "compliant" : "noncompliant"} />
          <span className="text-sm text-gray-500">{isCompliant ? "Compliant" : "Noncompliant"}</span>
        </div>
      </div>

      {/* Scrollable content area - with bottom padding to ensure content isn't cut off */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="py-4 px-2 pb-6">
          {renderSteps()}
        </div>
      </div>

      {/* Loading indicator shown near the top, so we don't need a bottom button anymore */}
      {isRunningCheck && (
        <div className="fixed bottom-16 right-16 bg-white shadow-md border rounded-lg py-2 px-4 z-10 flex items-center gap-2 animate-in fade-in-50 slide-in-from-bottom-5">
          <div className="w-5 h-5 border-t-2 border-[#0080FF] border-solid rounded-full animate-spin"></div>
          <span>Running compliance check...</span>
        </div>
      )}
      
      {/* Render auth modal when needed */}
      {renderAuthModal()}
    </div>
  )
}