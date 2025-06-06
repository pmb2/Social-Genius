/**
 * Secure Credential Handler
 * 
 * This service provides secure methods for handling sensitive credentials
 * including hashing, encryption, and verification.
 */

/**
 * Hash a password securely using Web Crypto API
 * @param password The plaintext password to hash
 * @returns Promise that resolves to the hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // Check if we're in a secure context with Web Crypto API available
    if (window.crypto && window.crypto.subtle) {
      // Use SHA-256 for hashing
      const passwordBuffer = await window.crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(password)
      );

      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(passwordBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Fallback for non-secure contexts
      console.warn('Web Crypto API not available - using basic encoding only');
      // Use basic encoding as a minimal layer of obfuscation
      return btoa(password + Date.now().toString());
    }
  } catch (error) {
    console.error('Error hashing password:', error);
    // Never return plaintext password
    return btoa(password + Math.random().toString(36).substring(2));
  }
}

/**
 * Secure Transmission of Credentials
 * 
 * @param url The endpoint URL
 * @param credentials Object containing credentials (e.g., email and password)
 * @returns Promise with the response data
 */
export async function secureTransmit(
  url: string, 
  credentials: Record<string, any>
): Promise<any> {
  try {
    // Force HTTPS in production
    if (window.location.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
      throw new Error('HTTPS required for secure credential transmission');
    }

    // Process any password in the credentials
    const processedCredentials = { ...credentials };
    
    if (credentials.password) {
      // Hash the password before transmission
      processedCredentials.passwordHash = await hashPassword(credentials.password);
      delete processedCredentials.password; // Remove plaintext password
    }

    // Add timestamp to prevent replay attacks
    processedCredentials._timestamp = Date.now();

    // Make secure fetch request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Secure-Auth': 'true',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      },
      body: JSON.stringify(processedCredentials),
      credentials: 'include',
      cache: 'no-store',
      redirect: 'follow'
    });

    // Check for success
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Authentication failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Secure transmission error:', error);
    throw error;
  }
}

/**
 * Check if the current connection is secure
 * @returns Boolean indicating if connection is secure
 */
export function isSecureConnection(): boolean {
  // In browser context
  if (typeof window !== 'undefined') {
    return window.location.protocol === 'https:';
  }
  
  // In Node.js context, assume secure if in production
  return process.env.NODE_ENV === 'production';
}

/**
 * Redirect to secure connection if needed
 * @returns True if already secure, false if redirect initiated
 */
export function enforceSecureConnection(): boolean {
  if (typeof window !== 'undefined' && 
      window.location.protocol !== 'https:' && 
      process.env.NODE_ENV === 'production') {
    
    window.location.href = window.location.href.replace('http:', 'https:');
    return false;
  }
  return true;
}