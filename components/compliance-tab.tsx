"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusIndicator } from "./status-indicator"
import { steps } from "@/types/business-profile"
import { triggerComplianceCheck, getComplianceReport, resolveComplianceIssue } from "@/services/compliance-service"
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

  // Countdown timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isCompliant) {
      // Reset countdown when compliance is achieved
      setCountdown({ minutes: 59, seconds: 59 });
      
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev.seconds > 0) {
            return { ...prev, seconds: prev.seconds - 1 };
          } else if (prev.minutes > 0) {
            return { minutes: prev.minutes - 1, seconds: 59 };
          } else {
            // When timer reaches 00:00, trigger a background compliance check
            // This is where we would silently run a compliance check without showing UI progress
            
            // PLACEHOLDER: This would trigger the automatic compliance check
            // performComplianceCheck(false).then(isStillCompliant => {
            //   console.log("Automatic compliance check completed:", isStillCompliant);
            //   // Any additional logic after the automatic check
            // });

            // For now just leave this placeholder/comment until the backend
            // supports automatic background checks
            
            // Reset to 59:59 after triggering the check
            return { minutes: 59, seconds: 59 };
          }
        });
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isCompliant, businessId]);

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
    
    // Enhanced validation with better error messaging
    if (!email) {
      setAuthError("Please enter your email address")
      return
    }
    
    if (!email.includes('@')) {
      setAuthError("Please enter a valid email address")
      return
    }
    
    if (!password) {
      setAuthError("Please enter your password")
      return
    }
    
    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters long")
      return
    }
    
    setIsSubmittingAuth(true)
    setAuthError("")
    
    console.log(`Submitting GBP credentials for business ID: ${businessId}`)
    
    try {
      // Use the server API endpoint instead of direct service call
      const response = await fetch('/api/compliance/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId,
          email,
          password
        }),
      });
      
      const result = await response.json();
      
      console.log(`Authentication result for business ID ${businessId}:`, { 
        success: result.success,
        message: result.message,
        error: result.error,
        errorCode: result.errorCode
      })
      
      if (result.success) {
        // Close the auth modal
        setIsAuthModalOpen(false)
        
        // Clear the credentials from state for security
        setEmail("")
        setPassword("")
        
        // Show a temporary success message
        setActiveStep(0) // Reset to step 1
        
        // Re-run the compliance check to get updated status
        console.log("Authentication successful, running compliance check again")
        await performComplianceCheck(true)
      } else {
        // Map error codes to detailed, user-friendly messages
        let errorMessage = result.error || "Authentication failed. Please try again."
        
        // Provide more specific error messages based on error codes with troubleshooting steps
        if (result.errorCode === 'INVALID_CREDENTIALS') {
          errorMessage = "The email or password you entered is incorrect. Please check your credentials and try again."
        } else if (result.errorCode === 'ACCOUNT_LOCKED') {
          errorMessage = "Your account has been temporarily locked due to too many failed attempts. Please try again in 30 minutes or reset your password through Google."
        } else if (result.errorCode === 'TECHNICAL_ERROR') {
          errorMessage = "We're experiencing technical difficulties with our authentication service. Our team has been notified and is working on a solution. Please try again in a few minutes."
        } else if (result.errorCode === 'TIMEOUT') {
          errorMessage = "Authentication timed out. This could be due to slow internet connection or high server load. Please try again."
        } else if (result.errorCode === 'BROWSER_LAUNCH_FAILED') {
          errorMessage = "Failed to initialize the authentication process. This might be a temporary issue with our automation system. Please try again in a few minutes."
        } else if (result.errorCode === 'UNEXPECTED_ERROR') {
          errorMessage = "An unexpected error occurred during authentication. This is usually due to a temporary issue with our server. Please try again, and if the problem persists, contact support."
        } else if (result.errorCode === 'LOGIN_FAILED') {
          errorMessage = "Failed to log in to Google Business Profile. Please ensure you're using the correct email and password associated with your business profile."
        }
        
        // Add troubleshooting information if not in the INVALID_CREDENTIALS case
        if (result.errorCode !== 'INVALID_CREDENTIALS') {
          errorMessage += "\n\nTroubleshooting steps:\n1. Check your internet connection\n2. Try again in a few minutes\n3. Make sure you are using the same Google account that manages your Business Profile"
        }
        
        console.error(`Authentication error for business ID ${businessId}: ${errorMessage}`)
        setAuthError(errorMessage)
      }
    } catch (error) {
      console.error("Error submitting authentication:", error)
      setAuthError("An unexpected error occurred. Please try again later.")
    } finally {
      setIsSubmittingAuth(false)
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