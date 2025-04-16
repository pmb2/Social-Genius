/**
 * This module patches the console object to suppress certain types of logs
 * It's designed to reduce console spam by filtering out common development messages
 */

// Store the original console methods
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Timestamp generator
const getTimestamp = (): string => {
  return new Date().toISOString().split('T')[1].substring(0, 8);
};

// Only initialize once
let isInitialized = false;

// Track when we last saw each log pattern
const lastLogTime: Record<string, number> = {};
const LOG_INTERVAL = 600000; // 10 minutes

// Track compilation stats to avoid duplicate messages
let lastCompilationTime = 0;
let compilationCount = 0;

// Configure which patterns to filter
const patterns = {
  // These patterns will be completely hidden
  hidden: [
    // Next.js Fast Refresh and compilation messages - absolute suppression
    /\[Fast Refresh\]/i,
    /Fast Refresh/i,
    /Compiled/i,
    /Compiling/i,
    /compiled/i,
    /modules/i,
    /waiting for/i,
    /\d+ms/i, // Timestamps in milliseconds
    /fast refresh had to perform/i,
    /pending changes/i,
    /event compiled client and server/i,
    /preloaded with link preload/i,
    /File change detected/i,
    /webpack/i,
    /building/i,
    /built/i,
    /export/i,
    /Export/i,
    /✓ /i, // Checkmark symbol used by Next.js
    /\(\d+ modules\)/i, // Module count message
    /HMR/i, // Hot Module Replacement messages
    /^Attention:/i, // Next.js attention messages
    /Waiting for file changes/i, // Watch mode messages
    /client compiled successfully/i,
    /server compiled successfully/i,
    /compiled client and server successfully/i,
    /Compiled.*in/i,
    /successfully compiled/i,
    /Ready in/i,
    /event compiled/i,
    /ready - started server/i,
    /info.*started server/i,
    /info.*webpack/i,
    /Using.*webpack/i,
    /Creating an optimized/i,
    /saved .*seconds/i,
    /Using/i,
    /Skipping validation/i,
    /fast refresh/i,
    /Refreshing/i,
    /watching.*paths/i,
    /[\u001b][^m]*m/,  // ANSI color codes used in Next.js console output
    /Load failed/i, // Resource loading messages
    /warn.*experimental/i, // Experimental feature warnings
    /Download the React DevTools/i, // React DevTools messages
    /The resource at/i,
    /React DevTools/i,
    /Warning: Extra attributes from the server/i,
    /Warning: validateDOMNesting/i,
    /Warning: Expected server HTML/i,
    /Warning: Prop/i,
    /Warning: The above error occurred/i,
    /rebuilding/i,
    /hot-reloader/i,
    /done in \d+ms/i,
    /hot-reloader-client\.tsx:/i,
    /page\.tsx:\d+:\d+/i,  // Source file references like page.tsx:32:24
    
    // Additional logs to hide
    /Middleware - Cookies for/i,
    /Auth middleware cookies/i,
    /Fetching session from API/i,
    /Current cookies before fetch/i,
    /Session API response/i,
    /Response headers/i,
    /Session data parsed/i,
    /Valid user found in session/i,
    /No authenticated user in session/i,
    /AuthProvider: Starting initial auth check/i,
    /AuthProvider: Checking session status/i,
    /AuthProvider: Valid session found/i,
    /AuthProvider: No valid session found/i,
    /AuthProvider: Auth check complete/i,
    /Auth middleware - Attempting to verify session/i,
    /Auth middleware - Session verification result/i,
    /Dashboard: User authenticated/i,
    /Dashboard: User authenticated and session active/i
  ],
  
  // These patterns will be throttled to once every LOG_INTERVAL
  throttled: [
    /Dashboard: User authenticated/i,
    /Auth check for \/dashboard with session/i,
    /Auth check for \//i,
    /Connected to PostgreSQL/i,
    /Database initialized/i,
    /Created new browser instance/i,
    /Found valid session/i,
    /Filtered out unverified businesses/i,
    /Session API called for/i,
    /DB Config - Database URL/i,
    /PostgresService: Connecting to database/i,
    /Database connection attempt/i,
    /SET, Docker URL: SET/i,
    /Looking up session with ID/i,
    /Home page useEffect running/i,
    /Still loading after timeout/i,
    /Initializing database connection/i,
    /User not authenticated/i,
    /\[AUTH/i,
    /Session API returned error/i,
    /API error during login/i,
    /Failed to initialize database/i
  ]
};

// Replace console.log with our filtered version
const patchConsole = () => {
  if (isInitialized) return;
  
  // Replace console.log
  console.log = function(...args: any[]) {
    const message = args.join(' ');
    
    // Special handling for compilation messages - completely suppress them
    if (/Compiled in \d+ms \(\d+ modules\)/.test(message) || 
        /compiled client and server successfully/i.test(message) ||
        /successfully compiled/i.test(message) ||
        /Compiled.*successfully/i.test(message)) {
      // Silently track without any logging
      compilationCount++;
      return;
    }
    
    // Check if this is a message we should hide
    if (patterns.hidden.some(pattern => pattern.test(message))) {
      return; // Skip logging completely
    }
    
    // Check if this is a message we should throttle
    let shouldThrottle = false;
    for (const pattern of patterns.throttled) {
      if (pattern.test(message)) {
        const now = Date.now();
        const messageKey = pattern.toString();
        
        // If we've seen this pattern recently, throttle it
        if (lastLogTime[messageKey] && (now - lastLogTime[messageKey] < LOG_INTERVAL)) {
          shouldThrottle = true;
          break;
        }
        
        // Update the last time we saw this pattern
        lastLogTime[messageKey] = now;
      }
    }
    
    if (shouldThrottle) {
      return; // Skip throttled message
    }
    
    // Log regular messages normally
    originalConsoleLog.apply(console, args);
  };
  
  // Replace console.warn 
  console.warn = function(...args: any[]) {
    const message = args.join(' ');
    
    // Similar filtering for warnings if needed
    if (patterns.hidden.some(pattern => pattern.test(message))) {
      return; // Skip logging completely
    }
    
    originalConsoleWarn.apply(console, args);
  };
  
  // Usually keep all error logs, but could filter some if needed
  console.error = function(...args: any[]) {
    const message = args.join(' ');
    
    // Filter out known error patterns that aren't actual errors
    if (
      /Failed to parse source map/i.test(message) ||
      /Unexpected end of JSON input/.test(message) ||
      /SyntaxError: Unexpected end of JSON/.test(message) ||
      /Warning: React does not recognize the/.test(message) ||
      /Warning: validateDOMNesting/.test(message) ||
      /EADDRINUSE/.test(message) && /Another instance of Next.js/.test(message) ||
      /Warning: Received `/.test(message)
    ) {
      // Skip specific error types that are more like warnings
      return;
    }
    
    originalConsoleError.apply(console, args);
  };
  
  isInitialized = true;
};

// Function to initialize suppression for browser
const initBrowserSuppression = () => {
  if (typeof window === 'undefined') return;
  
  try {
    // Create a style element for console messages
    const style = document.createElement('style');
    style.textContent = `
      /* Hide console messages matching patterns */
      .suppress-log { display: none !important; }
      /* Hide Next.js refresh indicators */
      .circle-indicator { display: none !important; }
      [data-nextjs-refresh-indicator] { display: none !important; }
      /* Hide webpack progress bars */
      [role="progressbar"] { display: none !important; }
    `;
    document.head.appendChild(style);
    
    // Also hide Next.js visual indicators
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              const element = node as Element;
              if (
                element.hasAttribute('data-nextjs-refresh-indicator') ||
                element.classList.contains('circle-indicator') ||
                element.getAttribute('role') === 'progressbar'
              ) {
                element.remove();
              }
            }
          });
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  } catch (e) {
    // Non-critical - ignore errors
  }
  
  // We need to patch console for browser
  patchConsole();
  
  // Additional browser-specific console intercept
  try {
    // Add custom suppression for the browser devtools
    // This injects CSS that hides specific console messages in the devtools UI
    const cssRules = `
      /* Hide Next.js development messages in browser console */
      .console-message-wrapper:has(.console-message-text:contains("[Fast Refresh]")) { display: none !important; }
      .console-message-wrapper:has(.console-message-text:contains("hot-reloader")) { display: none !important; }
      .console-message-wrapper:has(.console-message-text:contains("rebuilding")) { display: none !important; }
      .console-message-wrapper:has(.console-message-text:contains("Dashboard: User authenticated")) { display: none !important; }
      .console-message-wrapper:has(.console-message-text:contains("webpack")) { display: none !important; }
      .console-message-wrapper:has(.console-message-text:contains("compiled")) { display: none !important; }
      .console-message-wrapper:has(.console-message-text:contains("Compiled")) { display: none !important; }
      .console-message-wrapper:has(.console-message-text:contains("module")) { display: none !important; }
      .console-message-wrapper:has(.console-message-text:contains("chunk")) { display: none !important; }
      .console-message-wrapper:has(.console-message-text:contains("Fast Refresh")) { display: none !important; }
      .console-message-wrapper:has(.console-message-text:contains("ms")) { display: none !important; }
      .console-message-wrapper:has(.console-message-text:contains("ℹ")) { display: none !important; }
      .console-message-wrapper:has(.console-message-text:contains("info  -")) { display: none !important; }
    `;
    
    // Create and inject the style
    const devtoolsStyle = document.createElement('style');
    devtoolsStyle.textContent = cssRules;
    document.head.appendChild(devtoolsStyle);
    
    // Inspect any error messages that come through and hide certain patterns
    window.addEventListener('error', function(event) {
      const errorText = event.message || '';
      if (
        errorText.includes('[Fast Refresh]') ||
        errorText.includes('hot-reloader') ||
        errorText.includes('rebuilding') ||
        errorText.includes('Dashboard: User authenticated') ||
        errorText.includes('Unexpected end of JSON input') ||
        errorText.includes('webpack') ||
        errorText.includes('compiled') ||
        errorText.includes('Compiled') ||
        errorText.includes('module') ||
        errorText.includes('chunk') ||
        errorText.includes('Fast Refresh') ||
        errorText.match(/\d+ms/) ||
        errorText.includes('ℹ') ||
        errorText.includes('info  -')
      ) {
        // Prevent the error from showing in console
        event.preventDefault();
        return true;
      }
      return false;
    }, true);
  } catch (e) {
    // Ignore errors - non-critical for suppressions
  }
};

// Always activate in development mode
if (typeof process !== 'undefined' && 
    (process.env.SUPPRESS_FAST_REFRESH_LOGS === 'true' || process.env.NODE_ENV === 'development')) {
  // For server-side
  patchConsole();
  
  // For maximum suppression, patch the low-level process.stdout.write method as well
  // This catches logs that bypass console methods
  try {
    const originalStdoutWrite = process.stdout.write;
    process.stdout.write = function(buffer: any, ...args: any[]) {
      // Convert buffer to string for testing
      const str = buffer.toString();
      
      // Block development messages but keep Google/browser API logs
      if (
          // Aggressively block all Next.js development output
          (str.includes('[Fast Refresh]') || 
          str.includes('Compiled') || 
          str.includes('compiled') ||
          str.includes('modules') ||
          str.includes('Fast Refresh') ||
          str.includes('webpack') ||
          str.includes('rebuilding') ||
          str.includes('hot-reloader') ||
          str.includes('event compiled') ||
          str.includes('client compiled') ||
          str.includes('server compiled') ||
          str.includes('successfully compiled') ||
          str.includes('Ready in') ||
          str.includes('started server') ||
          str.includes('Waiting for') ||
          str.includes('info  - ') ||
          str.includes('ℹ ') ||
          str.match(/done in \d+ms/) ||
          str.match(/Compiled.*in/) ||
          str.match(/\d+ms/) && (str.includes('module') || str.includes('chunk'))) &&
          
          // IMPORTANT: Preserve specific business logs we DO want to see
          !str.includes('Google Auth:') &&
          !str.includes('BrowserAutomation:') &&
          !str.includes('browser-use-api:') &&
          !str.includes('[GoogleBusiness]') &&
          !str.includes('[CRITICAL]') &&
          !str.includes('[ERROR]') &&
          !str.includes('Failed to') &&
          !str.includes('Error:')
      ) {
        return true; // Pretend we wrote something
      }
      
      // Pass other messages through
      return originalStdoutWrite.apply(process.stdout, [buffer, ...args]);
    };
  } catch (error) {
    // Ignore errors - non-critical
  }
}

// For client-side code, we initialize during runtime
if (typeof window !== 'undefined') {
  // Initialize immediately if already in browser
  initBrowserSuppression();
  
  // Also handle Next.js fast refresh by re-initializing
  if (typeof window !== 'undefined') {
    const originalOnload = window.onload;
    window.onload = function(...args: any[]) {
      // Call the original onload if it exists
      if (originalOnload) {
        originalOnload.apply(this, args);
      }
      
      // Initialize our console suppression
      initBrowserSuppression();
    };
  }
}

export default patchConsole;