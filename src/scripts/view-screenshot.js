/**
 * View Screenshot in Browser
 * 
 * Simple tool to view a screenshot in a browser.
 * Usage: node view-screenshot.js <userId> <screenshotFilename>
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const open = require('open');
const url = require('url');

// Base directory for screenshots
const SCREENSHOTS_BASE_DIR = path.join(__dirname, '..', 'api', 'browser-use', 'screenshots');

// Create a simple HTTP server to serve the screenshot
async function serveScreenshot(userId, filename) {
  // Validate parameters
  if (!userId) {
    console.error('Error: User ID is required');
    console.log('Usage: node view-screenshot.js <userId> <screenshotFilename>');
    return;
  }
  
  const userDir = path.join(SCREENSHOTS_BASE_DIR, userId);
  
  // Check if user directory exists
  if (!fs.existsSync(userDir)) {
    console.error(`Error: User directory not found: ${userDir}`);
    return;
  }
  
  // If no filename is provided, list available screenshots
  if (!filename) {
    console.log('Available screenshots:');
    
    const screenshots = fs.readdirSync(userDir).filter(f => 
      f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')
    );
    
    if (screenshots.length === 0) {
      console.log('No screenshots found for this user');
      return;
    }
    
    screenshots.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });
    
    console.log('\nUsage: node view-screenshot.js <userId> <screenshotFilename>');
    return;
  }
  
  // Full path to the screenshot file
  const filePath = path.join(userDir, filename);
  
  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    console.error(`Error: Screenshot not found: ${filePath}`);
    
    // List available screenshots for this user
    console.log('\nAvailable screenshots:');
    const screenshots = fs.readdirSync(userDir).filter(f => 
      f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')
    );
    
    screenshots.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });
    
    return;
  }
  
  // Determine the MIME type
  let mimeType = 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
    mimeType = 'image/jpeg';
  }
  
  // Create a simple HTTP server
  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    
    // Serve the screenshot
    if (parsedUrl.pathname === '/screenshot') {
      res.writeHead(200, { 'Content-Type': mimeType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    
    // Serve an HTML page with the screenshot
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Screenshot Viewer</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: #2c2c2c;
              color: #ffffff;
            }
            h1 {
              color: #3498db;
            }
            .screenshot-container {
              background-color: #f5f5f5;
              padding: 20px;
              border-radius: 5px;
              text-align: center;
              margin-top: 20px;
            }
            .screenshot {
              max-width: 100%;
              height: auto;
              border: 1px solid #ddd;
              box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            }
            .metadata {
              background-color: #444;
              padding: 10px;
              border-radius: 5px;
              margin-top: 20px;
            }
            .buttons {
              margin-top: 20px;
            }
            button {
              background-color: #3498db;
              color: white;
              border: none;
              padding: 10px 20px;
              margin: 0 5px;
              border-radius: 3px;
              cursor: pointer;
            }
            button:hover {
              background-color: #2980b9;
            }
          </style>
        </head>
        <body>
          <h1>Screenshot Viewer</h1>
          <div class="metadata">
            <p><strong>User ID:</strong> ${userId}</p>
            <p><strong>Filename:</strong> ${filename}</p>
            <p><strong>Path:</strong> ${filePath}</p>
          </div>
          <div class="screenshot-container">
            <img src="/screenshot" class="screenshot" alt="Screenshot">
          </div>
          <div class="buttons">
            <button onclick="window.close()">Close</button>
            <button onclick="downloadImage()">Download</button>
            <button onclick="toggleDarkMode()">Toggle Dark/Light Mode</button>
          </div>
          
          <script>
            function downloadImage() {
              const link = document.createElement('a');
              link.href = '/screenshot';
              link.download = '${filename}';
              link.click();
            }
            
            function toggleDarkMode() {
              const body = document.body;
              const isDark = body.style.backgroundColor === 'white';
              
              if (isDark) {
                body.style.backgroundColor = '#2c2c2c';
                body.style.color = 'white';
              } else {
                body.style.backgroundColor = 'white';
                body.style.color = 'black';
              }
            }
          </script>
        </body>
      </html>
    `);
  });
  
  // Start the server
  const port = 3456;
  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Viewing screenshot: ${filename}`);
    console.log(`Press Ctrl+C to stop the server`);
    
    // Open the browser
    open(`http://localhost:${port}`);
  });
}

// Main execution
async function main() {
  const userId = process.argv[2];
  const filename = process.argv[3];
  
  try {
    await serveScreenshot(userId, filename);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

main();