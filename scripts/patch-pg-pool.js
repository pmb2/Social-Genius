

const fs = require('fs');
const path = require('path');

const pgPoolPath = path.join(__dirname, '..', 'node_modules', 'pg-pool', 'index.js');

try {
  let content = fs.readFileSync(pgPoolPath, 'utf8');

  if (content.includes('// PATCHED BY patch-pg-pool.js')) {
    console.log('pg-pool already patched, skipping.');
  } else {
    content = content.replace(
      /(class Pool extends EventEmitter {\s*constructor\(options, Client\) {)/,
      `$1\n    super(); // PATCHED BY patch-pg-pool.js`
    );
    fs.writeFileSync(pgPoolPath, content, 'utf8');
    console.log('Successfully patched pg-pool with super() call.');
  }
} catch (e) {
  console.error('Error patching pg-pool:', e);
}

