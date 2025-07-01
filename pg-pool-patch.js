// This patch fixes the Pool constructor in pg-pool
const fs = require('fs');
const path = require('path');

try {
  // Find pg-pool's location
  const pgPoolPath = require.resolve('pg-pool');
  console.log('Found pg-pool at:', pgPoolPath);
  
  // Read the file
  let poolCode = fs.readFileSync(pgPoolPath, 'utf8');
  
  // Check if super() is already called
  if (poolCode.includes('super()')) {
    console.log('super() already found in pg-pool constructor, no need to patch');
    process.exit(0);
  }
  
  // Look for the Pool constructor pattern
  const constructorPattern = /class Pool extends EventEmitter \{\s*constructor\(options, Client\) \{/;
  if (constructorPattern.test(poolCode)) {
    // Already has constructor, just need to add super()
    console.log('Constructor found, adding super() call');
    poolCode = poolCode.replace(
      /class Pool extends EventEmitter \{\s*constructor\(options, Client\) \{/,
      'class Pool extends EventEmitter {\n  constructor(options, Client) {\n    super()'
    );
  } else {
    // Need to add the entire constructor
    console.log('No constructor found, adding complete constructor with super()');
    poolCode = poolCode.replace(
      /class Pool extends EventEmitter \{/,
      'class Pool extends EventEmitter {\n  constructor(options, Client) {\n    super()'
    );
  }
  
  // Write the file back
  fs.writeFileSync(pgPoolPath, poolCode);
  console.log('Successfully patched pg-pool');
} catch (error) {
  console.error('Error patching pg-pool:', error);
  process.exit(1);
}
EOF < /dev/null
