"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { StatusIndicator } from "./status-indicator"
import { steps } from "@/types/business-profile"
import { triggerComplianceCheck, getComplianceReport } from "@/services/compliance-service"
import { CheckCircle, AlertCircle, XCircle } from "lucide-react"
import Image from "next/image"

interface ComplianceTabProps {
  businessId: number
}

export function ComplianceTab({ businessId }: ComplianceTabProps) {
  const [activeStep, setActiveStep] = useState(0)
  const [isRunningCheck, setIsRunningCheck] = useState(false)
  const [isCompliant, setIsCompliant] = useState(false)
  const [countdown, setCountdown] = useState({ minutes: 59, seconds: 59 })
  const [issues, setIssues] = useState<{
    title: string;
    description: string;
    severity: "high" | "medium" | "low";
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
      if (showProgress) {
        // Step 1: Gathering info
        await new Promise(resolve => setTimeout(resolve, 1500))
        setActiveStep(1)
      }
      
      // Step 2: Checking compliance
      await triggerComplianceCheck(businessId)
      if (showProgress) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      
      // Step 3: Results
      if (showProgress) {
        setActiveStep(2)
      }
      const report = await getComplianceReport(businessId)
      
      // Randomly set compliance status for demo
      const randomCompliance = Math.random() > 0.7
      setIsCompliant(randomCompliance)
      
      // If we're compliant, clear issues and reset countdown
      if (randomCompliance) {
        setIssues([])
        setCountdown({ minutes: 59, seconds: 59 })
      }
      
      return randomCompliance
    } catch (error) {
      console.error("Error running compliance check:", error)
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
                              <div key={idx} className={`p-3 rounded-lg border ${
                                issue.severity === "high" ? "border-[#FF1681]/20 bg-[#FF1681]/5" : 
                                issue.severity === "medium" ? "border-[#C939D6]/20 bg-[#C939D6]/5" : 
                                "border-[#FFAB1A]/20 bg-[#FFAB1A]/5"
                              }`}>
                                <p className="font-medium">{issue.title}</p>
                                <p className="text-sm text-gray-700">{issue.description}</p>
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
    <div className="m-0 p-6 h-full min-h-[600px] flex flex-col overflow-hidden">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-4xl font-bold">Compliance Check</h3>
          <p className="text-gray-500 mt-1">We ensure your business profile meets all requirements</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusIndicator status={isCompliant ? "compliant" : "noncompliant"} />
          <span className="text-sm text-gray-500">{isCompliant ? "Compliant" : "Noncompliant"}</span>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto pr-2">
        <div className="py-6">
          {renderSteps()}
        </div>
      </div>

      {/* Button area */}
      <div className="mt-4 pt-2 flex justify-center">
        {isRunningCheck ? (
          <div className="flex items-center gap-2 py-2 px-4 bg-gray-100 rounded-md">
            <div className="w-5 h-5 border-t-2 border-[#0080FF] border-solid rounded-full animate-spin"></div>
            <span>Running compliance check...</span>
          </div>
        ) : (
          <Button
            onClick={startComplianceCheck}
            className="bg-white border-2 border-black text-black hover:bg-[#0080FF]/5"
          >
            Run Compliance Check
          </Button>
        )}
      </div>
    </div>
  )
}