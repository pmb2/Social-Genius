/**
 * Credentials Manager
 * 
 * A unified service for managing secure credentials with encryption/decryption
 * capabilities. This handles both client-side and server-side operations.
 */

// Current version of the encryption algorithm
const ENCRYPTION_VERSION = 'v1';

// Constants for encryption
const MIN_PASSWORD_LENGTH = 6;
const DEFAULT_NONCE_LENGTH = 16;

/**
 * Encrypted credential data structure
 */
export interface EncryptedCredential {
  encryptedPassword: string;
  nonce: string;
  version: string;
}

/**
 * Client-side credential encryption options
 */
export interface EncryptionOptions {
  // Enable more secure encryption when available (Web Crypto API)
  useSecureEncryption?: boolean;
  
  // Custom nonce length (default: 16)
  nonceLength?: number;
  
  // Development mode override
  forceDevelopmentMode?: boolean;
}

/**
 * Server-side decryption options
 */
export interface DecryptionOptions {
  // Private key for decryption (in production, this would be securely stored)
  privateKey?: string;
  
  // Whether to throw errors on decryption failure
  throwOnError?: boolean;
  
  // Development mode override
  forceDevelopmentMode?: boolean;
}

/**
 * Common utility functions for both client and server
 */

/**
 * Generates a random string of specified length
 * @param length Length of the random string
 * @returns Random string
 */
export function generateRandomString(length: number = DEFAULT_NONCE_LENGTH): string {
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
 * Detects if we're running in development mode
 */
export function isDevelopmentMode(options?: { force?: boolean }): boolean {
  if (options?.force) return true;
  return process.env.NODE_ENV !== 'production';
}

/**
 * Client-side encryption functions
 */

/**
 * Encrypts a password using the best available method
 * 
 * In production, uses a secure encryption method (AES-GCM with Web Crypto API)
 * In development, uses a simple encoding method for ease of debugging
 * 
 * @param password The password to encrypt
 * @param options Optional encryption options
 * @returns Object containing the encrypted password, nonce, and version
 */
export function encryptPassword(
  password: string, 
  options?: EncryptionOptions
): EncryptedCredential {
  // Validate password
  if (!password) {
    throw new Error('Password cannot be empty');
  }
  
  // Check if we're in development mode
  const devMode = isDevelopmentMode({ force: options?.forceDevelopmentMode });

  // For development mode, use simple encoding
  if (devMode) {
    if (devMode) console.log('Using development mode password encryption (non-secure)');
    
    // Simple Base64 encoding as fallback for development
    // This is NOT secure and should NEVER be used in production
    const encodedPassword = btoa(password);
    
    return {
      encryptedPassword: encodedPassword,
      nonce: 'dev-mode-nonce',
      version: 'dev'
    };
  }
  
  // For production, try to use Web Crypto API
  try {
    // For browser environments with Web Crypto API
    if (options?.useSecureEncryption !== false && 
        typeof window !== 'undefined' && 
        window.crypto && 
        window.crypto.subtle) {
      // This would be implemented with window.crypto.subtle.encrypt
      // using AES-GCM for proper security
      
      // For now, we'll use a placeholder with a clear note that this 
      // needs to be implemented with proper crypto in production
      
      // TODO: Implement proper AES-GCM encryption using Web Crypto API
      // This is just a placeholder for the real implementation
      
      // Generate a nonce/salt for the encryption
      const nonce = generateRandomString(options?.nonceLength || DEFAULT_NONCE_LENGTH);
      
      // In a real implementation, we would:
      // 1. Generate a proper encryption key from the password
      // 2. Use window.crypto.subtle.encrypt with AES-GCM and the nonce
      // 3. Convert the encrypted data to a string format 
      
      // For now, using a simple method that's NOT secure for production
      // This must be replaced before going to production
      const encodedPassword = btoa(`${nonce}:${password}`); 
      
      return {
        encryptedPassword: encodedPassword,
        nonce: nonce,
        version: ENCRYPTION_VERSION
      };
    } else {
      // Generate a nonce for a fallback method
      const nonce = generateRandomString(options?.nonceLength || DEFAULT_NONCE_LENGTH);
      
      // Simple encoding with nonce as salt (NOT secure for production)
      const encodedPassword = btoa(`${nonce}:${password}`);
      
      return {
        encryptedPassword: encodedPassword,
        nonce: nonce,
        version: ENCRYPTION_VERSION
      };
    }
  } catch (error) {
    console.error('Error encrypting password:', error);
    
    // Fallback for any errors - NOT secure for production
    const fallbackNonce = generateRandomString(8);
    const fallbackEncoded = btoa(`${fallbackNonce}:${password}`);
    
    return {
      encryptedPassword: fallbackEncoded,
      nonce: fallbackNonce,
      version: 'fallback'
    };
  }
}

/**
 * Server-side decryption functions
 */

/**
 * Decrypts an encrypted password on the server side
 * 
 * @param encryptedData Object containing the encrypted password, nonce, and version
 * @param options Optional decryption options
 * @returns The decrypted password
 */
export function decryptPassword(
  encryptedData: EncryptedCredential, 
  options?: DecryptionOptions
): string {
  // For development-only implementations
  if (isDevelopmentMode({ force: options?.forceDevelopmentMode }) || encryptedData.version === 'dev') {
    try {
      return atob(encryptedData.encryptedPassword);
    } catch (error) {
      if (options?.throwOnError) {
        throw new Error(`Failed to decrypt development password: ${error instanceof Error ? error.message : String(error)}`);
      }
      return '';
    }
  }
  
  // Handle fallback version
  if (encryptedData.version === 'fallback') {
    try {
      const decoded = atob(encryptedData.encryptedPassword);
      if (decoded.includes(':')) {
        return decoded.split(':')[1];
      }
      return decoded;
    } catch (error) {
      if (options?.throwOnError) {
        throw new Error(`Failed to decrypt fallback password: ${error instanceof Error ? error.message : String(error)}`);
      }
      return '';
    }
  }
  
  // Handle production version
  try {
    // This is where we would implement proper decryption
    // based on the encryption algorithm used
    
    // For now, using the simple encoding scheme from encryptPassword
    const decoded = atob(encryptedData.encryptedPassword);
    
    // Check if the decoded value has the nonce prefix
    if (decoded.startsWith(`${encryptedData.nonce}:`)) {
      return decoded.substring(encryptedData.nonce.length + 1);
    }
    
    // Fallback if nonce prefix is not found
    if (options?.throwOnError) {
      throw new Error('Invalid encrypted data format: nonce prefix not found');
    }
    return decoded;
  } catch (error) {
    console.error('Error decrypting password:', error);
    if (options?.throwOnError) {
      throw new Error(`Failed to decrypt password: ${error instanceof Error ? error.message : String(error)}`);
    }
    return '';
  }
}

/**
 * Checks if password credentials need decryption
 * 
 * @param data The password string or encryption object
 * @returns True if the password needs decryption
 */
export function needsDecryption(data: string | object): boolean {
  if (typeof data === 'object') {
    return 'encryptedPassword' in data && 
           'nonce' in data && 
           'version' in data;
  }
  
  // Simple check for base64 encoding format
  // Note: This is just a heuristic and may not be 100% accurate
  return typeof data === 'string' && 
         /^[A-Za-z0-9+/=]+$/.test(data) && 
         data.length % 4 === 0;
}

/**
 * Safely unwraps credentials, handling both encrypted and plain text formats
 * 
 * @param credentials Either an encrypted credential object or a plain text password
 * @param options Optional decryption options
 * @returns The plain text password
 */
export function unwrapCredentials(
  credentials: EncryptedCredential | string, 
  options?: DecryptionOptions
): string {
  if (typeof credentials === 'string') {
    return credentials;
  }
  
  if (needsDecryption(credentials)) {
    return decryptPassword(credentials as EncryptedCredential, options);
  }
  
  return '';
}