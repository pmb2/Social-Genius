/**
 * Google Authentication Login Sequence
 * 
 * This module provides structured login flows for Google Business Profile authentication
 * with human-like behavior patterns and challenge detection/handling.
 */

import type { Page, BrowserContext } from 'playwright';
import { createError, ErrorCodes, ErrorRetry, BrowserAutomationError } from '../error-types';
import { v4 as uuidv4 } from 'uuid';

// Login sequence configuration
export interface LoginConfig {
  email: string;
  password: string;
  businessId: string;
  traceId?: string;
  delayFactor?: number; // Multiplier for all delays (1.0 = normal, 0.5 = faster, 2.0 = slower)
  maxRetries?: number;
  humanEmulation?: boolean;
  screenshotOnError?: boolean;
  screenshotPath?: string;
  timeout?: number; // Overall timeout in milliseconds
  headless?: boolean;
  detectDevtools?: boolean; // Try to detect and avoid bot detection
  cookieRestoration?: boolean; // Whether to focus on cookie restoration
}

// Login result interface
export interface LoginResult {
  success: boolean;
  sessionId?: string;
  businessId: string;
  error?: string;
  errorCode?: string;
  challenge?: string;
  screenshot?: string; // Base64 encoded screenshot
  cookies?: any[];
  profile?: any;
  metadata?: any;
  traceId: string;
  timestamp: string;
}

// Challenge types that can be encountered during login
export enum ChallengeType {
  CAPTCHA = 'captcha',
  TWO_FACTOR = 'two_factor',
  VERIFICATION_EMAIL = 'verification_email',
  VERIFICATION_PHONE = 'verification_phone',
  SECURITY_QUESTIONS = 'security_questions',
  RECOVERY_EMAIL = 'recovery_email',
  DEVICE_CONFIRMATION = 'device_confirmation',
  UNUSUAL_ACTIVITY = 'unusual_activity',
  ACCOUNT_DISABLED = 'account_disabled',
  NONE = 'none'
}

// Login sequence stages
export enum LoginStage {
  INITIALIZE = 'initialize',
  NAVIGATE_TO_LOGIN = 'navigate_to_login',
  ENTER_EMAIL = 'enter_email',
  ENTER_PASSWORD = 'enter_password',
  HANDLE_CHALLENGES = 'handle_challenges',
  VALIDATE_LOGIN = 'validate_login',
  NAVIGATE_TO_BUSINESS = 'navigate_to_business',
  VALIDATE_BUSINESS = 'validate_business',
  COMPLETE = 'complete'
}

/**
 * Google Login Sequence Manager
 * 
 * Manages the step-by-step process of authenticating with Google
 * using human-like behavior patterns to avoid detection.
 */
export class GoogleLoginSequence {
  private page: Page;
  private context: BrowserContext;
  private config: LoginConfig;
  private traceId: string;
  private currentStage: LoginStage = LoginStage.INITIALIZE;
  private challengeDetected: ChallengeType = ChallengeType.NONE;
  private retryCount: Record<string, number> = {};
  private startTime: number;
  private sessionId: string;
  private stageStartTime: number;
  
  /**
   * Create a new Google login sequence
   */
  constructor(page: Page, context: BrowserContext, config: LoginConfig) {
    this.page = page;
    this.context = context;
    
    // Set defaults for config
    this.config = {
      delayFactor: 1.0,
      maxRetries: 3,
      humanEmulation: true,
      screenshotOnError: true,
      timeout: 60000, // 1 minute default timeout
      headless: true,
      detectDevtools: true,
      cookieRestoration: true,
      ...config
    };
    
    // Generate or use provided trace ID
    this.traceId = config.traceId || `auth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Create a session ID
    this.sessionId = uuidv4();
    
    // Initialize timing
    this.startTime = Date.now();
    this.stageStartTime = this.startTime;
    
    // Log initialization
    this.log(`Login sequence initialized for ${config.email} (business: ${config.businessId})`);
  }
  
  /**
   * Run the full login sequence
   */
  public async execute(): Promise<LoginResult> {
    this.log(`Starting login sequence for ${this.config.email}`);
    
    try {
      // Start overall timeout timer
      const timeoutPromise = new Promise<LoginResult>((_, reject) => {
        setTimeout(() => {
          reject(createError(
            ErrorCodes.AUTOMATION_TIMEOUT,
            `Login sequence timed out after ${this.config.timeout}ms`,
            {
              traceId: this.traceId,
              businessId: this.config.businessId,
              context: { email: this.config.email }
            }
          ));
        }, this.config.timeout);
      });
      
      // Run the login sequence with timeout
      const loginPromise = this.runLoginSequence();
      return await Promise.race([loginPromise, timeoutPromise]);
      
    } catch (error) {
      // Handle and map any errors
      if (error instanceof BrowserAutomationError) {
        return this.createErrorResult(error);
      }
      
      const automationError = createError(
        ErrorCodes.AUTOMATION_ACTION_FAILED,
        error instanceof Error ? error.message : String(error),
        {
          traceId: this.traceId,
          businessId: this.config.businessId,
          originalError: error instanceof Error ? error : undefined,
          context: { email: this.config.email, stage: this.currentStage }
        }
      );
      
      return this.createErrorResult(automationError);
    }
  }
  
  /**
   * Run the step-by-step login sequence
   */
  private async runLoginSequence(): Promise<LoginResult> {
    // Step 1: Navigate to Google login page
    await this.setStage(LoginStage.NAVIGATE_TO_LOGIN);
    await this.navigateToLogin();
    
    // Add anti-bot protection bypasses if configured
    if (this.config.detectDevtools) {
      await this.setupAntiDetection();
    }
    
    // Step 2: Enter email
    await this.setStage(LoginStage.ENTER_EMAIL);
    await this.enterEmail();
    
    // Step 3: Enter password
    await this.setStage(LoginStage.ENTER_PASSWORD);
    await this.enterPassword();
    
    // Step 4: Handle any challenges that appear
    await this.setStage(LoginStage.HANDLE_CHALLENGES);
    await this.handleChallenges();
    
    // Step 5: Validate successful login
    await this.setStage(LoginStage.VALIDATE_LOGIN);
    await this.validateLogin();
    
    // Step 6: Navigate to Google Business Profile
    await this.setStage(LoginStage.NAVIGATE_TO_BUSINESS);
    await this.navigateToBusiness();
    
    // Step 7: Validate access to the business
    await this.setStage(LoginStage.VALIDATE_BUSINESS);
    await this.validateBusiness();
    
    // Step 8: Completion - gather session data
    await this.setStage(LoginStage.COMPLETE);
    return await this.completeLogin();
  }
  
  /**
   * Navigate to the Google login page
   */
  private async navigateToLogin(): Promise<void> {
    this.log('Navigating to Google login page');
    
    try {
      // Visit the Google Accounts page with a realistic query param
      await ErrorRetry.withRetry(
        async () => {
          await this.page.goto('https://accounts.google.com/signin/v2/identifier?service=accountsettings&continue=https%3A%2F%2Fmyaccount.google.com%2F&flowName=GlifWebSignIn&flowEntry=ServiceLogin', {
            waitUntil: 'networkidle',
            timeout: 30000
          });
          
          // Wait for the page to fully load and stabilize
          await this.page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 10000 });
          
          // Add a small delay to simulate human behavior
          await this.humanDelay(1000, 2000);
        },
        {
          maxAttempts: 3,
          baseDelay: 2000,
          onRetry: (error, attempt) => {
            this.log(`Retrying navigation (attempt ${attempt}): ${error.message}`);
          }
        }
      );
      
      // Verify we're on the correct page
      const url = this.page.url();
      if (!url.includes('accounts.google.com')) {
        throw createError(
          ErrorCodes.AUTOMATION_NAVIGATION_FAILED,
          `Failed to navigate to Google login page, current URL: ${url}`,
          {
            traceId: this.traceId,
            businessId: this.config.businessId
          }
        );
      }
      
      this.log('Successfully navigated to Google login page');
    } catch (error) {
      this.log(`Navigation failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    }
  }
  
  /**
   * Setup anti-detection measures to bypass bot detection
   */
  private async setupAntiDetection(): Promise<void> {
    try {
      // Override the navigator properties that can be used to detect automation
      await this.page.evaluateOnNewDocument(() => {
        // Modify navigator properties
        const newProto = navigator.__proto__;
        delete newProto.webdriver;
        
        // Override permissions
        navigator.permissions.query = (parameters): Promise<any> => {
          return Promise.resolve({
            state: 'granted',
            onchange: null
          });
        };
        
        // Override user agent
        Object.defineProperty(navigator, 'userAgent', {
          get: () => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        // Override plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [{
            name: 'Chrome PDF Plugin',
            description: 'Portable Document Format',
            filename: 'internal-pdf-viewer'
          }, {
            name: 'Chrome PDF Viewer',
            description: '',
            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai'
          }, {
            name: 'Native Client',
            description: '',
            filename: 'internal-nacl-plugin'
          }]
        });
        
        // Override languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en']
        });
        
        // Override hardware concurrency
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => 8
        });
        
        // Override platform
        Object.defineProperty(navigator, 'platform', {
          get: () => 'MacIntel'
        });
        
        // Override connection
        Object.defineProperty(navigator, 'connection', {
          get: () => ({
            effectiveType: '4g',
            rtt: 50,
            downlink: 10,
            saveData: false
          })
        });
        
        // Override deviceMemory
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => 8
        });
        
        // Add advanced fingerprint protection
        const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          // Spoof the RENDERER and VENDOR parameters to mimic common values
          if (parameter === 37446) { // RENDERER
            return 'Intel Iris OpenGL Engine';
          }
          if (parameter === 37445) { // VENDOR
            return 'Intel Inc.';
          }
          return originalGetParameter.call(this, parameter);
        };
        
        // Mock audio context to avoid fingerprinting
        if (typeof AudioContext !== 'undefined') {
          const originalGetChannelData = AudioBuffer.prototype.getChannelData;
          AudioBuffer.prototype.getChannelData = function(channel) {
            const array = originalGetChannelData.call(this, channel);
            // Add subtle noise to make fingerprinting more difficult
            if (array.length > 10000) {
              for (let i = 0; i < array.length; i += 500) {
                array[i] = array[i] + (Math.random() * 0.0001 - 0.00005);
              }
            }
            return array;
          };
        }
      });

      // Apply additional stealth techniques using puppeteer-extra-plugin-stealth approach
      // These are manually implemented since we're using Playwright
      await this.page.evaluateOnNewDocument(() => {
        // Override iframe contentWindow access to prevent iframe detection techniques
        const originalContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
          ...originalContentWindow,
          get: function() {
            const result = originalContentWindow.get.call(this);
            if (result) {
              Object.defineProperty(result, 'chrome', { get: () => undefined });
            }
            return result;
          }
        });
        
        // Add missing image property to make fingerprinting more difficult
        if (HTMLCanvasElement.prototype.toBlob) {
          const originalToBlob = HTMLCanvasElement.prototype.toBlob;
          HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
            // Add tiny variations to canvas rendering
            const originalData = this.getContext('2d').getImageData(0, 0, 1, 1);
            if (originalData) {
              const data = originalData.data;
              data[0] = data[0] + (Math.random() * 2 - 1);
              data[1] = data[1] + (Math.random() * 2 - 1);
              data[2] = data[2] + (Math.random() * 2 - 1);
              this.getContext('2d').putImageData(originalData, 0, 0);
            }
            return originalToBlob.call(this, callback, type, quality);
          };
        }
      });
      
      this.log('Enhanced anti-detection measures applied');
    } catch (error) {
      this.log(`Failed to apply anti-detection measures: ${error instanceof Error ? error.message : String(error)}`, 'warn');
      // Continue anyway, this is non-critical
    }
  }
  
  /**
   * Enter email address in the login form
   */
  private async enterEmail(): Promise<void> {
    this.log(`Entering email: ${this.config.email}`);
    
    try {
      // Wait for email input field to be visible
      await this.page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 10000 });
      
      // Clear the field if there's any text
      await this.page.fill('input[type="email"]', '');
      
      // Add human-like typing with variable speed if enabled
      if (this.config.humanEmulation) {
        await this.humanTypeText('input[type="email"]', this.config.email);
      } else {
        await this.page.fill('input[type="email"]', this.config.email);
      }
      
      // Wait a moment before clicking next
      await this.humanDelay(800, 1500);
      
      // Find and click the Next button
      await ErrorRetry.withRetry(
        async () => {
          // Try different selectors that Google might use
          const nextButtonSelectors = [
            'button:has-text("Next")',
            '#identifierNext button',
            'div[data-primary-action-label="Next"] button',
            'button.VfPpkd-LgbsSe-OWXEXe-k8QpJ'
          ];
          
          let clicked = false;
          
          // Try each selector
          for (const selector of nextButtonSelectors) {
            try {
              // Check if the selector exists
              const exists = await this.page.$(selector);
              if (exists) {
                if (this.config.humanEmulation) {
                  await this.humanClick(selector);
                } else {
                  await this.page.click(selector);
                }
                clicked = true;
                break;
              }
            } catch (e) {
              // Try the next selector
              continue;
            }
          }
          
          if (!clicked) {
            throw createError(
              ErrorCodes.AUTOMATION_SELECTOR_NOT_FOUND,
              'Could not find the Next button after entering email',
              {
                traceId: this.traceId,
                businessId: this.config.businessId
              }
            );
          }
          
          // Wait for the password field to appear
          await this.page.waitForSelector('input[type="password"]', { state: 'visible', timeout: 8000 })
            .catch(() => {
              // If password field doesn't appear, check for challenges
              this.detectChallengeAfterEmail();
            });
        },
        {
          maxAttempts: 3,
          baseDelay: 2000
        }
      );
      
      this.log('Successfully entered email and proceeded to next step');
    } catch (error) {
      this.log(`Failed to enter email: ${error instanceof Error ? error.message : String(error)}`, 'error');
      
      // Take a screenshot if enabled
      if (this.config.screenshotOnError) {
        await this.captureScreenshot('email-error');
      }
      
      // Check for challenge screens
      await this.detectChallengeAfterEmail();
      
      throw error;
    }
  }
  
  /**
   * Enter password in the login form
   */
  private async enterPassword(): Promise<void> {
    this.log('Entering password');
    
    try {
      // Wait for password input field to be visible with a reasonable timeout
      await this.page.waitForSelector('input[type="password"]', { state: 'visible', timeout: 10000 });
      
      // Add a small delay before entering password
      await this.humanDelay(800, 1500);
      
      // Clear the field if there's any text
      await this.page.fill('input[type="password"]', '');
      
      // Add human-like typing with variable speed if enabled
      if (this.config.humanEmulation) {
        await this.humanTypeText('input[type="password"]', this.config.password);
      } else {
        await this.page.fill('input[type="password"]', this.config.password);
      }
      
      // Wait a moment before clicking next
      await this.humanDelay(800, 1500);
      
      // Find and click the Next button
      await ErrorRetry.withRetry(
        async () => {
          // Try different selectors that Google might use
          const nextButtonSelectors = [
            'button:has-text("Next")',
            '#passwordNext button',
            'div[data-primary-action-label="Next"] button',
            'button.VfPpkd-LgbsSe-OWXEXe-k8QpJ'
          ];
          
          let clicked = false;
          
          // Try each selector
          for (const selector of nextButtonSelectors) {
            try {
              // Check if the selector exists
              const exists = await this.page.$(selector);
              if (exists) {
                if (this.config.humanEmulation) {
                  await this.humanClick(selector);
                } else {
                  await this.page.click(selector);
                }
                clicked = true;
                break;
              }
            } catch (e) {
              // Try the next selector
              continue;
            }
          }
          
          if (!clicked) {
            throw createError(
              ErrorCodes.AUTOMATION_SELECTOR_NOT_FOUND,
              'Could not find the Next button after entering password',
              {
                traceId: this.traceId,
                businessId: this.config.businessId
              }
            );
          }
          
          // Wait for navigation to complete
          await this.page.waitForLoadState('networkidle', { timeout: 10000 });
        },
        {
          maxAttempts: 3,
          baseDelay: 2000
        }
      );
      
      this.log('Successfully entered password and proceeded to next step');
    } catch (error) {
      this.log(`Failed to enter password: ${error instanceof Error ? error.message : String(error)}`, 'error');
      
      // Take a screenshot if enabled
      if (this.config.screenshotOnError) {
        await this.captureScreenshot('password-error');
      }
      
      // Check for challenges or errors
      await this.detectChallengeAfterPassword();
      
      throw error;
    }
  }
  
  /**
   * Detect and handle various challenges after entering email
   */
  private async detectChallengeAfterEmail(): Promise<ChallengeType> {
    try {
      // Check for multiple potential issues
      
      // 1. Check for "Couldn't find your Google Account" error
      const accountNotFoundSelector = 'div:has-text("Couldn't find your Google Account")';
      const accountNotFound = await this.page.$(accountNotFoundSelector);
      
      if (accountNotFound) {
        this.log('Account not found error detected', 'error');
        this.challengeDetected = ChallengeType.ACCOUNT_DISABLED;
        throw createError(
          ErrorCodes.AUTH_INVALID_CREDENTIALS,
          'Google account not found or doesn\'t exist',
          {
            traceId: this.traceId,
            businessId: this.config.businessId,
            context: { email: this.config.email }
          }
        );
      }
      
      // 2. Check for captcha challenge
      const captchaSelectors = [
        'iframe[title="reCAPTCHA"]',
        'div.g-recaptcha',
        'div:has-text("Confirm you\'re not a robot")'
      ];
      
      for (const selector of captchaSelectors) {
        const captcha = await this.page.$(selector);
        if (captcha) {
          this.log('CAPTCHA challenge detected', 'warn');
          this.challengeDetected = ChallengeType.CAPTCHA;
          throw createError(
            ErrorCodes.AUTH_CAPTCHA_REQUIRED,
            'CAPTCHA verification required',
            {
              traceId: this.traceId,
              businessId: this.config.businessId,
              context: { email: this.config.email }
            }
          );
        }
      }
      
      // 3. Check for unusual activity detection
      const unusualActivitySelectors = [
        'div:has-text("Unusual activity in your account")',
        'div:has-text("Verify it\'s you")',
        'div:has-text("suspicious activity")'
      ];
      
      for (const selector of unusualActivitySelectors) {
        const unusualActivity = await this.page.$(selector);
        if (unusualActivity) {
          this.log('Unusual activity challenge detected', 'warn');
          this.challengeDetected = ChallengeType.UNUSUAL_ACTIVITY;
          throw createError(
            ErrorCodes.AUTH_VERIFICATION_REQUIRED,
            'Google detected unusual activity and requires verification',
            {
              traceId: this.traceId,
              businessId: this.config.businessId,
              context: { email: this.config.email }
            }
          );
        }
      }
      
      return this.challengeDetected;
    } catch (error) {
      // If the error is already a BrowserAutomationError, rethrow it
      if (error instanceof BrowserAutomationError) {
        throw error;
      }
      
      // Otherwise, create a new error
      throw createError(
        ErrorCodes.AUTOMATION_ACTION_FAILED,
        `Failed to detect challenges: ${error instanceof Error ? error.message : String(error)}`,
        {
          traceId: this.traceId,
          businessId: this.config.businessId,
          context: { email: this.config.email, challenge: this.challengeDetected }
        }
      );
    }
  }
  
  /**
   * Detect and handle various challenges after entering password
   */
  private async detectChallengeAfterPassword(): Promise<ChallengeType> {
    try {
      // Check for multiple potential issues
      
      // 1. Check for "Wrong password" error
      const wrongPasswordSelectors = [
        'div:has-text("Wrong password")',
        'span:has-text("Wrong password")',
        'div.OyEIQ.uSvLId:has-text("Wrong password")'
      ];
      
      for (const selector of wrongPasswordSelectors) {
        const wrongPassword = await this.page.$(selector);
        if (wrongPassword) {
          this.log('Wrong password error detected', 'error');
          throw createError(
            ErrorCodes.AUTH_INVALID_CREDENTIALS,
            'Incorrect password for Google account',
            {
              traceId: this.traceId,
              businessId: this.config.businessId,
              context: { email: this.config.email }
            }
          );
        }
      }
      
      // 2. Check for 2-step verification challenge
      const twoFactorSelectors = [
        'div:has-text("2-Step Verification")',
        'div:has-text("Enter the code")',
        'input[aria-label="Enter code"]',
        'div:has-text("Get a verification code from the Google Authenticator app")'
      ];
      
      for (const selector of twoFactorSelectors) {
        const twoFactor = await this.page.$(selector);
        if (twoFactor) {
          this.log('2-step verification challenge detected', 'warn');
          this.challengeDetected = ChallengeType.TWO_FACTOR;
          throw createError(
            ErrorCodes.AUTH_TWO_FACTOR_REQUIRED,
            'Two-factor authentication is required for this account',
            {
              traceId: this.traceId,
              businessId: this.config.businessId,
              context: { email: this.config.email }
            }
          );
        }
      }
      
      // 3. Check for verification email challenge
      const verificationEmailSelectors = [
        'div:has-text("Verify it\'s you")',
        'div:has-text("Check your email")',
        'div:has-text("We sent a verification code to")'
      ];
      
      for (const selector of verificationEmailSelectors) {
        const verificationEmail = await this.page.$(selector);
        if (verificationEmail) {
          this.log('Email verification challenge detected', 'warn');
          this.challengeDetected = ChallengeType.VERIFICATION_EMAIL;
          throw createError(
            ErrorCodes.AUTH_VERIFICATION_REQUIRED,
            'Email verification is required for this account',
            {
              traceId: this.traceId,
              businessId: this.config.businessId,
              context: { email: this.config.email }
            }
          );
        }
      }
      
      // 4. Check for account disabled message
      const accountDisabledSelectors = [
        'div:has-text("Your account was disabled")',
        'div:has-text("This account was disabled")',
        'div:has-text("Your account has been disabled")'
      ];
      
      for (const selector of accountDisabledSelectors) {
        const accountDisabled = await this.page.$(selector);
        if (accountDisabled) {
          this.log('Account disabled message detected', 'error');
          this.challengeDetected = ChallengeType.ACCOUNT_DISABLED;
          throw createError(
            ErrorCodes.AUTH_ACCOUNT_LOCKED,
            'Google account has been disabled',
            {
              traceId: this.traceId,
              businessId: this.config.businessId,
              context: { email: this.config.email }
            }
          );
        }
      }
      
      // 5. Check for "Verify it's you" device confirmation
      const deviceConfirmationSelectors = [
        'div:has-text("Verify it\'s you")',
        'div:has-text("Trying to sign in from a new device")',
        'div:has-text("new browser or location")'
      ];
      
      for (const selector of deviceConfirmationSelectors) {
        const deviceConfirmation = await this.page.$(selector);
        if (deviceConfirmation) {
          this.log('Device confirmation challenge detected', 'warn');
          this.challengeDetected = ChallengeType.DEVICE_CONFIRMATION;
          throw createError(
            ErrorCodes.AUTH_VERIFICATION_REQUIRED,
            'Device confirmation is required for this login attempt',
            {
              traceId: this.traceId,
              businessId: this.config.businessId,
              context: { email: this.config.email }
            }
          );
        }
      }
      
      return this.challengeDetected;
    } catch (error) {
      // If the error is already a BrowserAutomationError, rethrow it
      if (error instanceof BrowserAutomationError) {
        throw error;
      }
      
      // Otherwise, create a new error
      throw createError(
        ErrorCodes.AUTOMATION_ACTION_FAILED,
        `Failed to detect challenges: ${error instanceof Error ? error.message : String(error)}`,
        {
          traceId: this.traceId,
          businessId: this.config.businessId,
          context: { email: this.config.email, challenge: this.challengeDetected }
        }
      );
    }
  }
  
  /**
   * Handle detected challenges during login
   */
  private async handleChallenges(): Promise<void> {
    // If no challenge was detected, skip this step
    if (this.challengeDetected === ChallengeType.NONE) {
      this.log('No challenges detected, proceeding with login sequence');
      return;
    }
    
    this.log(`Handling challenge: ${this.challengeDetected}`);
    
    // Take a screenshot of the challenge for manual review
    if (this.config.screenshotOnError) {
      await this.captureScreenshot(`challenge-${this.challengeDetected}`);
    }
    
    // Handle different types of challenges
    switch (this.challengeDetected) {
      case ChallengeType.CAPTCHA:
        throw createError(
          ErrorCodes.AUTH_CAPTCHA_REQUIRED,
          'CAPTCHA verification required - cannot proceed automatically',
          {
            traceId: this.traceId,
            businessId: this.config.businessId,
            recoverySuggestion: 'Please log in manually to Google and complete the CAPTCHA verification'
          }
        );
        
      case ChallengeType.TWO_FACTOR:
        throw createError(
          ErrorCodes.AUTH_TWO_FACTOR_REQUIRED,
          'Two-factor authentication is required - cannot proceed automatically',
          {
            traceId: this.traceId,
            businessId: this.config.businessId,
            recoverySuggestion: 'Consider using an application password instead of your regular password'
          }
        );
        
      case ChallengeType.VERIFICATION_EMAIL:
      case ChallengeType.VERIFICATION_PHONE:
        throw createError(
          ErrorCodes.AUTH_VERIFICATION_REQUIRED,
          `${this.challengeDetected === ChallengeType.VERIFICATION_EMAIL ? 'Email' : 'Phone'} verification is required - cannot proceed automatically`,
          {
            traceId: this.traceId,
            businessId: this.config.businessId,
            recoverySuggestion: 'Please verify your account manually and try again'
          }
        );
        
      case ChallengeType.DEVICE_CONFIRMATION:
        throw createError(
          ErrorCodes.AUTH_VERIFICATION_REQUIRED,
          'Device confirmation is required - cannot proceed automatically',
          {
            traceId: this.traceId,
            businessId: this.config.businessId,
            recoverySuggestion: 'Please log in manually to approve this new device'
          }
        );
        
      case ChallengeType.ACCOUNT_DISABLED:
        throw createError(
          ErrorCodes.AUTH_ACCOUNT_LOCKED,
          'Google account has been disabled',
          {
            traceId: this.traceId,
            businessId: this.config.businessId,
            recoverySuggestion: 'Please check your account status with Google'
          }
        );
        
      default:
        throw createError(
          ErrorCodes.AUTH_VERIFICATION_REQUIRED,
          `Unhandled challenge type: ${this.challengeDetected}`,
          {
            traceId: this.traceId,
            businessId: this.config.businessId,
            recoverySuggestion: 'Please log in manually to complete the verification'
          }
        );
    }
  }
  
  /**
   * Validate successful login
   */
  private async validateLogin(): Promise<void> {
    this.log('Validating successful login');
    
    try {
      // Wait for a sufficient time to ensure page has loaded
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Check for successful login by looking for elements that indicate we're logged in
      const successIndicators = [
        'div[aria-label="Account Information"]',
        'a[aria-label="Google Account"]',
        'img[alt="Account"]',
        'a[href*="myaccount.google.com"]'
      ];
      
      let loginSuccessful = false;
      
      // Check each success indicator
      for (const selector of successIndicators) {
        try {
          const indicator = await this.page.$(selector);
          if (indicator) {
            loginSuccessful = true;
            break;
          }
        } catch {
          // Continue checking other indicators
        }
      }
      
      // If none of the success indicators were found, check the URL
      if (!loginSuccessful) {
        const currentUrl = this.page.url();
        if (currentUrl.includes('myaccount.google.com') || 
            currentUrl.includes('accounts.google.com/signin/success') ||
            currentUrl.includes('business.google.com')) {
          loginSuccessful = true;
        }
      }
      
      // If login wasn't successful, check for errors again
      if (!loginSuccessful) {
        // Take a screenshot for debugging
        if (this.config.screenshotOnError) {
          await this.captureScreenshot('login-validation-failed');
        }
        
        // Check for any challenges we missed
        await this.detectChallengeAfterPassword();
        
        // If we still think we're not logged in but no challenges were detected,
        // throw a generic error
        throw createError(
          ErrorCodes.AUTOMATION_ACTION_FAILED,
          'Failed to validate login success - not redirected to account page',
          {
            traceId: this.traceId,
            businessId: this.config.businessId,
            context: { currentUrl: this.page.url() }
          }
        );
      }
      
      this.log('Login validated successfully');
    } catch (error) {
      this.log(`Login validation failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
      
      // Take a screenshot if enabled
      if (this.config.screenshotOnError) {
        await this.captureScreenshot('login-validation-error');
      }
      
      throw error;
    }
  }
  
  /**
   * Navigate to Google Business Profile
   */
  private async navigateToBusiness(): Promise<void> {
    this.log('Navigating to Google Business Profile');
    
    try {
      await ErrorRetry.withRetry(
        async () => {
          await this.page.goto('https://business.google.com/dashboard', {
            waitUntil: 'networkidle',
            timeout: 30000
          });
          
          // Wait for the business dashboard to load
          await this.page.waitForSelector('div[role="main"]', { timeout: 10000 })
            .catch(() => {
              // This is non-critical, we'll validate the business in the next step
            });
          
          await this.humanDelay(1000, 2000);
        },
        {
          maxAttempts: 3,
          baseDelay: 2000,
          onRetry: (error, attempt) => {
            this.log(`Retrying navigation to business dashboard (attempt ${attempt}): ${error.message}`);
          }
        }
      );
      
      this.log('Successfully navigated to Google Business Profile');
    } catch (error) {
      this.log(`Navigation to business dashboard failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
      
      // Take a screenshot if enabled
      if (this.config.screenshotOnError) {
        await this.captureScreenshot('business-navigation-error');
      }
      
      throw error;
    }
  }
  
  /**
   * Validate access to the business profile
   */
  private async validateBusiness(): Promise<void> {
    this.log('Validating access to business profile');
    
    try {
      // Wait for a sufficient time to ensure page has loaded
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Check for successful business access by looking for dashboard elements
      const businessAccessIndicators = [
        'div[role="main"]',
        'div[aria-label="Dashboard"]',
        'span:has-text("Welcome to your Business Profile")',
        'h1:has-text("Business Profile")'
      ];
      
      let businessAccessConfirmed = false;
      
      // Check each business access indicator
      for (const selector of businessAccessIndicators) {
        try {
          const indicator = await this.page.$(selector);
          if (indicator) {
            businessAccessConfirmed = true;
            break;
          }
        } catch {
          // Continue checking other indicators
        }
      }
      
      // If none of the business access indicators were found, check the URL
      if (!businessAccessConfirmed) {
        const currentUrl = this.page.url();
        if (currentUrl.includes('business.google.com/dashboard') || 
            currentUrl.includes('business.google.com/locations')) {
          businessAccessConfirmed = true;
        }
      }
      
      // If business access wasn't confirmed, handle the situation
      if (!businessAccessConfirmed) {
        // Take a screenshot for debugging
        if (this.config.screenshotOnError) {
          await this.captureScreenshot('business-validation-failed');
        }
        
        // Check if we're being asked to create a business
        const createBusinessIndicators = [
          'div:has-text("Get started with Business Profile")',
          'div:has-text("Create your Business Profile")',
          'button:has-text("Create profile")'
        ];
        
        for (const selector of createBusinessIndicators) {
          const createIndicator = await this.page.$(selector);
          if (createIndicator) {
            throw createError(
              ErrorCodes.AUTOMATION_ACTION_FAILED,
              'No business profile found for this account',
              {
                traceId: this.traceId,
                businessId: this.config.businessId,
                recoverySuggestion: 'Please create a Google Business Profile manually first'
              }
            );
          }
        }
        
        // If we're not being asked to create a business, it's some other error
        throw createError(
          ErrorCodes.AUTOMATION_ACTION_FAILED,
          'Failed to validate business profile access',
          {
            traceId: this.traceId,
            businessId: this.config.businessId,
            context: { currentUrl: this.page.url() }
          }
        );
      }
      
      this.log('Business profile access validated successfully');
    } catch (error) {
      this.log(`Business validation failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
      
      // Take a screenshot if enabled
      if (this.config.screenshotOnError) {
        await this.captureScreenshot('business-validation-error');
      }
      
      throw error;
    }
  }
  
  /**
   * Complete the login process and gather session data
   */
  private async completeLogin(): Promise<LoginResult> {
    this.log('Completing login sequence and gathering session data');
    
    try {
      // Get cookies for the session
      const cookies = await this.context.cookies();
      
      // Get business profile metadata
      let businessMetadata = {};
      try {
        // Try to extract business name and other details from the page
        businessMetadata = await this.extractBusinessMetadata();
      } catch (metadataError) {
        this.log(`Failed to extract business metadata: ${metadataError instanceof Error ? metadataError.message : String(metadataError)}`, 'warn');
        // Non-critical error, continue without metadata
      }
      
      // Capture final screenshot
      let screenshot = null;
      if (this.config.screenshotOnError) {
        screenshot = await this.captureScreenshot('login-success', true);
      }
      
      // Calculate total login duration
      const loginDuration = Date.now() - this.startTime;
      this.log(`Login sequence completed successfully in ${loginDuration}ms`);
      
      // Return successful result
      return {
        success: true,
        sessionId: this.sessionId,
        businessId: this.config.businessId,
        cookies: cookies,
        profile: businessMetadata,
        screenshot: screenshot,
        traceId: this.traceId,
        timestamp: new Date().toISOString(),
        metadata: {
          loginDuration,
          stages: this.retryCount
        }
      };
    } catch (error) {
      this.log(`Failed to complete login sequence: ${error instanceof Error ? error.message : String(error)}`, 'error');
      
      return this.createErrorResult(createError(
        ErrorCodes.AUTOMATION_ACTION_FAILED,
        `Failed to complete login sequence: ${error instanceof Error ? error.message : String(error)}`,
        {
          traceId: this.traceId,
          businessId: this.config.businessId,
          originalError: error instanceof Error ? error : undefined
        }
      ));
    }
  }
  
  /**
   * Extract business metadata from the page
   */
  private async extractBusinessMetadata(): Promise<any> {
    try {
      // Extract basic business information
      return await this.page.evaluate(() => {
        const metadata: Record<string, any> = {};
        
        // Try to find business name
        const businessNameElements = [
          document.querySelector('h1'),
          document.querySelector('.business-name'),
          document.querySelector('div[role="main"] h1'),
          document.querySelector('div[role="heading"]')
        ];
        
        for (const element of businessNameElements) {
          if (element && element.textContent) {
            metadata.businessName = element.textContent.trim();
            break;
          }
        }
        
        // Try to extract additional info
        const businessTypeElement = document.querySelector('.business-type, .category');
        if (businessTypeElement && businessTypeElement.textContent) {
          metadata.businessType = businessTypeElement.textContent.trim();
        }
        
        const addressElement = document.querySelector('.address');
        if (addressElement && addressElement.textContent) {
          metadata.address = addressElement.textContent.trim();
        }
        
        return metadata;
      });
    } catch (error) {
      this.log(`Error extracting business metadata: ${error instanceof Error ? error.message : String(error)}`, 'warn');
      return {}; // Return empty object on failure
    }
  }
  
  /**
   * Create an error result from a BrowserAutomationError
   */
  private createErrorResult(error: BrowserAutomationError): LoginResult {
    return {
      success: false,
      businessId: this.config.businessId,
      error: error.message,
      errorCode: error.code,
      challenge: this.challengeDetected,
      traceId: this.traceId,
      timestamp: new Date().toISOString(),
      metadata: {
        category: error.category,
        severity: error.severity,
        retryable: error.retryable,
        recoverySuggestion: error.recoverySuggestion,
        stages: this.retryCount
      }
    };
  }
  
  /**
   * Set the current stage of the login sequence
   */
  private async setStage(stage: LoginStage): Promise<void> {
    // Calculate time spent in previous stage
    const stageDuration = Date.now() - this.stageStartTime;
    this.log(`Completed stage ${this.currentStage} in ${stageDuration}ms`);
    
    // Update stage
    this.currentStage = stage;
    this.stageStartTime = Date.now();
    
    // Initialize retry counter for this stage
    if (!this.retryCount[stage]) {
      this.retryCount[stage] = 0;
    }
    
    this.log(`Starting stage: ${stage}`);
  }
  
  /**
   * Log a message with timestamp and context
   */
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    const prefix = `[GoogleLogin:${this.traceId}][${this.currentStage}]`;
    
    switch (level) {
      case 'warn':
        console.warn(`${prefix} ⚠️ ${timestamp} - ${message}`);
        break;
      case 'error':
        console.error(`${prefix} ❌ ${timestamp} - ${message}`);
        break;
      default:
        console.log(`${prefix} ✅ ${timestamp} - ${message}`);
    }
  }
  
  /**
   * Wait for a random amount of time to simulate human behavior
   */
  private async humanDelay(min: number, max: number): Promise<void> {
    if (!this.config.humanEmulation) {
      // Use minimum delay if human emulation is disabled
      await this.page.waitForTimeout(min);
      return;
    }
    
    // Calculate a random delay between min and max
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    
    // Apply the delay factor from config
    const scaledDelay = Math.floor(delay * (this.config.delayFactor || 1.0));
    
    await this.page.waitForTimeout(scaledDelay);
  }
  
  /**
   * Type text with human-like timing and typing patterns
   */
  private async humanTypeText(selector: string, text: string): Promise<void> {
    // Click on the element first
    await this.page.click(selector);
    
    // Clear the field first (in case there's any text)
    await this.page.fill(selector, '');
    
    // Wait a moment before starting to type
    await this.humanDelay(100, 300);
    
    // Typing speed variables
    const avgWordTypingSpeed = Math.random() < 0.7 ? 
      this.getSpeedProfile('average') : 
      (Math.random() < 0.5 ? this.getSpeedProfile('fast') : this.getSpeedProfile('slow'));
    
    // Calculate typing rhythm variability (higher = more consistent typing)
    const rhythmConsistency = 0.6 + Math.random() * 0.3; // 0.6 to 0.9
    
    // Possibility of making typos
    const typoChance = Math.random() * 0.03; // 0% to 3% chance per character
    
    // Type the text character by character with variable delay
    let i = 0;
    while (i < text.length) {
      // Get base delay for this character based on character type
      let charDelay = this.getCharacterDelay(text[i], avgWordTypingSpeed);
      
      // Add rhythm variation
      charDelay = charDelay * (rhythmConsistency + (1 - rhythmConsistency) * (Math.random() * 2 - 1));
      
      // Slow down for shift key characters
      if (this.isShiftRequired(text[i])) {
        charDelay *= 1.5;
      }
      
      // Occasionally add a short pause as if thinking
      if (Math.random() < 0.05 && i > 3) {
        if (Math.random() < 0.3) {
          // Small pause (thinking)
          await this.humanDelay(300, 800);
        } else if (Math.random() < 0.1) {
          // Longer pause (distraction)
          await this.humanDelay(1000, 2000);
        }
      }
      
      // Simulate occasional typo
      if (Math.random() < typoChance && i < text.length - 2) {
        // Type a wrong character
        const typoChar = this.getTypoCharacter(text[i]);
        await this.page.type(selector, typoChar, { delay: charDelay });
        
        // Short pause to notice the error
        await this.humanDelay(200, 400);
        
        // Press backspace to correct
        await this.page.keyboard.press('Backspace');
        
        // Wait before typing correct character
        await this.humanDelay(100, 300);
      }
      
      // Type the correct character
      await this.page.type(selector, text[i], { delay: charDelay });
      
      i++;
    }
    
    // Add a short pause after typing is complete as if checking what was typed
    await this.humanDelay(300, 700);
  }
  
  /**
   * Get typing speed profile (in ms per character)
   */
  private getSpeedProfile(profile: 'slow' | 'average' | 'fast'): { min: number, max: number } {
    switch (profile) {
      case 'slow':
        return { min: 100, max: 300 };
      case 'fast':
        return { min: 30, max: 100 };
      case 'average':
      default:
        return { min: 50, max: 150 };
    }
  }
  
  /**
   * Get delay for a specific character based on its type
   */
  private getCharacterDelay(char: string, profile: { min: number, max: number }): number {
    // Common letters are typed faster than rare ones or symbols
    const commonLetters = 'etaoinshrdlu';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+{}|:"<>?~`-=[]\\;\',./';
    
    if (commonLetters.includes(char.toLowerCase())) {
      // Common letters - faster
      return Math.random() * (profile.max - profile.min) * 0.7 + profile.min;
    } else if (numbers.includes(char)) {
      // Numbers - slightly slower
      return Math.random() * (profile.max - profile.min) * 0.9 + profile.min;
    } else if (symbols.includes(char)) {
      // Symbols - slowest
      return Math.random() * (profile.max - profile.min) * 1.2 + profile.min;
    } else {
      // Other characters - regular speed
      return Math.random() * (profile.max - profile.min) + profile.min;
    }
  }
  
  /**
   * Check if a character requires the shift key
   */
  private isShiftRequired(char: string): boolean {
    return '~!@#$%^&*()_+{}|:"<>?ABCDEFGHIJKLMNOPQRSTUVWXYZ'.includes(char);
  }
  
  /**
   * Get a typo character that's near the intended character on the keyboard
   */
  private getTypoCharacter(char: string): string {
    // Keyboard layout adjacency
    const adjacencyMap: Record<string, string[]> = {
      'a': ['q', 'w', 's', 'z'],
      'b': ['v', 'g', 'h', 'n'],
      'c': ['x', 'd', 'f', 'v'],
      'd': ['s', 'e', 'r', 'f', 'c', 'x'],
      'e': ['w', 's', 'd', 'r'],
      'f': ['d', 'r', 't', 'g', 'v', 'c'],
      'g': ['f', 't', 'y', 'h', 'b', 'v'],
      'h': ['g', 'y', 'u', 'j', 'n', 'b'],
      'i': ['u', 'j', 'k', 'o'],
      'j': ['h', 'u', 'i', 'k', 'm', 'n'],
      'k': ['j', 'i', 'o', 'l', 'm'],
      'l': ['k', 'o', 'p', ';'],
      'm': ['n', 'j', 'k', ','],
      'n': ['b', 'h', 'j', 'm'],
      'o': ['i', 'k', 'l', 'p'],
      'p': ['o', 'l', ';', '['],
      'q': ['1', '2', 'w', 'a'],
      'r': ['e', 'd', 'f', 't'],
      's': ['a', 'w', 'e', 'd', 'x', 'z'],
      't': ['r', 'f', 'g', 'y'],
      'u': ['y', 'h', 'j', 'i'],
      'v': ['c', 'f', 'g', 'b'],
      'w': ['q', 'a', 's', 'e'],
      'x': ['z', 's', 'd', 'c'],
      'y': ['t', 'g', 'h', 'u'],
      'z': ['a', 's', 'x'],
      '0': ['9', '-', 'p'],
      '1': ['q', '2'],
      '2': ['1', 'q', 'w', '3'],
      '3': ['2', 'w', 'e', '4'],
      '4': ['3', 'e', 'r', '5'],
      '5': ['4', 'r', 't', '6'],
      '6': ['5', 't', 'y', '7'],
      '7': ['6', 'y', 'u', '8'],
      '8': ['7', 'u', 'i', '9'],
      '9': ['8', 'i', 'o', '0'],
      '.': [',', 'l', ';'],
      '@': ['2', '3']
    };
    
    // Convert to lowercase for map lookup
    const lowerChar = char.toLowerCase();
    
    // If we have a mapping for this character
    if (adjacencyMap[lowerChar]) {
      const adjacentChars = adjacencyMap[lowerChar];
      const randomIndex = Math.floor(Math.random() * adjacentChars.length);
      
      // For uppercase characters, keep the typo uppercase
      if (char !== lowerChar) {
        return adjacentChars[randomIndex].toUpperCase();
      }
      
      return adjacentChars[randomIndex];
    }
    
    // Fallback to a random character
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    return alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  
  /**
   * Click with human-like behavior using advanced mouse movement patterns
   */
  private async humanClick(selector: string): Promise<void> {
    // First, we need to wait for the element to be visible
    await this.page.waitForSelector(selector, { state: 'visible' });
    
    // Get element's bounding box
    const boundingBox = await this.page.locator(selector).boundingBox();
    
    // If we couldn't get the bounding box, fall back to regular click
    if (!boundingBox) {
      await this.page.click(selector);
      return;
    }
    
    // Get current mouse position
    const currentMousePosition = await this.page.evaluate(() => {
      return { x: window.mouseX || 0, y: window.mouseY || 0 };
    }).catch(() => ({ x: 0, y: 0 })); // Default if we can't get it
    
    // Calculate a random point within the element, slightly biased towards the center
    const targetX = boundingBox.x + boundingBox.width * (0.3 + Math.random() * 0.4);
    const targetY = boundingBox.y + boundingBox.height * (0.3 + Math.random() * 0.4);
    
    // Calculate distance for more realistic movement timing
    const distance = Math.sqrt(
      Math.pow(targetX - currentMousePosition.x, 2) + 
      Math.pow(targetY - currentMousePosition.y, 2)
    );
    
    // Generate Bezier curve control points for mouse movement
    // More complex for longer distances
    const numControlPoints = distance > 500 ? 3 : distance > 200 ? 2 : 1;
    const controlPoints = [];
    
    for (let i = 0; i < numControlPoints; i++) {
      // Generate slight randomization to path
      // Perpendicular deviation from straight line increases with distance
      const ratio = (i + 1) / (numControlPoints + 1);
      const linearX = currentMousePosition.x + (targetX - currentMousePosition.x) * ratio;
      const linearY = currentMousePosition.y + (targetY - currentMousePosition.y) * ratio;
      
      // Add deviation perpendicular to movement direction
      const deviation = Math.min(100, distance * 0.1) * (Math.random() * 2 - 1);
      
      // Calculate perpendicular vector
      const dx = targetX - currentMousePosition.x;
      const dy = targetY - currentMousePosition.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      // Perpendicular vector
      const perpX = -dy / length;
      const perpY = dx / length;
      
      controlPoints.push({
        x: linearX + perpX * deviation,
        y: linearY + perpY * deviation
      });
    }
    
    // Calculate number of steps based on distance
    // Humans move mouse faster over longer distances
    const baseSteps = Math.min(40, Math.max(10, Math.floor(distance / 20)));
    const steps = Math.floor(baseSteps * (0.8 + Math.random() * 0.4)); // +/- 20% randomization
    
    // Perform the movement with Bezier curve
    await this.moveMouse(
      currentMousePosition.x, 
      currentMousePosition.y, 
      targetX, 
      targetY, 
      controlPoints, 
      steps
    );
    
    // Occasionally have a small hover delay before clicking
    if (Math.random() < 0.7) {
      await this.humanDelay(50, 150);
    }
    
    // Occasionally move slightly within the element before clicking (like human adjusting)
    if (Math.random() < 0.3 && boundingBox.width > 20 && boundingBox.height > 20) {
      const adjustX = targetX + (Math.random() * 6 - 3);
      const adjustY = targetY + (Math.random() * 6 - 3);
      
      // Ensure we're still inside the element
      const finalX = Math.min(boundingBox.x + boundingBox.width - 2, 
                            Math.max(boundingBox.x + 2, adjustX));
      const finalY = Math.min(boundingBox.y + boundingBox.height - 2, 
                            Math.max(boundingBox.y + 2, adjustY));
      
      await this.page.mouse.move(finalX, finalY, { steps: 2 });
    }
    
    // Finally click with randomness in click duration
    await this.page.mouse.down({ button: 'left' });
    
    // Random click duration (most are quick, some are longer)
    const clickDuration = Math.random() < 0.9 ? 
      Math.floor(30 + Math.random() * 70) : 
      Math.floor(100 + Math.random() * 200);
    
    await this.page.waitForTimeout(clickDuration);
    await this.page.mouse.up({ button: 'left' });
    
    // Store the mouse position in the page for future use
    await this.page.evaluate(({ x, y }) => {
      window.mouseX = x;
      window.mouseY = y;
    }, { x: targetX, y: targetY }).catch(() => {});
  }
  
  /**
   * Move mouse with bezier curve simulation for human-like movement
   */
  private async moveMouse(
    startX: number, 
    startY: number, 
    endX: number, 
    endY: number, 
    controlPoints: Array<{x: number, y: number}>, 
    steps: number
  ): Promise<void> {
    // B(t) = (1-t)^3 * P0 + 3(1-t)^2 * t * P1 + 3(1-t) * t^2 * P2 + t^3 * P3
    // For our case, P0 is start point, P3 is end point, and P1,P2 are control points
    
    // For more realistic mouse movement, we want non-linear step timing
    // Move faster in the middle, slower at start and end
    
    // Get all points on the curve in one array
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      
      // Apply easing to time
      // Ease in/out timing function (faster in middle, slower at start/end)
      // Easing formula: t<0.5 ? 2*t*t : -1+(4-2*t)*t
      const easedT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      
      // For cubic bezier with arbitrary number of control points
      let point = this.getBezierPoint(
        { x: startX, y: startY },
        { x: endX, y: endY },
        controlPoints,
        easedT
      );
      
      points.push(point);
    }
    
    // Execute the movement
    for (let i = 0; i < points.length; i++) {
      await this.page.mouse.move(points[i].x, points[i].y);
      
      // Vary the movement speed slightly
      if (i < points.length - 1) {
        // Variable delay between movements to simulate realistic mouse speed
        // Faster in the middle, slower at beginning and end
        const progress = i / points.length;
        const speedFactor = progress < 0.2 || progress > 0.8 ? 0.7 : 1.3;
        
        // Base time is 8-12ms between points, adjusted by speed factor
        const moveDelay = Math.floor((8 + Math.random() * 4) * speedFactor);
        
        // Wait before moving to next point
        if (moveDelay > 0) {
          await this.page.waitForTimeout(moveDelay);
        }
      }
    }
  }
  
  /**
   * Calculate a point on a Bezier curve with multiple control points
   */
  private getBezierPoint(
    start: {x: number, y: number}, 
    end: {x: number, y: number}, 
    controlPoints: Array<{x: number, y: number}>, 
    t: number
  ): {x: number, y: number} {
    // For simple case with one control point
    if (controlPoints.length === 1) {
      const cp = controlPoints[0];
      
      // Quadratic Bezier formula: B(t) = (1-t)^2 * P0 + 2(1-t) * t * P1 + t^2 * P2
      const x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * cp.x + t * t * end.x;
      const y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * cp.y + t * t * end.y;
      
      return { x, y };
    }
    
    // For two control points
    if (controlPoints.length === 2) {
      const cp1 = controlPoints[0];
      const cp2 = controlPoints[1];
      
      // Cubic Bezier formula
      const x = Math.pow(1 - t, 3) * start.x +
        3 * Math.pow(1 - t, 2) * t * cp1.x +
        3 * (1 - t) * Math.pow(t, 2) * cp2.x +
        Math.pow(t, 3) * end.x;
        
      const y = Math.pow(1 - t, 3) * start.y +
        3 * Math.pow(1 - t, 2) * t * cp1.y +
        3 * (1 - t) * Math.pow(t, 2) * cp2.y +
        Math.pow(t, 3) * end.y;
      
      return { x, y };
    }
    
    // For any number of control points, use De Casteljau's algorithm
    // Create a copy of all points including start and end
    let points = [start, ...controlPoints, end];
    
    // Apply algorithm iteratively
    while (points.length > 1) {
      const newPoints = [];
      for (let i = 0; i < points.length - 1; i++) {
        newPoints.push({
          x: (1 - t) * points[i].x + t * points[i+1].x,
          y: (1 - t) * points[i].y + t * points[i+1].y
        });
      }
      points = newPoints;
    }
    
    // Return the final point
    return points[0];
  }
  
  /**
   * Capture a screenshot for debugging or record-keeping
   */
  private async captureScreenshot(label: string, returnBase64: boolean = false): Promise<string | null> {
    try {
      const timestamp = Date.now();
      const filename = `${this.config.businessId}-${label}-${timestamp}.png`;
      
      // Determine where to save the screenshot
      const path = this.config.screenshotPath 
        ? `${this.config.screenshotPath}/${filename}` 
        : filename;
      
      // Capture the screenshot
      const buffer = await this.page.screenshot({ 
        path: path,
        fullPage: true 
      });
      
      this.log(`Captured screenshot: ${path}`);
      
      // Return as base64 if requested
      if (returnBase64 && buffer) {
        return buffer.toString('base64');
      }
      
      return path;
    } catch (error) {
      this.log(`Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}`, 'error');
      return null;
    }
  }
}

/**
 * Create and execute a Google login sequence
 */
export async function executeGoogleLogin(
  page: Page, 
  context: BrowserContext, 
  config: LoginConfig
): Promise<LoginResult> {
  const loginSequence = new GoogleLoginSequence(page, context, config);
  return await loginSequence.execute();
}