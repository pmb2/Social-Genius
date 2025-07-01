#!/usr/bin/env node

/**
 * This script fixes the pg-pool module by ensuring that the Pool constructor
 * properly calls super() to initialize the EventEmitter parent class.
 */

const fs = require('fs');
const path = require('path');

// Try to find the pg-pool module
try {
  const pgPoolPath = require.resolve('pg-pool');
  console.log('Found pg-pool at:', pgPoolPath);
  
  // Read the source code
  const source = fs.readFileSync(pgPoolPath, 'utf8');
  
  // Check if super() is already called
  if (source.includes('super()')) {
    console.log('Constructor already calls super(), no fix needed');
    process.exit(0);
  }
  
  // Create fixed version with proper constructor
  let fixed = source;
  
  // Fix the Pool class constructor
  if (fixed.includes('class Pool extends EventEmitter {')) {
    console.log('Fixing Pool class constructor...');
    
    // Replace the class definition to include a proper constructor
    fixed = fixed.replace(
      'class Pool extends EventEmitter {',
      `class Pool extends EventEmitter {
  constructor(options, Client) {
    super(); // Call EventEmitter constructor
    `
    );
    
    // When there's already a constructor, we need to remove it to avoid duplication
    if (fixed.includes('constructor(options, Client) {')) {
      console.log('Removing duplicate constructor...');
      fixed = fixed.replace(
        /\s*constructor\(options, Client\) \{[^}]*}/,
        ''
      );
    }
    
    // Write the fixed version back
    fs.writeFileSync(pgPoolPath, fixed);
    console.log('Successfully fixed pg-pool module!');
  } else {
    console.error('Could not find Pool class definition in', pgPoolPath);
    process.exit(1);
  }
} catch (error) {
  console.error('Error fixing pg-pool module:', error);
  process.exit(1);
}