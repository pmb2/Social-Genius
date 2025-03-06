// Simple script to test the register API endpoint directly
// Using built-in fetch API

async function testRegister() {
  try {
    // Create a unique email to avoid conflicts
    const randomId = Math.floor(Math.random() * 10000);
    const email = `test${randomId}@example.com`;
    
    console.log(`Testing registration with email: ${email}`);
    
    const response = await fetch('http://localhost:3003/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        password: 'password123',
        name: `Test User ${randomId}`
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
    console.error('Error during registration test:', error);
  }
}

testRegister();