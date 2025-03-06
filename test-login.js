// Simple script to test the login API endpoint directly
// Using built-in fetch API

async function testLogin() {
  try {
    const response = await fetch('http://localhost:3002/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      }),
    });

    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    console.log('Response body:', text);
    
    try {
      const data = JSON.parse(text);
      console.log('Parsed JSON response:', data);
    } catch (e) {
      console.error('Could not parse response as JSON:', e);
    }
  } catch (error) {
    console.error('Error during login test:', error);
  }
}

testLogin();