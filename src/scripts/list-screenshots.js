/**
 * List and View Screenshots
 * 
 * Command-line utility to list and browse screenshots from Google Authentication.
 * Usage: node list-screenshots.js [userId]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Base directory for screenshots
const SCREENSHOTS_BASE_DIR = path.join(__dirname, '..', 'api', 'browser-use', 'screenshots');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

/**
 * Formats a filename to extract timestamp and meaningful name parts
 */
function formatFilename(filename) {
  // Extract timestamp from filename
  const timestampMatch = filename.match(/(\d{13})/);
  let timestamp = 'Unknown';
  
  if (timestampMatch && timestampMatch[1]) {
    const date = new Date(parseInt(timestampMatch[1], 10));
    timestamp = date.toISOString();
  }
  
  // Extract type from prefix
  let type = 'Other';
  if (filename.startsWith('pre-login')) type = 'Pre-Login';
  else if (filename.startsWith('post-login')) type = 'Post-Login';
  else if (filename.startsWith('page-load')) type = 'Page Load';
  else if (filename.startsWith('retry')) type = 'Retry Attempt';
  else if (filename.startsWith('initial')) type = 'Initial Page';
  
  return `${colors.green}${type}${colors.reset} | ${colors.yellow}${timestamp}${colors.reset} | ${filename}`;
}

/**
 * List screenshots for all users
 */
function listAllUsers() {
  console.log(`\n${colors.bgBlue}${colors.white} SCREENSHOT USERS ${colors.reset}\n`);
  
  try {
    if (!fs.existsSync(SCREENSHOTS_BASE_DIR)) {
      console.log(`${colors.red}Screenshot directory not found: ${SCREENSHOTS_BASE_DIR}${colors.reset}`);
      return;
    }
    
    const users = fs.readdirSync(SCREENSHOTS_BASE_DIR);
    
    if (users.length === 0) {
      console.log(`${colors.yellow}No screenshot users found${colors.reset}`);
      return;
    }
    
    // Get file counts and latest timestamps for each user
    const userDetails = users.map(userId => {
      const userDir = path.join(SCREENSHOTS_BASE_DIR, userId);
      
      // Skip if not a directory
      if (!fs.statSync(userDir).isDirectory()) return null;
      
      // Count screenshots
      const files = fs.readdirSync(userDir).filter(f => 
        f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')
      );
      
      // Get the most recent screenshot time
      let latestTime = 0;
      files.forEach(file => {
        const timestampMatch = file.match(/(\d{13})/);
        if (timestampMatch && timestampMatch[1]) {
          const timestamp = parseInt(timestampMatch[1], 10);
          if (timestamp > latestTime) {
            latestTime = timestamp;
          }
        }
      });
      
      return {
        userId,
        screenshotCount: files.length,
        latestScreenshot: latestTime ? new Date(latestTime).toISOString() : 'Unknown'
      };
    }).filter(Boolean);
    
    // Sort by latest screenshot time (most recent first)
    userDetails.sort((a, b) => {
      if (a.latestScreenshot === 'Unknown') return 1;
      if (b.latestScreenshot === 'Unknown') return -1;
      return new Date(b.latestScreenshot) - new Date(a.latestScreenshot);
    });
    
    // Display users
    userDetails.forEach((user, index) => {
      console.log(`${colors.bright}${index + 1}.${colors.reset} ${colors.cyan}${user.userId}${colors.reset}`);
      console.log(`   Screenshots: ${colors.yellow}${user.screenshotCount}${colors.reset}`);
      console.log(`   Latest: ${colors.green}${user.latestScreenshot}${colors.reset}`);
      console.log('');
    });
    
    console.log(`\nTo view screenshots for a specific user, run: ${colors.green}node list-screenshots.js <userId>${colors.reset}\n`);
    
  } catch (error) {
    console.error(`${colors.red}Error listing users: ${error.message}${colors.reset}`);
  }
}

/**
 * List screenshots for a specific user
 */
function listUserScreenshots(userId) {
  console.log(`\n${colors.bgBlue}${colors.white} SCREENSHOTS FOR USER: ${userId} ${colors.reset}\n`);
  
  try {
    const userDir = path.join(SCREENSHOTS_BASE_DIR, userId);
    
    if (!fs.existsSync(userDir)) {
      console.log(`${colors.red}No screenshots found for user: ${userId}${colors.reset}`);
      return;
    }
    
    // Get all screenshots (only PNG, JPG, JPEG files)
    const screenshots = fs.readdirSync(userDir).filter(f => 
      f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')
    );
    
    // Check if there are any text files that should be removed (from testing)
    const textFiles = fs.readdirSync(userDir).filter(f => f.endsWith('.txt'));
    if (textFiles.length > 0) {
      console.log(`${colors.yellow}Warning: Found ${textFiles.length} .txt files that are not valid screenshots.${colors.reset}`);
      console.log(`${colors.yellow}These should be removed as they are not valid screenshots.${colors.reset}`);
      textFiles.forEach(file => {
        console.log(`- ${file}`);
      });
      console.log();
    }
    
    if (screenshots.length === 0) {
      console.log(`${colors.yellow}No screenshots found for user: ${userId}${colors.reset}`);
      return;
    }
    
    // Group by type
    const groupedScreenshots = {};
    screenshots.forEach(screenshot => {
      let type = 'other';
      if (screenshot.startsWith('pre-login')) type = 'pre-login';
      else if (screenshot.startsWith('post-login')) type = 'post-login';
      else if (screenshot.startsWith('page-load')) type = 'page-load';
      else if (screenshot.startsWith('retry')) type = 'retry';
      else if (screenshot.startsWith('initial')) type = 'initial';
      
      if (!groupedScreenshots[type]) {
        groupedScreenshots[type] = [];
      }
      
      groupedScreenshots[type].push(screenshot);
    });
    
    // Display grouped screenshots
    Object.keys(groupedScreenshots).forEach(type => {
      console.log(`\n${colors.bgGreen}${colors.black} ${type.toUpperCase()} SCREENSHOTS (${groupedScreenshots[type].length}) ${colors.reset}\n`);
      
      // Sort by timestamp (most recent first)
      groupedScreenshots[type].sort((a, b) => {
        const aMatch = a.match(/(\d{13})/);
        const bMatch = b.match(/(\d{13})/);
        
        if (!aMatch) return 1;
        if (!bMatch) return -1;
        
        return parseInt(bMatch[1], 10) - parseInt(aMatch[1], 10);
      });
      
      // Display screenshots
      groupedScreenshots[type].forEach((screenshot, index) => {
        console.log(`${colors.bright}${index + 1}.${colors.reset} ${formatFilename(screenshot)}`);
        console.log(`   Path: ${colors.dim}${path.join(userDir, screenshot)}${colors.reset}`);
      });
    });
    
    // Open the screenshot directory
    console.log(`\n${colors.bgYellow}${colors.black} ACTIONS ${colors.reset}\n`);
    console.log(`To view screenshots, open: ${colors.green}${userDir}${colors.reset}`);
    
    if (process.platform === 'darwin' || process.platform === 'win32') {
      console.log('\nWould you like to open the screenshot directory? (y/n)');
      const key = process.stdin.read(1);
      
      if (key && (key.toString() === 'y' || key.toString() === 'Y')) {
        try {
          if (process.platform === 'darwin') {
            execSync(`open "${userDir}"`);
          } else if (process.platform === 'win32') {
            execSync(`explorer "${userDir}"`);
          }
          console.log(`${colors.green}Opened screenshot directory${colors.reset}`);
        } catch (error) {
          console.error(`${colors.red}Error opening directory: ${error.message}${colors.reset}`);
        }
      }
    }
    
  } catch (error) {
    console.error(`${colors.red}Error listing screenshots: ${error.message}${colors.reset}`);
  }
}

// Main execution
function main() {
  const userId = process.argv[2];
  
  if (!userId) {
    listAllUsers();
  } else {
    listUserScreenshots(userId);
  }
}

main();