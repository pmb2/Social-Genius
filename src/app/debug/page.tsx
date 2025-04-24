'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function DebugPage() {
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [dbInitResult, setDbInitResult] = useState<any>(null);
  const [envInfo, setEnvInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Fetch database status
  const checkDbStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/db-status');
      const data = await response.json();
      setDbStatus(data);
    } catch (error) {
      console.error('Error checking DB status:', error);
      setDbStatus({ status: 'error', message: 'Failed to fetch status' });
    } finally {
      setLoading(false);
    }
  };
  
  // Initialize database
  const initializeDb = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/init-db', { method: 'POST' });
      const data = await response.json();
      setDbInitResult(data);
      // Refresh status after initialization
      await checkDbStatus();
    } catch (error) {
      console.error('Error initializing DB:', error);
      setDbInitResult({ status: 'error', message: 'Failed to initialize database' });
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch environment info
  const checkEnvInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/env-check');
      const data = await response.json();
      setEnvInfo(data);
    } catch (error) {
      console.error('Error checking environment:', error);
      setEnvInfo({ error: 'Failed to fetch environment info' });
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    checkDbStatus();
    checkEnvInfo();
  }, []);
  
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">System Debug</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Database Status</h2>
        <div className="mb-4">
          <Button 
            onClick={checkDbStatus}
            disabled={loading}
            className="mr-4"
          >
            {loading ? 'Checking...' : 'Check Status'}
          </Button>
          
          <Button 
            onClick={initializeDb}
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Initializing...' : 'Initialize Database'}
          </Button>
        </div>
        
        {dbStatus && (
          <div className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-60">
            <pre className="text-sm">
              {JSON.stringify(dbStatus, null, 2)}
            </pre>
          </div>
        )}
        
        {dbInitResult && (
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Initialization Result:</h3>
            <div className={`p-4 rounded-lg ${dbInitResult.success ? 'bg-green-100' : 'bg-red-100'}`}>
              <pre className="text-sm">
                {JSON.stringify(dbInitResult, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Environment</h2>
        <div className="mb-4">
          <Button
            onClick={checkEnvInfo}
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Checking...' : 'Check Environment'}
          </Button>
        </div>
        
        {envInfo && (
          <div className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-60">
            <pre className="text-sm">
              {JSON.stringify(envInfo, null, 2)}
            </pre>
          </div>
        )}
        
        <div className="bg-gray-100 p-4 rounded-lg mt-4">
          <p><strong>DB URL (Client):</strong> {process.env.NEXT_PUBLIC_DATABASE_URL || 'Not set in client'}</p>
          <p><strong>NODE_ENV:</strong> {process.env.NODE_ENV}</p>
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Auth System Test</h2>
        <div className="space-y-4">
          <div>
            <Button
              onClick={() => window.location.href = '/auth'}
              className="mr-4"
            >
              Go to Auth Page
            </Button>
            
            <Button
              onClick={() => window.location.href = '/dashboard'}
              variant="outline"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}