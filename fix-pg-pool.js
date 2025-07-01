const fs = require('fs');
const path = require('path');

// Find pg-pool module
const pgPoolPath = path.resolve(process.cwd(), 'node_modules/pg-pool/index.js');

if (!fs.existsSync(pgPoolPath)) {
  console.error('pg-pool module not found at:', pgPoolPath);
  process.exit(1);
}

// Read the current file
const contents = fs.readFileSync(pgPoolPath, 'utf8');

// Check if already patched
if (contents.includes('// PATCHED')) {
  console.log('pg-pool is already patched. No changes needed.');
  process.exit(0);
}

// Replace the problematic code with compatible version
const patchedContent = contents
  .replace('constructor(options) {\n    super();', 'constructor(options) {\n    // PATCHED\n    EventEmitter.call(this);');

// Write the patched file
fs.writeFileSync(pgPoolPath, patchedContent, 'utf8');

console.log('Successfully patched pg-pool module for ES compatibility');