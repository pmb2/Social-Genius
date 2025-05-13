/**
 * Screenshot Directory Cleanup
 * 
 * This script removes any non-image files from the screenshots directory
 * and ensures that only PNG, JPG, and JPEG files are kept.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the screenshots base directory
const SCREENSHOTS_BASE_DIR = path.join(__dirname, '..', 'api', 'browser-use', 'screenshots');

/**
 * Recursively cleans a directory to remove non-image files
 */
function cleanDirectory(dirPath) {
  console.log(`Cleaning directory: ${dirPath}`);
  
  // Check if directory exists
  if (!fs.existsSync(dirPath)) {
    console.log(`Directory does not exist: ${dirPath}`);
    return {
      removedFiles: 0,
      totalFiles: 0,
      cleanedDirs: 0
    };
  }
  
  let stats = {
    removedFiles: 0,
    totalFiles: 0,
    cleanedDirs: 0
  };
  
  // Read directory contents
  const items = fs.readdirSync(dirPath);
  
  // Process each item
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    
    // Skip hidden files
    if (item.startsWith('.')) {
      continue;
    }
    
    // Check if it's a directory or file
    if (fs.statSync(itemPath).isDirectory()) {
      // Recursively clean subdirectory
      console.log(`Found subdirectory: ${item}`);
      const subStats = cleanDirectory(itemPath);
      
      // Update stats
      stats.removedFiles += subStats.removedFiles;
      stats.totalFiles += subStats.totalFiles;
      stats.cleanedDirs += subStats.cleanedDirs + 1;
    } else {
      // It's a file - check if it's an image
      stats.totalFiles++;
      
      const isImageFile = 
        item.endsWith('.png') || 
        item.endsWith('.jpg') || 
        item.endsWith('.jpeg');
      
      if (!isImageFile) {
        // Remove non-image file
        console.log(`Removing non-image file: ${itemPath}`);
        fs.unlinkSync(itemPath);
        stats.removedFiles++;
      }
    }
  }
  
  return stats;
}

/**
 * Main execution
 */
function main() {
  console.log('============================');
  console.log('Screenshot Directory Cleanup');
  console.log('============================');
  console.log(`Base directory: ${SCREENSHOTS_BASE_DIR}`);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(SCREENSHOTS_BASE_DIR)) {
    console.log('Creating screenshots directory...');
    fs.mkdirSync(SCREENSHOTS_BASE_DIR, { recursive: true });
  }
  
  // Clean the screenshots directory
  const stats = cleanDirectory(SCREENSHOTS_BASE_DIR);
  
  // Print summary
  console.log('\n============================');
  console.log('Cleanup Summary:');
  console.log(`Total files processed: ${stats.totalFiles}`);
  console.log(`Directories cleaned: ${stats.cleanedDirs}`);
  console.log(`Non-image files removed: ${stats.removedFiles}`);
  console.log('============================');
}

// Run the script
main();