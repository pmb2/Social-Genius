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
    // Next.js Fast Refresh and compilation messages
    /\[Fast Refresh\]/i,
    /Fast Refresh/i,
    /Compiled/i,
    /Compiling/i,
    /compiled/i,
    /modules/i,
    /waiting for/i,
    /\d+ms/i, // Timestamps in milliseconds
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
    
    // Special handling for compilation messages
    if (/Compiled in \d+ms \(\d+ modules\)/.test(message)) {
      const now = Date.now();
      // Only show compilation messages every 10 seconds max
      if (now - lastCompilationTime > 10000) {
        lastCompilationTime = now;
        compilationCount = 1;
        // Show only the first compilation message after the cooldown period
        originalConsoleLog.apply(console, args);
      } else {
        // Count but don't show intermediate compilation messages
        compilationCount++;
        
        // If it's been more than 5 seconds but less than 10, show a summary
        if (now - lastCompilationTime > 5000) {
          originalConsoleLog(`Compiled ${compilationCount} times in the last ${Math.floor((now - lastCompilationTime)/1000)} seconds`);
          lastCompilationTime = now;
          compilationCount = 0;
        }
      }
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
  
  // Create a style element for console messages
  const style = document.createElement('style');
  style.textContent = `
    /* Hide console messages matching patterns */
    .suppress-log { display: none !important; }
  `;
  document.head.appendChild(style);
  
  // We need to patch console for browser
  patchConsole();
  
  // Additional browser-specific console intercept
  try {
    // Add custom suppression for the browser devtools
    // This injects CSS that hides specific console messages in the devtools UI
    const cssRules = `
      /* Hide Fast Refresh messages */
      .console-message-wrapper:has(.console-message-text:contains("[Fast Refresh]")) { display: none !important; }
      .console-message-wrapper:has(.console-message-text:contains("hot-reloader")) { display: none !important; }
      .console-message-wrapper:has(.console-message-text:contains("rebuilding")) { display: none !important; }
      .console-message-wrapper:has(.console-message-text:contains("Dashboard: User authenticated")) { display: none !important; }
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
        errorText.includes('Unexpected end of JSON input')
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
      
      // Block Fast Refresh related messages
      if (str.includes('[Fast Refresh]') || 
          str.includes('Compiled') || 
          str.includes('modules') ||
          str.includes('Fast Refresh') ||
          str.includes('webpack') ||
          str.includes('rebuilding') ||
          str.includes('hot-reloader') ||
          str.match(/done in \d+ms/)) {
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