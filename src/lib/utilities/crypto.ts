/**
 * Encryption utilities for securely storing sensitive data
 * Used primarily for Google OAuth refresh tokens
 */

import crypto from 'crypto';

// Encryption algorithm used (AES-256-GCM provides both encryption and authentication)
const ALGORITHM = 'aes-256-gcm';
// IV (Initialization Vector) length in bytes
const IV_LENGTH = 16;
// Auth tag length for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts sensitive data using AES-256-GCM
 * @param text - The plaintext to encrypt
 * @param encryptionKey - The key to use for encryption (must be 32 bytes for AES-256)
 * @returns Base64 encoded encrypted string with IV and auth tag
 */
export function encryptData(text: string, encryptionKey: string): string {
  try {
    // Derive a 32-byte key from the provided encryption key using SHA-256
    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    
    // Generate a random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher with key, IV, and auth tag length
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt the data
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get the auth tag (for GCM mode)
    const authTag = cipher.getAuthTag();
    
    // Combine IV, encrypted data, and auth tag
    // Format: base64(iv):base64(authTag):base64(encryptedData)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts data that was encrypted with encryptData
 * @param encryptedText - The encrypted text (format: iv:authTag:encryptedData)
 * @param encryptionKey - The encryption key used to encrypt the data
 * @returns The decrypted plaintext
 */
export function decryptData(encryptedText: string, encryptionKey: string): string {
  try {
    // Derive the key from the encryption key
    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    
    // Split the encrypted text into its components
    const [ivBase64, authTagBase64, encryptedDataBase64] = encryptedText.split(':');
    
    if (!ivBase64 || !authTagBase64 || !encryptedDataBase64) {
      throw new Error('Invalid encrypted data format');
    }
    
    // Convert base64 components to buffers
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const encryptedData = Buffer.from(encryptedDataBase64, 'base64');
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    // Set auth tag
    decipher.setAuthTag(authTag);
    
    // Decrypt the data
    let decrypted = decipher.update(encryptedData, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Generates a secure random string for use as encryption keys, etc.
 * @param length Length of the random string to generate
 * @returns A secure random string in hex format
 */
export function generateSecureKey(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hashes a value using SHA-256
 * @param value The value to hash
 * @returns The SHA-256 hash as a hex string
 */
export function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}