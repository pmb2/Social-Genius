import { supervisorAgent } from '@/services/compliance/agno-agent';
import { ComplianceReport } from '@/services/compliance/models';

// Use a cache map to store compliance reports temporarily (for demo purposes)
// In a real implementation, this would be stored in a database or Redis cache
const reportsCache = new Map<string, any>();

/**
 * Trigger a compliance check for a business
 * 
 * @param businessId The ID of the business to check
 * @returns Object containing the job status
 */
export const triggerComplianceCheck = async (businessId: number) => {
  console.log(`Triggering compliance check for business ID: ${businessId}`);
  
  try {
    // Clear any cached report
    reportsCache.delete(businessId.toString());
    
    // In a real implementation, this would be a separate job/process
    // For demo, we'll run it immediately but not wait for results
    setTimeout(async () => {
      try {
        const result = await supervisorAgent.runComplianceCheck(businessId.toString());
        reportsCache.set(businessId.toString(), result);
        console.log(`Compliance check completed for business ID: ${businessId}`);
      } catch (error) {
        console.error(`Error running compliance check for business ID: ${businessId}:`, error);
      }
    }, 0);
    
    return { success: true, jobId: `compliance-job-${Date.now()}` };
  } catch (error) {
    console.error(`Error triggering compliance check for business ID: ${businessId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Get the compliance report for a business
 * 
 * @param businessId The ID of the business
 * @returns The compliance report
 */
export const getComplianceReport = async (businessId: number) => {
  console.log(`Getting compliance report for business ID: ${businessId}`);
  
  try {
    // Check if we have a cached report
    if (reportsCache.has(businessId.toString())) {
      const cached = reportsCache.get(businessId.toString());
      
      // If the cached report has an error, return a formatted error report
      if (cached.status === 'error' || cached.status === 'auth_required') {
        // Special handling for authentication required errors
        if (cached.status === 'auth_required') {
          return {
            status: "AUTH_REQUIRED",
            completionRate: 0,
            issues: [
              { 
                type: "auth_required", 
                severity: "high", 
                description: cached.message || "Google Business Profile authentication required",
                suggestedAction: "Please provide your Google Business Profile credentials" 
              }
            ],
          };
        }
        
        return {
          status: "ERROR",
          completionRate: 0,
          issues: [
            { 
              type: "system_error", 
              severity: "high", 
              description: cached.error || "Unknown system error" 
            }
          ],
        };
      }
      
      // Convert from our internal format to the format expected by the frontend
      const report = cached.report as ComplianceReport;
      
      return {
        status: report.status,
        completionRate: report.score,
        issues: report.issues.map(issue => ({
          type: issue.issueType,
          severity: issue.severity,
          description: issue.description,
          suggestedAction: issue.suggestedAction
        })),
      };
    }
    
    // If no cached report, return a placeholder
    // In a real implementation, we would fetch from a database or API
    return {
      status: "PENDING",
      completionRate: 0,
      issues: [
        { type: "pending", severity: "medium" as const, description: "Compliance check pending or in progress" },
      ],
    };
  } catch (error) {
    console.error(`Error getting compliance report for business ID: ${businessId}:`, error);
    return {
      status: "ERROR",
      completionRate: 0,
      issues: [
        { 
          type: "system_error", 
          severity: "high" as const, 
          description: error instanceof Error ? error.message : String(error) 
        },
      ],
    };
  }
}

/**
 * Resolve a compliance issue for a business
 * 
 * @param businessId The ID of the business
 * @param issueType The type of issue to resolve
 * @param data The data needed to resolve the issue
 * @returns Status of the resolution
 */
export const resolveComplianceIssue = async (businessId: number, issueId: string, data: any) => {
  console.log(`Resolving issue ${issueId} for business ID: ${businessId} with data type: ${data.issueType}`);
  
  try {
    // Special handling for auth_required issue type
    if (data.issueType === 'auth_required') {
      console.log(`[COMPLIANCE] Handling authentication request for business ID: ${businessId}`);
      
      if (!data.email || !data.password) {
        console.error(`[COMPLIANCE] Missing credentials for business ID: ${businessId}`);
        return {
          success: false,
          error: 'Email and password are required',
          errorCode: 'MISSING_CREDENTIALS'
        };
      }
      
      const { handleBusinessAuthentication } = await import('@/services/compliance/auth-service');
      
      console.log(`[COMPLIANCE] Submitting credentials for business ID: ${businessId}`);
      
      // Process authentication with provided credentials
      const authResult = await handleBusinessAuthentication(
        businessId.toString(),
        {
          email: data.email,
          password: data.password
        }
      );
      
      // Log detailed auth result with timing information (excluding password)
      const authResultSummary = {
        success: authResult.success,
        message: authResult.message,
        errorCode: authResult.errorCode,
        totalTimeMs: authResult.debugInfo?.totalTimeMs,
        steps: authResult.debugInfo?.steps?.map(step => ({
          step: step.step,
          status: step.status,
          timing: step.timing
        }))
      };
      
      console.log(`[COMPLIANCE] Authentication result for business ID: ${businessId}:`, 
        JSON.stringify(authResultSummary));
      
      // Log authentication steps in a readable format for easier debugging
      if (authResult.debugInfo?.steps) {
        console.log(`[COMPLIANCE] Authentication steps for business ID: ${businessId}:`);
        authResult.debugInfo.steps.forEach((step, index) => {
          const statusIcon = step.status === 'success' ? '✓' : 
                           step.status === 'failed' ? '✗' : 
                           step.status === 'pending' ? '⋯' : 
                           step.status === 'blocked' ? '⚠' : '?';
                           
          console.log(`[COMPLIANCE] Step ${index + 1}: ${statusIcon} ${step.step} - ${step.status}${step.timing ? ` (${step.timing}ms)` : ''}${step.reason ? ` - ${step.reason}` : ''}`);
        });
      }
      
      // If authentication was successful, remove cached report to force refresh
      if (authResult.success) {
        console.log(`[COMPLIANCE] Authentication successful for business ID: ${businessId}, clearing cache`);
        reportsCache.delete(businessId.toString());
        
        // Trigger a new compliance check after successful authentication
        setTimeout(async () => {
          try {
            console.log(`[COMPLIANCE] Starting new compliance check after authentication for business ID: ${businessId}`);
            const result = await supervisorAgent.runComplianceCheck(businessId.toString());
            reportsCache.set(businessId.toString(), result);
            console.log(`[COMPLIANCE] Post-authentication compliance check completed for business ID: ${businessId}`);
          } catch (error) {
            console.error(`[COMPLIANCE] Error running post-authentication compliance check for business ID: ${businessId}:`, error);
          }
        }, 0);
        
        return {
          success: true,
          message: 'Google Business Profile authenticated successfully',
          action: 'refresh'
        };
      } else {
        console.error(`[COMPLIANCE] Authentication failed for business ID: ${businessId}: ${authResult.message}`);
        return {
          success: false,
          error: authResult.message || 'Authentication failed',
          errorCode: authResult.errorCode || 'AUTH_FAILED'
        };
      }
    }
    
    // For other issue types, proceed with normal resolution
    console.log(`[COMPLIANCE] Processing standard issue resolution for business ID: ${businessId}, issue type: ${data.issueType}`);
    const result = await supervisorAgent.processUserInput(
      businessId.toString(),
      issueId,
      data
    );
    
    // Remove the cached report to force a refresh
    reportsCache.delete(businessId.toString());
    
    console.log(`[COMPLIANCE] Issue resolution complete for business ID: ${businessId}, status: ${result.status}`);
    return { 
      success: result.status === 'success', 
      message: result.message || 'Issue resolution processed'
    };
  } catch (error) {
    console.error(`[COMPLIANCE] Error resolving compliance issue for business ID: ${businessId}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      errorCode: 'RESOLUTION_ERROR'
    };
  }
}

/**
 * Handle Google Business Profile authentication
 * 
 * @param businessId The ID of the business
 * @param credentials The user credentials (email and password)
 * @returns Status of the authentication
 */
export const authenticateGBP = async (businessId: number, credentials: { email: string; password: string }) => {
  console.log(`Authenticating GBP for business ID: ${businessId}`);
  
  try {
    const { handleBusinessAuthentication } = await import('@/services/compliance/auth-service');
    
    // Process authentication
    const authResult = await handleBusinessAuthentication(
      businessId.toString(),
      credentials
    );
    
    // If authentication was successful, remove cached report to force refresh
    if (authResult.success) {
      reportsCache.delete(businessId.toString());
    }
    
    return {
      success: authResult.success,
      message: authResult.message || (authResult.success ? 'Authentication successful' : 'Authentication failed')
    };
  } catch (error) {
    console.error(`Error authenticating GBP for business ID: ${businessId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

