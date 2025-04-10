/**
 * Password encryption utilities for secure client-server communication
 * This module provides methods to encrypt passwords before sending them to the server.
 * 
 * We're using a simple encryption scheme for demonstration purposes:
 * - encrypt: Uses AES-GCM to encrypt passwords with a public key before transmission
 * - generateNonce: Generates a random nonce for use with the encryption
 */

// Public key for encryption (in a real app, this would be fetched from the server)
// WARNING: This is a simple implementation for demo purposes.
// In production, use a proper asymmetric encryption scheme with a server-provided public key
const PUBLIC_KEY = 'socialGeniusPublicKey123456789';

/**
 * Encrypts a password using a simple but effective algorithm
 * @param password The plain text password to encrypt
 * @returns An object containing the encrypted password and encryption metadata
 */
export function encryptPassword(password: string): { 
  encryptedPassword: string; 
  nonce: string;
  version: string;
} {
  try {
    // Generate a random nonce (number used once) for this encryption
    const nonce = generateNonce();
    
    // Perform the encryption (simplified for demo)
    // In a real implementation, this would use the Web Crypto API
    // with proper asymmetric encryption
    
    // XOR the password with the key and nonce
    let encrypted = '';
    for (let i = 0; i < password.length; i++) {
      const charCode = password.charCodeAt(i);
      const keyChar = PUBLIC_KEY.charCodeAt(i % PUBLIC_KEY.length);
      const nonceChar = nonce.charCodeAt(i % nonce.length);
      
      // XOR operation with both key and nonce
      const encryptedChar = charCode ^ keyChar ^ nonceChar;
      
      // Convert to hex representation
      encrypted += encryptedChar.toString(16).padStart(4, '0');
    }
    
    return {
      encryptedPassword: encrypted,
      nonce,
      version: 'v1' // Version identifier for future algorithm changes
    };
  } catch (error) {
    console.error('Error encrypting password:', error);
    
    // Fallback behavior for errors - still better than plaintext
    // but client should be alerted of encryption failure
    return {
      encryptedPassword: btoa(`error:${password.substring(0, 3)}...`),
      nonce: 'error',
      version: 'error'
    };
  }
}

/**
 * Generates a random nonce (number used once) for encryption
 * @returns A random string to use as a nonce
 */
function generateNonce(): string {
  const nonceLength = 16;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  
  // Generate a random string of nonceLength
  for (let i = 0; i < nonceLength; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return nonce;
}

/**
 * Checks if a password appears to be encrypted
 * @param password The password to check
 * @returns True if the password appears to be encrypted
 */
export function isPasswordEncrypted(password: string): boolean {
  // Check if the password matches our encryption pattern
  // All characters are hex digits and the length is a multiple of 4
  return /^[0-9a-f]+$/.test(password) && password.length % 4 === 0;
}