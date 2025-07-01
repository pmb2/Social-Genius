#!/usr/bin/env node
// Test script to verify authentication API is working

import fetch from 'node-fetch';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Convert to hash using browser-compatible method
async function hashPassword(password) {
  // Simple hash for testing - this is NOT secure for production
  // But matches what our browser will send
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function testAuth() {
  try {
    console.log('Checking if auth API is available...');
    
    // Test login endpoint
    const loginEndpoint = 'http://localhost:3001/api/auth/login';
    
    // Check if API is reachable
    try {
      const response = await fetch(loginEndpoint, {
        method: 'HEAD'
      });
      
      if (response.ok) {
        console.log('✅ Auth API endpoint is reachable');
      } else {
        console.log(`❌ Auth API returned status ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Error connecting to auth API:', error.message);
      console.log('Make sure the app is running on port 3001');
      process.exit(1);
    }
    
    // Test login with test credentials
    console.log('Testing login with test@example.com / password123...');
    
    const loginResponse = await fetch(loginEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });
    
    const loginData = await loginResponse.json();
    
    if (loginResponse.ok) {
      console.log('✅ Login successful!');
      console.log('User data:', JSON.stringify(loginData, null, 2));
      
      // Check if session cookies were set
      if (loginResponse.headers.get('set-cookie')) {
        console.log('✅ Session cookies were set properly');
      } else {
        console.log('❌ No session cookies were set');
      }
    } else {
      console.log('❌ Login failed:', loginData.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('Error testing auth:', error);
  } finally {
    rl.close();
  }
}

testAuth();