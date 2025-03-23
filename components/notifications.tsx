'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Bell, CheckCircle, Clock, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Notification = {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'alert';
};

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    title: 'New feature available',
    message: 'Try our new competitor research tool! Get insights about your competitors with a few clicks.',
    time: '2 hours ago',
    read: false,
    type: 'info'
  },
  {
    id: '2',
    title: 'Content analysis complete',
    message: 'Your latest post analysis is ready. The engagement score is 87/100.',
    time: 'Yesterday',
    read: false,
    type: 'success'
  },
  {
    id: '3',
    title: 'Subscription renewal',
    message: 'Your subscription will renew in 7 days. Please check your payment method.',
    time: '3 days ago',
    read: true,
    type: 'warning'
  },
  {
    id: '4',
    title: 'System maintenance',
    message: 'There will be scheduled maintenance on June 15th from 2am to 4am UTC.',
    time: '1 week ago',
    read: true,
    type: 'alert'
  }
];

type NotificationsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function NotificationsDialog({ open, onOpenChange }: NotificationsDialogProps) {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'alert':
        return <Clock className="h-5 w-5 text-red-500" />;
    }
  };
  
  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };
  
  const toggleRead = (id: string) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: !n.read } : n
    ));
  };
  
  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => !n.read);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-hidden p-0">
        <DialogHeader className="p-4 border-b sticky top-0 bg-white z-10">
          <div className="flex justify-between items-center">
            <DialogTitle className="flex items-center">
              <Bell className="mr-2 h-5 w-5" />
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
          <div className="flex justify-between items-center mt-2">
            <div className="flex space-x-2">
              <Button 
                variant={filter === 'all' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setFilter('all')}
                className="text-xs h-8"
              >
                All
              </Button>
              <Button 
                variant={filter === 'unread' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setFilter('unread')}
                className="text-xs h-8"
              >
                Unread
              </Button>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="text-xs h-8"
              disabled={unreadCount === 0}
            >
              Mark all as read
            </Button>
          </div>
        </DialogHeader>
        
        <div className="overflow-y-auto max-h-[calc(85vh-115px)]">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <Bell className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No notifications</h3>
              <p className="text-gray-500 text-sm">
                {filter === 'unread' 
                  ? "You've read all your notifications"
                  : "You don't have any notifications yet"}
              </p>
            </div>
          ) : (
            <div className="p-0">
              {filteredNotifications.map((notification) => (
                <div 
                  key={notification.id}
                  className={cn(
                    "flex p-4 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors",
                    !notification.read && "bg-blue-50/40"
                  )}
                  onClick={() => toggleRead(notification.id)}
                >
                  <div className="mr-3 mt-1">
                    {getTypeIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <h4 className={cn(
                        "text-sm font-medium",
                        !notification.read && "font-semibold"
                      )}>
                        {notification.title}
                      </h4>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {notification.time}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {notification.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}