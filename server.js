const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

// Determine if we are in development mode
const dev = process.env.NODE_ENV !== 'production';
// Parse the port from environment variables or default to 3000
const port = parseInt(process.env.PORT || '3000', 10);
// Use 0.0.0.0 to bind to all network interfaces, ensuring external accessibility
const hostname = '0.0.0.0';

// Create the Next.js app instance
// This prepares the Next.js application for handling requests.
const app = next({ dev, hostname, port });
// Get the Next.js request handler. This function will process all Next.js routes,
// API routes, and static files (like favicon.ico from the public directory).
const handle = app.getRequestHandler();

// Prepare the Next.js app. This must complete before the server starts listening.
app.prepare().then(() => {
  // Create a standard Node.js HTTP server
  createServer(async (req, res) => {
    try {
      // Parse the incoming request URL to extract pathname and query parameters
      const parsedUrl = parse(req.url, true);
      // const { pathname, query } = parsedUrl; // Destructure if you need to handle custom routes before Next.js

      // --- Custom Server-Side Logic (Optional) ---
      // You can add custom routes here that should be handled by your Node.js server
      // *before* Next.js gets a chance to process them.
      // For example, a simple health check that doesn't go through Next.js:
      if (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/api/health') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('OK');
        return; // Important: return after handling the request
      }

      // --- Delegate to Next.js ---
      // For all other requests, let Next.js handle them.
      // This includes:
      // - All Next.js pages (e.g., /, /about, /blog/[slug])
      // - All Next.js API routes (e.g., /api/hello)
      // - All static files located in the `public` directory (e.g., /favicon.ico, /images/logo.png)
      await handle(req, res, parsedUrl);
    } catch (err) {
      // Log any errors that occur during request handling
      console.error('Error occurred handling request:', req.url, err);
      // Send a 500 Internal Server Error response
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  })
  // Start the server and listen on the specified port and hostname
  .listen(port, hostname, (err) => {
    if (err) {
      // If there's an error starting the server (e.g., port already in use), throw it
      throw err;
    }
    console.log(`> Ready on http://${hostname}:${port}`);
  });
})
.catch((err) => {
  // Catch any errors that occur during the Next.js app preparation phase
  console.error('Failed to prepare Next.js app:', err);
  // Exit the process if Next.js app preparation fails, as the server cannot function
  process.exit(1);
});

// --- Global Error Handling (Good Practice) ---
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Depending on your application, you might want to log this and exit,
  // or just log and continue if it's not critical.
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // It is crucial to exit the process after an uncaught exception
  // to prevent the application from running in an undefined state.
  process.exit(1);
});
