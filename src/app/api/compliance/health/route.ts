import { NextRequest, NextResponse } from 'next/server';
import { BrowserAutomationConfig } from '@/lib/browser-automation/config';
import { logBrowserOperation, LogLevel, OperationCategory } from '@/utils/browser-logging';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

/**
 * API endpoint to check the health of the browser automation system
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Create a response object that will be built up with health check results
    const healthStatus = {
      success: true,
      systemStatus: 'healthy',
      endpoints: {
        apiEndpoint: BrowserAutomationConfig.apiUrl,
        apiVersion: BrowserAutomationConfig.apiVersion,
        apiHealthy: false
      },
      config: {
        isDevelopment: BrowserAutomationConfig.isDevelopment(),
        timeouts: {
          auth: BrowserAutomationConfig.timeouts.auth,
          profileUpdate: BrowserAutomationConfig.timeouts.profileUpdate,
          postCreation: BrowserAutomationConfig.timeouts.postCreation
        },
        polling: {
          interval: BrowserAutomationConfig.polling.interval,
          maxAttempts: BrowserAutomationConfig.polling.maxAttempts
        }
      },
      checks: {
        configCheck: true,
        apiCheck: false,
        browserServiceCheck: true
      },
      timestamp: new Date().toISOString(),
      responseTime: null as number | null
    };
    
    // Log the health check request
    logBrowserOperation(
      OperationCategory.API,
      `Health check requested`,
      LogLevel.INFO
    );
    
    // Check health of both browser automation implementations
    logBrowserOperation(
      OperationCategory.API,
      `Checking all browser service implementations...`,
      LogLevel.INFO
    );
    
    // Import the unified BrowserOperationService
    const { BrowserOperationService } = await import('@/lib/browser-automation/service-bridge');
    const browserOpService = BrowserOperationService.getInstance();
    
    try {
      // Check health of all available browser automation implementations
      const detailedHealth = await browserOpService.checkHealth();
      
      // Update the health status with detailed information
      healthStatus.endpoints.apiHealthy = detailedHealth.externalServiceHealthy;
      healthStatus.checks.apiCheck = detailedHealth.externalServiceHealthy;
      
      // Add detailed health information
      healthStatus.detailedHealth = {
        externalServiceHealthy: detailedHealth.externalServiceHealthy,
        browserManagerAvailable: detailedHealth.browserManagerAvailable,
        overallHealthy: detailedHealth.overallHealthy,
        browserDetails: detailedHealth.browserDetails || {},
        diagnostics: detailedHealth.diagnostics || {}
      };
      
      logBrowserOperation(
        OperationCategory.API,
        `Browser service health check result: ${JSON.stringify({
          external: detailedHealth.externalServiceHealthy ? 'HEALTHY' : 'UNHEALTHY',
          browserManager: detailedHealth.browserManagerAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
          overall: detailedHealth.overallHealthy ? 'HEALTHY' : 'UNHEALTHY',
          responseTime: detailedHealth.diagnostics?.apiResponseTime || 'unknown',
          instanceCount: detailedHealth.browserDetails?.instanceCount || 0
        })}`,
        detailedHealth.overallHealthy ? LogLevel.INFO : LogLevel.WARN
      );
      
      // Set the overall system status based on the detailed health check
      if (!detailedHealth.overallHealthy) {
        healthStatus.systemStatus = 'degraded';
        healthStatus.success = false;
      }
    } catch (healthError) {
      healthStatus.endpoints.apiHealthy = false;
      healthStatus.checks.apiCheck = false;
      healthStatus.systemStatus = 'critical';
      healthStatus.success = false;
      
      logBrowserOperation(
        OperationCategory.API,
        `All browser service implementations health check failed`,
        LogLevel.ERROR,
        healthError
      );
    }
    
    // Calculate response time
    const responseTime = Date.now() - startTime;
    healthStatus.responseTime = responseTime;
    
    logBrowserOperation(
      OperationCategory.API,
      `Health check completed in ${responseTime}ms, status: ${healthStatus.systemStatus}`,
      healthStatus.success ? LogLevel.INFO : LogLevel.WARN
    );
    
    // Return the health status
    return NextResponse.json(healthStatus);
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logBrowserOperation(
      OperationCategory.API,
      `Health check failed with error`,
      LogLevel.ERROR,
      error
    );
    
    return NextResponse.json({
      success: false,
      systemStatus: 'critical',
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      responseTime
    }, { status: 500 });
  }
}