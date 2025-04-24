'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, Settings } from 'lucide-react';

export default function NotificationSettingsTile() {
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow duration-300">
      <div className="flex items-start space-x-4">
        <div className="bg-gradient-to-r from-orange-500 to-pink-600 p-3 rounded-lg">
          <Bell className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-medium">Notification Settings</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Control when and how you receive notifications
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2 w-full flex items-center justify-center"
          >
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>
    </Card>
  );
}