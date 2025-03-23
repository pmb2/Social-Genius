'use client';

import { useEffect } from 'react';

export default function InitDbScript() {
  useEffect(() => {
    const initDb = async () => {
      if (typeof window === 'undefined') return;
      
      try {
        console.log('Initializing database connection...');
        const response = await fetch('/api/init-db', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          console.log('Database initialized successfully');
        } else {
          console.error('Failed to initialize database');
        }
      } catch (error) {
        console.error('Error initializing database:', error);
      }
    };
    
    initDb();
  }, []);
  
  return null;
}