import axios from 'axios';

// Environment variable for Browser-Use API URL
const BROWSER_USE_API_URL = process.env.BROWSER_USE_API_URL || 'http://localhost:5055';

// Types for Browser-Use API
export interface BrowserTask {
  businessId: string;
  taskId?: string;
  email: string;
  password: string;
  taskType: 'login' | 'post' | 'info' | 'review';
  timeout?: number;
  additionalData?: Record<string, any>;
}

export interface BrowserTaskResult {
  taskId: string;
  businessId: string;
  status: 'success' | 'failed' | 'in_progress';
  result?: any;
  error?: string;
  screenshot?: string;
}

// Browser Automation Service
export class BrowserAutomationService {
  private static instance: BrowserAutomationService;

  private constructor() {}

  public static getInstance(): BrowserAutomationService {
    if (!BrowserAutomationService.instance) {
      BrowserAutomationService.instance = new BrowserAutomationService();
    }
    return BrowserAutomationService.instance;
  }

  /**
   * Authenticate with Google using browser automation
   * @param businessId The business ID to associate with this authentication session
   * @param email Google account email
   * @param password Google account password
   */
  public async authenticateGoogle(
    businessId: string,
    email: string,
    password: string
  ): Promise<BrowserTaskResult> {
    try {
      console.log(`Initiating Google authentication for business ID: ${businessId}`);
      
      const response = await axios.post(`${BROWSER_USE_API_URL}/authenticate`, {
        businessId,
        email,
        password,
        taskType: 'login',
        timeout: 60000 // 60 seconds
      });
      
      return {
        taskId: response.data.taskId,
        businessId,
        status: response.data.success ? 'success' : 'failed',
        result: response.data.result,
        error: response.data.error,
        screenshot: response.data.screenshot
      };
    } catch (error) {
      console.error('Authentication error:', error);
      
      return {
        taskId: 'error',
        businessId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error during authentication'
      };
    }
  }

  /**
   * Check the status of a running task
   * @param taskId The ID of the task to check
   */
  public async checkTaskStatus(taskId: string): Promise<BrowserTaskResult> {
    try {
      const response = await axios.get(`${BROWSER_USE_API_URL}/task/${taskId}`);
      
      return {
        taskId,
        businessId: response.data.businessId,
        status: response.data.status,
        result: response.data.result,
        error: response.data.error,
        screenshot: response.data.screenshot
      };
    } catch (error) {
      console.error('Task status check error:', error);
      
      return {
        taskId,
        businessId: 'unknown',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error checking task status'
      };
    }
  }

  /**
   * Get screenshot from a task
   * @param taskId The ID of the task
   * @param businessId The business ID
   */
  public async getScreenshot(taskId: string, businessId: string): Promise<string | null> {
    try {
      const response = await axios.get(`${BROWSER_USE_API_URL}/screenshot/${businessId}/${taskId}`, {
        responseType: 'arraybuffer'
      });
      
      // Convert array buffer to base64
      const base64 = Buffer.from(response.data, 'binary').toString('base64');
      return `data:image/png;base64,${base64}`;
    } catch (error) {
      console.error('Screenshot retrieval error:', error);
      return null;
    }
  }

  /**
   * Perform a Google Business Profile update
   * @param businessId The business ID
   * @param email Google account email
   * @param password Google account password
   * @param updateData The data to update on the profile
   */
  public async updateBusinessProfile(
    businessId: string,
    email: string,
    password: string,
    updateData: Record<string, any>
  ): Promise<BrowserTaskResult> {
    try {
      const response = await axios.post(`${BROWSER_USE_API_URL}/update-profile`, {
        businessId,
        email,
        password,
        taskType: 'info',
        additionalData: updateData,
        timeout: 120000 // 2 minutes
      });
      
      return {
        taskId: response.data.taskId,
        businessId,
        status: response.data.success ? 'success' : 'failed',
        result: response.data.result,
        error: response.data.error,
        screenshot: response.data.screenshot
      };
    } catch (error) {
      console.error('Business profile update error:', error);
      
      return {
        taskId: 'error',
        businessId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error during profile update'
      };
    }
  }

  /**
   * Create a new post on Google Business Profile
   * @param businessId The business ID
   * @param email Google account email
   * @param password Google account password
   * @param postData The post data (text, image, etc.)
   */
  public async createBusinessPost(
    businessId: string,
    email: string,
    password: string,
    postData: {
      text: string;
      imageUrl?: string;
      buttonText?: string;
      buttonUrl?: string;
    }
  ): Promise<BrowserTaskResult> {
    try {
      const response = await axios.post(`${BROWSER_USE_API_URL}/create-post`, {
        businessId,
        email,
        password,
        taskType: 'post',
        additionalData: postData,
        timeout: 120000 // 2 minutes
      });
      
      return {
        taskId: response.data.taskId,
        businessId,
        status: response.data.success ? 'success' : 'failed',
        result: response.data.result,
        error: response.data.error,
        screenshot: response.data.screenshot
      };
    } catch (error) {
      console.error('Business post creation error:', error);
      
      return {
        taskId: 'error',
        businessId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error during post creation'
      };
    }
  }

  /**
   * Check health status of the browser-use API
   */
  public async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${BROWSER_USE_API_URL}/health`);
      return response.data.status === 'healthy';
    } catch (error) {
      console.error('Browser-use API health check failed:', error);
      return false;
    }
  }
}