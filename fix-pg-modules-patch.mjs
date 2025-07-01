/**
 * This script fixes pg module compatibility issues
 * It should be run before using pg
 */

// When used with ES modules, pg-pool might fail because it's using 'super()'
// This patch modifies the pg-pool code to make it compatible
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function patchPgPool() {
  try {
    // Find the pg-pool module
    const pgPoolPath = path.resolve(process.cwd(), 'node_modules', 'pg-pool', 'index.js');
    
    if (!fs.existsSync(pgPoolPath)) {
      console.error('Could not find pg-pool module at:', pgPoolPath);
      return false;
    }
    
    // Read the file
    let pgPoolCode = fs.readFileSync(pgPoolPath, 'utf8');
    
    // Check if the file already contains the patched code
    if (pgPoolCode.includes('// PATCHED: Fixed super() call')) {
      console.log('pg-pool already patched');
      return true;
    }
    
    // Replace the problematic code that uses super()
    const originalCode = 'constructor(options) {\n    super();';
    const patchedCode = 'constructor(options) {\n    // PATCHED: Fixed super() call\n    EventEmitter.call(this);';
    
    // Apply the patch
    pgPoolCode = pgPoolCode.replace(originalCode, patchedCode);
    
    // Write the patched code back to the file
    fs.writeFileSync(pgPoolPath, pgPoolCode, 'utf8');
    
    console.log('✅ Successfully patched pg-pool module');
    return true;
  } catch (error) {
    console.error('Failed to patch pg-pool:', error);
    return false;
  }
}

// Run the patch function
patchPgPool();