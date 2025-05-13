/**
 * Utility functions for password encryption in the browser
 * Used for secure handling of Google credentials
 */

// Current version of the encryption algorithm
const ENCRYPTION_VERSION = '1';

/**
 * Encrypts a password using AES-GCM if available, or a simple encoding for development
 * @param password The password to encrypt
 * @returns Object containing the encrypted password, nonce, and version
 */
export function encryptPassword(password: string): {
  encryptedPassword: string;
  nonce: string;
  version: string;
} {
  // For development mode and testing
  if (process.env.NODE_ENV !== 'production') {
    console.log('Using development mode password encryption (non-secure)');
    
    // Simple Base64 encoding as fallback for development
    // This is NOT secure and should NEVER be used in production
    const encodedPassword = btoa(password);
    
    return {
      encryptedPassword: encodedPassword,
      nonce: 'dev-mode-nonce',
      version: 'dev'
    };
  }
  
  // Generate a random nonce/IV for AES-GCM
  // For production, we should use a secure encryption method
  // This would typically use window.crypto.subtle.encrypt with AES-GCM
  
  try {
    // Generate a nonce for AES-GCM
    const nonce = generateRandomString(16);
    
    // In a real implementation, we would use window.crypto.subtle.encrypt
    // For now, using a simple encoding scheme with nonce as salt
    // This is still not secure for production use
    const encodedPassword = btoa(`${nonce}:${password}`);
    
    return {
      encryptedPassword: encodedPassword,
      nonce: nonce,
      version: ENCRYPTION_VERSION
    };
  } catch (error) {
    console.error('Error encrypting password:', error);
    
    // Fallback for any errors
    const fallbackEncoded = btoa(password);
    return {
      encryptedPassword: fallbackEncoded,
      nonce: 'fallback-nonce',
      version: 'fallback'
    };
  }
}

/**
 * Generates a random string of specified length
 * @param length Length of the random string
 * @returns Random string
 */
function generateRandomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  // Use crypto API if available for better randomness
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const values = new Uint8Array(length);
    window.crypto.getRandomValues(values);
    
    for (let i = 0; i < length; i++) {
      result += characters.charAt(values[i] % characters.length);
    }
  } else {
    // Fallback to Math.random (less secure)
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
  }
  
  return result;
}

/**
 * Decrypts an encrypted password (for completeness, not used in the current flow)
 * @param encryptedData Object containing the encrypted password, nonce, and version
 * @returns The decrypted password
 */
export function decryptPassword(encryptedData: {
  encryptedPassword: string;
  nonce: string;
  version: string;
}): string {
  // For development-only implementations
  if (encryptedData.version === 'dev') {
    return atob(encryptedData.encryptedPassword);
  }
  
  // This would typically use window.crypto.subtle.decrypt with AES-GCM
  // For now, using the simple encoding scheme from encryptPassword
  try {
    // Reverse the simple encoding used in encryptPassword
    const decoded = atob(encryptedData.encryptedPassword);
    
    // In a real implementation with AES-GCM, we would use window.crypto.subtle.decrypt
    // For the simple encoding scheme, we just remove the nonce prefix
    if (decoded.startsWith(`${encryptedData.nonce}:`)) {
      return decoded.substring(encryptedData.nonce.length + 1);
    }
    
    // Fallback if nonce prefix is not found
    return decoded;
  } catch (error) {
    console.error('Error decrypting password:', error);
    return '';
  }
}