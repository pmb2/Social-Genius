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
      });
      
      this.log('Anti-detection measures applied');
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
   * Type text with human-like timing
   */
  private async humanTypeText(selector: string, text: string): Promise<void> {
    // Click on the element first
    await this.page.click(selector);
    
    // Type the text character by character with variable delay
    for (let i = 0; i < text.length; i++) {
      // Determine typing speed - faster in the middle, slower at beginning and end
      let minDelay = 50; // ms
      let maxDelay = 150; // ms
      
      // Beginning of text
      if (i < 3) {
        minDelay = 100;
        maxDelay = 300;
      } 
      // End of text
      else if (i > text.length - 3) {
        minDelay = 80;
        maxDelay = 250;
      }
      // Middle of text - faster typing
      else {
        // Occasionally add a short pause as if thinking
        if (Math.random() < 0.1) {
          await this.humanDelay(300, 800);
        }
      }
      
      // Type the character
      await this.page.type(selector, text[i], { delay: Math.random() * (maxDelay - minDelay) + minDelay });
    }
    
    // Add a short pause after typing is complete
    await this.humanDelay(200, 500);
  }
  
  /**
   * Click with human-like behavior
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
    
    // Calculate a random point within the element, slightly biased towards the center
    const x = boundingBox.x + boundingBox.width * (0.3 + Math.random() * 0.4);
    const y = boundingBox.y + boundingBox.height * (0.3 + Math.random() * 0.4);
    
    // Move to the element with a realistic motion
    await this.page.mouse.move(x, y, { steps: 5 });
    
    // Short delay before clicking, as a human would
    await this.humanDelay(50, 150);
    
    // Finally click
    await this.page.mouse.click(x, y);
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