import { supervisorAgent } from '@/lib/compliance';
import { ComplianceReport } from '@/lib/compliance/models';

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
      if (cached.status === 'error') {
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
  console.log(`Resolving issue ${issueId} for business ID: ${businessId} with data:`, data);
  
  try {
    // Process the user input to resolve the issue
    const result = await supervisorAgent.processUserInput(
      businessId.toString(),
      issueId,
      data
    );
    
    // Remove the cached report to force a refresh
    reportsCache.delete(businessId.toString());
    
    return { 
      success: result.status === 'success', 
      message: result.message || 'Issue resolution processed'
    };
  } catch (error) {
    console.error(`Error resolving compliance issue for business ID: ${businessId}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

