// ESM test file for browser-use authentication

// Since this is an ESM file, we need to use dynamic imports for the TypeScript files
async function main() {
  console.log('Testing browser-use Google authentication...');
  
  try {
    // Dynamically import the fs module
    const { default: fs } = await import('fs');
    
    // Create a screenshots directory for testing
    const screenshotsDir = './screenshots/test-' + Date.now();
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    console.log(`Created screenshots directory: ${screenshotsDir}`);
    
    // Use a test account - replace with actual test credentials
    // In production, never hardcode credentials
    const testCredentials = {
      email: 'test@example.com', // Replace with test account
      password: 'testpassword123' // Replace with test password
    };
    
    console.log('Starting Google authentication test (this may take a minute)...');
    
    // Dynamically import the browser-use-auth module
    // We can't directly import TypeScript files in ESM
    try {
      // We'll use the lib/compliance/auth-service.ts module which imports the browser-use-auth module
      const { handleBusinessAuthentication } = await import('./lib/compliance/auth-service.js');
      
      // Test the authentication function
      const result = await handleBusinessAuthentication(
        'test-business',
        {
          email: testCredentials.email,
          password: testCredentials.password,
          useAlternativeUrls: true
        }
      );
      
      console.log('Authentication test completed with result:', {
        authenticated: result.authenticated,
        success: result.success,
        error: result.error,
        message: result.message,
        errorCode: result.errorCode
      });
      
      if (!result.authenticated) {
        console.log('Authentication failed with error:', result.error);
        console.log('Error message:', result.message);
        console.log('Error code:', result.errorCode);
      }
    } catch (importError) {
      console.error('Failed to import authentication module:', importError);
    }
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

main().catch(err => {
  console.error('Unhandled error in main:', err);
  process.exit(1);
});