#!/usr/bin/env node

/**
 * This script checks for missing modules in the project by analyzing import statements
 * and comparing them against the module manifest.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load the module manifest
let moduleManifest;
try {
  moduleManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../module-manifest.json'), 'utf8'));
} catch (error) {
  console.error('Error loading module manifest:', error.message);
  process.exit(1);
}

// Get all TypeScript and JavaScript files in the project
const findFiles = (extensions) => {
  try {
    const result = execSync(`find . -type f -name "*.${extensions}" | grep -v "node_modules" | grep -v ".next" | grep -v ".git"`, { encoding: 'utf8' });
    return result.split('\n').filter(Boolean);
  } catch (error) {
    console.error('Error finding files:', error.message);
    return [];
  }
};

const files = [
  ...findFiles('tsx'),
  ...findFiles('ts'),
  ...findFiles('jsx'),
  ...findFiles('js')
];

// Extract imports from files
const extractImports = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const importRegex = /import\s+(?:{[^}]*}|\*\s+as\s+[^\s;]+|[^\s;,]+)\s+from\s+['"]([^'"]+)['"]/g;
    
    const imports = [];
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return [];
  }
};

// Check for missing modules
const checkMissingModules = () => {
  const modulePaths = new Set(moduleManifest.modules.map(m => m.path));
  const missingModules = new Map();
  
  files.forEach(filePath => {
    const imports = extractImports(filePath);
    
    imports.forEach(importPath => {
      // Only check for imports that start with @/
      if (importPath.startsWith('@/')) {
        if (!modulePaths.has(importPath)) {
          if (!missingModules.has(importPath)) {
            missingModules.set(importPath, []);
          }
          missingModules.get(importPath).push(filePath);
        }
      }
    });
  });
  
  return missingModules;
};

// Check for missing packages
const checkMissingPackages = () => {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    const installedPackages = new Set([
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.devDependencies || {})
    ]);
    
    const missingPackages = moduleManifest.requiredPackages.filter(pkg => !installedPackages.has(pkg));
    return missingPackages;
  } catch (error) {
    console.error('Error checking packages:', error.message);
    return [];
  }
};

// Main execution
const missingModules = checkMissingModules();
const missingPackages = checkMissingPackages();

if (missingModules.size > 0) {
  console.log('\n🔍 Missing modules detected:');
  missingModules.forEach((files, modulePath) => {
    console.log(`\n  📁 ${modulePath}`);
    console.log('  Used in:');
    files.forEach(file => {
      console.log(`    - ${file}`);
    });
  });
}

if (missingPackages.length > 0) {
  console.log('\n📦 Missing packages detected:');
  console.log(missingPackages.join(', '));
  console.log('\nInstall them with:');
  console.log(`npm install ${missingPackages.join(' ')}`);
}

if (missingModules.size === 0 && missingPackages.length === 0) {
  console.log('✅ All modules and packages are properly set up!');
} else {
  console.log('\n❗ Please fix the missing modules and packages to ensure the application works correctly.');
}