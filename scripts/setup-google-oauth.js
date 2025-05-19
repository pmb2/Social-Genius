/**
 * Google OAuth Setup Script
 *
 * This script helps set up the required environment variables for Google OAuth
 * and checks if the database tables are properly configured.
 */

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Prompts for environment variables
 */
async function promptForCredentials() {
  console.log('\n=== Google OAuth Credentials Setup ===\n');
  
  console.log('You need to set up the following environment variables for Google OAuth:');
  console.log('1. GOOGLE_CLIENT_ID - Obtained from Google Cloud Console');
  console.log('2. GOOGLE_CLIENT_SECRET - Obtained from Google Cloud Console');
  console.log('3. GOOGLE_REDIRECT_URI - Usually http://localhost:3000/api/google-auth/callback for development');
  console.log('4. GOOGLE_TOKEN_ENCRYPTION_KEY - A random string used to encrypt tokens\n');
  
  let envVars = {};
  let envUpdated = false;
  
  // Check existing values
  const currentClientId = process.env.GOOGLE_CLIENT_ID;
  const currentClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const currentRedirectUri = process.env.GOOGLE_REDIRECT_URI;
  const currentEncryptionKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  
  console.log('Current values:');
  console.log(`- GOOGLE_CLIENT_ID: ${currentClientId ? 'Set' : 'Not set'}`);
  console.log(`- GOOGLE_CLIENT_SECRET: ${currentClientSecret ? 'Set' : 'Not set'}`);
  console.log(`- GOOGLE_REDIRECT_URI: ${currentRedirectUri || 'Not set'}`);
  console.log(`- GOOGLE_TOKEN_ENCRYPTION_KEY: ${currentEncryptionKey ? 'Set' : 'Not set'}\n`);
  
  const answer = await askQuestion('Do you want to update these values? (y/n): ');
  
  if (answer.toLowerCase() === 'y') {
    // Client ID
    const clientId = await askQuestion('Enter your Google Client ID: ');
    if (clientId && clientId !== currentClientId) {
      envVars.GOOGLE_CLIENT_ID = clientId;
      envUpdated = true;
    }
    
    // Client Secret
    const clientSecret = await askQuestion('Enter your Google Client Secret: ');
    if (clientSecret && clientSecret !== currentClientSecret) {
      envVars.GOOGLE_CLIENT_SECRET = clientSecret;
      envUpdated = true;
    }
    
    // Redirect URI
    let redirectUri = await askQuestion('Enter your Google Redirect URI (default: http://localhost:3000/api/google-auth/callback): ');
    if (!redirectUri) {
      redirectUri = 'http://localhost:3000/api/google-auth/callback';
    }
    if (redirectUri !== currentRedirectUri) {
      envVars.GOOGLE_REDIRECT_URI = redirectUri;
      envUpdated = true;
    }
    
    // Encryption Key
    let encryptionKey = await askQuestion('Enter a Token Encryption Key (leave blank to generate a random one): ');
    if (!encryptionKey) {
      encryptionKey = crypto.randomBytes(32).toString('hex');
      console.log(`Generated random encryption key: ${encryptionKey.substring(0, 10)}...`);
    }
    if (encryptionKey !== currentEncryptionKey) {
      envVars.GOOGLE_TOKEN_ENCRYPTION_KEY = encryptionKey;
      envUpdated = true;
    }
    
    if (envUpdated) {
      await updateEnvFile(envVars);
      console.log('\nEnvironment variables updated successfully!');
    } else {
      console.log('\nNo changes were made to environment variables.');
    }
  }
  
  return envUpdated;
}

/**
 * Updates the .env file with new variables
 */
async function updateEnvFile(vars) {
  const envPath = path.join(process.cwd(), '.env');
  
  // Read existing .env file or create a new one
  let envContent = '';
  try {
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
  } catch (error) {
    console.error('Error reading .env file:', error);
  }
  
  // Update or add each variable
  Object.entries(vars).forEach(([key, value]) => {
    // Check if the variable already exists
    const regex = new RegExp(`^${key}=.*`, 'm');
    if (regex.test(envContent)) {
      // Replace existing variable
      envContent = envContent.replace(regex, `${key}="${value}"`);
    } else {
      // Add new variable
      envContent += `\n${key}="${value}"`;
    }
  });
  
  // Write the updated content back to the .env file
  fs.writeFileSync(envPath, envContent.trim() + '\n');
}

/**
 * Prompts the user for input
 */
function askQuestion(query) {
  return new Promise(resolve => {
    rl.question(query, answer => {
      resolve(answer);
    });
  });
}

/**
 * Checks database connection and tables
 */
async function checkDatabase() {
  console.log('\n=== Database Check ===\n');
  
  try {
    // Check if tables exist by making a request to the API
    console.log('Checking database connection...');
    
    // Try to initialize the database tables if needed
    console.log('Making a request to check Google OAuth credentials...');
    
    // Use curl to make a request to the API
    const response = execSync('curl -s -X GET http://localhost:3000/api/google-auth/check-credentials').toString();
    
    try {
      const data = JSON.parse(response);
      
      if (data.success) {
        console.log('\nDatabase check results:');
        console.log(`- OAuth tables: ${data.database.oauthTables}`);
        console.log(`- Configuration status: ${data.isConfigured ? 'Configured' : 'Not configured'}\n`);
        
        if (data.database.oauthTables === 'Do not exist') {
          console.log('Google OAuth tables do not exist. They will be created automatically when needed.');
        }
        
        return data.isConfigured;
      } else {
        console.error('Error checking database:', data.error);
        return false;
      }
    } catch (parseError) {
      console.error('Error parsing API response:', parseError);
      console.log('Raw response:', response);
      return false;
    }
  } catch (error) {
    console.error('Error checking database:', error.message);
    console.log('Make sure your application is running (npm run dev) before running this script.');
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== Google OAuth Setup ===');
  
  // Prompt for credentials
  const credsUpdated = await promptForCredentials();
  
  // Check database
  const dbConfigured = await checkDatabase();
  
  console.log('\n=== Setup Summary ===\n');
  
  if (credsUpdated) {
    console.log('✅ Environment variables have been updated');
    console.log('   Please restart your application to apply the changes');
  } else {
    console.log('ℹ️ No changes were made to environment variables');
  }
  
  if (dbConfigured) {
    console.log('✅ Database is properly configured for Google OAuth');
  } else {
    console.log('⚠️ Database is not fully configured for Google OAuth');
    console.log('   Tables will be created automatically when needed');
  }
  
  console.log('\n=== Next Steps ===\n');
  console.log('1. Make sure your Google Cloud project has the Google Business Profile API enabled');
  console.log('2. Ensure your OAuth consent screen is configured with the right scopes (https://www.googleapis.com/auth/business.manage)');
  console.log('3. Verify that your authorized redirect URIs match GOOGLE_REDIRECT_URI');
  console.log('4. Restart your application to apply any changes made');
  
  rl.close();
}

main().catch(error => {
  console.error('An error occurred:', error);
  rl.close();
});