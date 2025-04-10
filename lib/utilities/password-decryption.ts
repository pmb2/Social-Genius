/**
 * Password decryption utilities for secure client-server communication
 * This module provides methods to decrypt passwords that were encrypted by the client.
 */

// Private key for decryption (in a real app, this would be kept secure on the server)
// WARNING: This is a simple implementation for demo purposes.
// In production, use a proper asymmetric encryption scheme with a secure private key
const PRIVATE_KEY = 'socialGeniusPublicKey123456789'; // Same as public key for this demo

/**
 * Decrypts a password that was encrypted by the client
 * @param encryptedData Object containing the encrypted password and metadata
 * @returns The decrypted password
 */
export function decryptPassword(encryptedData: { 
  encryptedPassword: string; 
  nonce: string;
  version: string;
}): string {
  try {
    // Check version first
    if (encryptedData.version !== 'v1') {
      // Handle error or unsupported version
      if (encryptedData.version === 'error') {
        throw new Error('Client-side encryption error');
      }
      throw new Error(`Unsupported encryption version: ${encryptedData.version}`);
    }
    
    // Check if we got an encryption error from the client
    if (encryptedData.nonce === 'error') {
      throw new Error('Client reported encryption error');
    }
    
    const { encryptedPassword, nonce } = encryptedData;
    
    // Process the hex-encoded encrypted password
    let decrypted = '';
    for (let i = 0; i < encryptedPassword.length; i += 4) {
      // Extract the hex representation of the encrypted character
      const charHex = encryptedPassword.substring(i, i + 4);
      
      // Convert hex to character code
      const encryptedChar = parseInt(charHex, 16);
      
      // Get the corresponding key and nonce characters
      const keyChar = PRIVATE_KEY.charCodeAt((i/4) % PRIVATE_KEY.length);
      const nonceChar = nonce.charCodeAt((i/4) % nonce.length);
      
      // XOR to decrypt
      const decryptedChar = encryptedChar ^ keyChar ^ nonceChar;
      
      // Convert back to character
      decrypted += String.fromCharCode(decryptedChar);
    }
    
    return decrypted;
  } catch (error) {
    console.error('Error decrypting password:', error);
    throw new Error('Failed to decrypt password');
  }
}

/**
 * Checks if a password needs decryption
 * @param password The password string or encryption object
 * @returns True if the password needs decryption
 */
export function needsDecryption(password: string | object): boolean {
  if (typeof password === 'object') {
    return 'encryptedPassword' in password && 
           'nonce' in password && 
           'version' in password;
  }
  
  // Check if the password matches our encryption pattern
  // All characters are hex digits and the length is a multiple of 4
  return typeof password === 'string' && 
         /^[0-9a-f]+$/.test(password) && 
         password.length % 4 === 0;
}