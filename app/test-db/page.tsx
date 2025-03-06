'use client';

import { useEffect, useState } from 'react';

export default function TestDbPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function testDb() {
      try {
        setLoading(true);
        
        const response = await fetch('/api/test-db');
        const data = await response.json();
        
        setResult(data);
        
        if (!response.ok) {
          setError(data.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    
    testDb();
  }, []);
  
  // Also test the initialization endpoint
  const initializeDb = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/init-db', {
        method: 'POST',
      });
      const data = await response.json();
      
      setResult(data);
      
      if (!response.ok) {
        setError(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Database Connection Test</h1>
      
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Error:</strong> {error}
        </div>
      ) : (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <strong>Success:</strong> {JSON.stringify(result)}
        </div>
      )}
      
      <div className="mt-4">
        <button 
          onClick={initializeDb}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          disabled={loading}
        >
          Initialize Database
        </button>
      </div>
    </div>
  );
}