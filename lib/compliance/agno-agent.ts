/**
 * Agno Agent
 *
 * A wrapper around Playwright that provides higher-level automation capabilities
 * for common web interactions. This integrates with the Agno framework but
 * can work independently as a fallback.
 */

import { Page } from 'playwright';

interface LoginOptions {
  emailSelector: string;
  emailNextSelector: string;
  passwordSelector: string;
  passwordNextSelector: string;
  credentials: {
    email: string;
    password: string;
  };
  successIndicator: string; // URL or selector to verify successful login
}

interface LoginResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  message?: string;
}

export class AgnoAgent {
  private page: Page;
  private hasAgnoLib: boolean = false;
  private agnoLib: any = null;

  constructor(page: Page) {
    this.page = page;
    
    // Try to load the Agno library if it exists
    this.initAgno().catch(error => {
      console.warn('Failed to initialize Agno library, falling back to built-in methods:', error);
      this.hasAgnoLib = false;
    });
  }

  /**
   * Initialize the Agno library if available
   */
  private async initAgno(): Promise<void> {
    try {
      // In a real implementation, we would have a JavaScript wrapper 
      // around the Python Agno library, or use a JS alternative like Motia
      
      // For now, we'll just set hasAgnoLib to false and use our built-in methods
      this.hasAgnoLib = false;
      
      // Future implementation would replace this with actual Motia integration
      // Example: const motia = await import('motia');
      // this.agnoLib = new motia.Agent(this.page);
      // this.hasAgnoLib = true;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Using built-in browser automation methods (Agno/Motia not integrated)');
      }
    } catch (error) {
      this.hasAgnoLib = false;
      if (process.env.NODE_ENV === 'development') {
        console.warn('Browser automation library initialization failed, using built-in methods');
      }
    }
  }

  /**
   * Navigate to a URL
   */
  public async navigate(url: string): Promise<void> {
    console.log(`Navigating to: ${url}`);
    
    if (this.hasAgnoLib && this.agnoLib) {
      await this.agnoLib.navigate(url);
    } else {
      await this.page.goto(url, { waitUntil: 'networkidle' });
    }
  }

  /**
   * Perform login on a website
   */
  public async performLogin(options: LoginOptions): Promise<LoginResult> {
    console.log(`Attempting login with email: ${options.credentials.email}`);
    
    try {
      // Use the Agno library if available
      if (this.hasAgnoLib && this.agnoLib) {
        return await this.agnoLibLogin(options);
      }
      
      // Otherwise use our built-in login implementation
      return await this.builtInLogin(options);
    } catch (error) {
      console.error('Login failed with error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'LOGIN_ERROR',
        message: 'An unexpected error occurred during login'
      };
    }
  }

  /**
   * Login using the Agno library
   */
  private async agnoLibLogin(options: LoginOptions): Promise<LoginResult> {
    try {
      // Call the login method from the Agno library
      const result = await this.agnoLib.login({
        emailField: options.emailSelector,
        emailNextButton: options.emailNextSelector,
        passwordField: options.passwordSelector,
        passwordNextButton: options.passwordNextSelector,
        email: options.credentials.email,
        password: options.credentials.password,
        successCheck: {
          type: 'url',
          value: options.successIndicator
        }
      });
      
      if (result.success) {
        return {
          success: true,
          message: 'Login successful using Agno'
        };
      } else {
        return {
          success: false,
          error: result.error || 'Login failed',
          errorCode: result.errorCode || 'LOGIN_FAILED',
          message: result.message || 'Failed to log in using Agno'
        };
      }
    } catch (error) {
      console.error('Agno login failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'AGNO_LOGIN_ERROR',
        message: 'Error using Agno login system'
      };
    }
  }

  /**
   * Login using built-in Playwright-based implementation
   */
  private async builtInLogin(options: LoginOptions): Promise<LoginResult> {
    try {
      console.log('Using built-in login implementation');
      
      // Step 1: Wait for email field and fill it
      console.log(`Waiting for email field: ${options.emailSelector}`);
      await this.page.waitForSelector(options.emailSelector, { timeout: 10000 });
      await this.page.fill(options.emailSelector, options.credentials.email);
      
      // Step 2: Click the next button after email
      console.log(`Clicking email next button: ${options.emailNextSelector}`);
      await this.page.click(options.emailNextSelector);
      
      // Step 3: Wait for password field and fill it
      console.log(`Waiting for password field: ${options.passwordSelector}`);
      await this.page.waitForSelector(options.passwordSelector, { timeout: 10000 });
      await this.page.fill(options.passwordSelector, options.credentials.password);
      
      // Step 4: Click the login/next button
      console.log(`Clicking password next button: ${options.passwordNextSelector}`);
      await this.page.click(options.passwordNextSelector);
      
      // Step 5: Check for successful login
      console.log(`Checking for successful login indicator: ${options.successIndicator}`);
      
      // If the success indicator is a URL
      if (options.successIndicator.includes('.com/') || options.successIndicator.includes('http')) {
        try {
          // Wait for navigation to the success URL
          await this.page.waitForNavigation({ 
            url: url => url.includes(options.successIndicator),
            timeout: 15000
          });
          console.log('Login successful - detected success URL');
          return { success: true };
        } catch (navError) {
          // If navigation timeout, check for error messages
          console.log('Navigation timeout, checking for error messages');
          
          // Check for common error messages
          const errorSelectors = [
            '.o6cuMc', // Google common error class
            '[role="alert"]', // Accessibility error
            '.error-message', // Generic error class
            '#error-message', // Generic error ID
          ];
          
          for (const selector of errorSelectors) {
            const errorElement = await this.page.$(selector);
            if (errorElement) {
              const errorText = await errorElement.textContent();
              return {
                success: false,
                error: errorText || 'Login error detected',
                errorCode: 'LOGIN_FORM_ERROR',
                message: errorText || 'An error occurred during login'
              };
            }
          }
          
          // If no specific error found, return navigation timeout
          return {
            success: false,
            error: navError instanceof Error ? navError.message : String(navError),
            errorCode: 'LOGIN_TIMEOUT',
            message: 'Login timed out waiting for success page'
          };
        }
      } 
      // If the success indicator is a selector
      else {
        try {
          // Wait for the success element to appear
          await this.page.waitForSelector(options.successIndicator, { timeout: 15000 });
          console.log('Login successful - detected success element');
          return { success: true };
        } catch (selectorError) {
          return {
            success: false,
            error: selectorError instanceof Error ? selectorError.message : String(selectorError),
            errorCode: 'SUCCESS_ELEMENT_NOT_FOUND',
            message: 'Login verification failed: success element not found'
          };
        }
      }
    } catch (error) {
      console.error('Built-in login failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'LOGIN_PROCESS_ERROR',
        message: 'Error in login process'
      };
    }
  }

  /**
   * Fill a form field
   */
  public async fillField(selector: string, value: string): Promise<void> {
    if (this.hasAgnoLib && this.agnoLib) {
      await this.agnoLib.fillField(selector, value);
    } else {
      await this.page.fill(selector, value);
    }
  }

  /**
   * Click an element
   */
  public async click(selector: string): Promise<void> {
    if (this.hasAgnoLib && this.agnoLib) {
      await this.agnoLib.click(selector);
    } else {
      await this.page.click(selector);
    }
  }

  /**
   * Get text content from an element
   */
  public async getText(selector: string): Promise<string | null> {
    if (this.hasAgnoLib && this.agnoLib) {
      return await this.agnoLib.getText(selector);
    } else {
      const element = await this.page.$(selector);
      if (!element) return null;
      return await element.textContent();
    }
  }

  /**
   * Check if an element exists
   */
  public async elementExists(selector: string): Promise<boolean> {
    if (this.hasAgnoLib && this.agnoLib) {
      return await this.agnoLib.elementExists(selector);
    } else {
      const element = await this.page.$(selector);
      return !!element;
    }
  }

  /**
   * Wait for an element to appear
   */
  public async waitForElement(selector: string, timeout: number = 10000): Promise<boolean> {
    try {
      if (this.hasAgnoLib && this.agnoLib) {
        return await this.agnoLib.waitForElement(selector, timeout);
      } else {
        await this.page.waitForSelector(selector, { timeout });
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Take a screenshot
   */
  public async takeScreenshot(path?: string): Promise<Buffer> {
    if (this.hasAgnoLib && this.agnoLib) {
      return await this.agnoLib.takeScreenshot(path);
    } else {
      return await this.page.screenshot({ path });
    }
  }

  /**
   * Get the current URL
   */
  public async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  /**
   * Execute JavaScript in the browser context
   */
  public async evaluate<T>(
    pageFunction: string | ((...args: any[]) => any | Promise<any>), 
    ...args: any[]
  ): Promise<T> {
    return await this.page.evaluate(pageFunction, ...args);
  }

  /**
   * Get the raw Playwright page
   */
  public getPage(): Page {
    return this.page;
  }
}