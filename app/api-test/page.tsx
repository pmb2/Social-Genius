'use client';

import { useState, useEffect } from 'react';

export default function ApiTestPage() {
  const [pingResult, setPingResult] = useState<string>('');
  const [testRegisterResult, setTestRegisterResult] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const testPing = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/ping');
      const text = await response.text();
      console.log('Ping response:', text);
      setPingResult(text);
    } catch (err) {
      console.error('Ping error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const testRegister = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/test-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123'
        })
      });
      const text = await response.text();
      console.log('Test register response:', text);
      setTestRegisterResult(text);
    } catch (err) {
      console.error('Test register error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Test Page</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Ping Test</h2>
        <button 
          onClick={testPing}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded mb-2"
        >
          Test Ping
        </button>
        {pingResult && (
          <pre className="bg-gray-100 p-4 rounded mt-2 overflow-auto">
            {pingResult}
          </pre>
        )}
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Test Register</h2>
        <button 
          onClick={testRegister}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded mb-2"
        >
          Test Register
        </button>
        {testRegisterResult && (
          <pre className="bg-gray-100 p-4 rounded mt-2 overflow-auto">
            {testRegisterResult}
          </pre>
        )}
      </div>
      
      {loading && <p className="text-blue-500">Loading...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
    </div>
  );
}