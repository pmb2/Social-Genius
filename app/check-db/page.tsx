'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function CheckDbPage() {
  const [status, setStatus] = useState<any>(null);
  const [envVars, setEnvVars] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initResult, setInitResult] = useState<any>(null);
  
  // Check database status on page load
  useEffect(() => {
    checkDatabaseStatus();
    checkEnvVars();
  }, []);
  
  // Check database status
  const checkDatabaseStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/db-status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Error checking database status:', error);
      setStatus({ error: 'Failed to check database status' });
    } finally {
      setLoading(false);
    }
  };
  
  // Check environment variables
  const checkEnvVars = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/env-check');
      const data = await response.json();
      setEnvVars(data);
    } catch (error) {
      console.error('Error checking environment variables:', error);
      setEnvVars({ error: 'Failed to check environment variables' });
    } finally {
      setLoading(false);
    }
  };
  
  // Initialize database
  const initializeDatabase = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/init-db', { method: 'POST' });
      const data = await response.json();
      setInitResult(data);
      
      // Refresh status after initialization
      await checkDatabaseStatus();
    } catch (error) {
      console.error('Error initializing database:', error);
      setInitResult({ error: 'Failed to initialize database' });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Database Status Check</h1>
      
      <div className="mb-6">
        <div className="flex space-x-3 mb-4">
          <Button onClick={checkDatabaseStatus} disabled={loading}>
            {loading ? 'Checking...' : 'Check Database Status'}
          </Button>
          
          <Button onClick={initializeDatabase} disabled={loading} variant="outline">
            {loading ? 'Initializing...' : 'Initialize Database'}
          </Button>
        </div>
        
        {status && (
          <div className="bg-gray-100 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Database Status</h2>
            <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-auto max-h-60">
              {JSON.stringify(status, null, 2)}
            </pre>
          </div>
        )}
        
        {initResult && (
          <div className="bg-gray-100 p-4 rounded-lg mt-4">
            <h2 className="text-xl font-semibold mb-2">Initialization Result</h2>
            <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-auto max-h-60">
              {JSON.stringify(initResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Environment Variables</h2>
        
        {envVars && (
          <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-auto max-h-60">
            {JSON.stringify(envVars, null, 2)}
          </pre>
        )}
      </div>
      
      <div className="flex space-x-3">
        <Link href="/auth">
          <Button variant="outline">Go to Login</Button>
        </Link>
        
        <Link href="/debug">
          <Button variant="outline">Debug Page</Button>
        </Link>
      </div>
    </div>
  );
}