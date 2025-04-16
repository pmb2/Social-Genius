'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Bell, CheckCircle, Clock, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

type Notification = {
  id: string;
  title: string;
  message: string;
  time: string;
  time_ago: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'alert';
};

type NotificationsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function NotificationsDialog({ open, onOpenChange }: NotificationsDialogProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
  // Fetch notifications when the dialog opens or user changes
  useEffect(() => {
    if (open && user) {
      fetchNotifications();
    }
  }, [open, user, filter]);
  
  const fetchNotifications = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const unreadParam = filter === 'unread' ? '&unread=true' : '';
      const response = await fetch(`/api/notifications?limit=50${unreadParam}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to load notifications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
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
  
  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ markAll: true }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark notifications as read');
      }
      
      // Update local state
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };
  
  const toggleRead = async (id: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationId: id }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to toggle notification read status');
      }
      
      // Update local state
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, read: true } : n
      ));
    } catch (err) {
      console.error('Error toggling notification read status:', err);
    }
  };
  
  const deleteNotification = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }
      
      // Remove the notification from local state
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };
  
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
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">Error Loading Notifications</h3>
              <p className="text-gray-500 text-sm mb-4">{error}</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={fetchNotifications}
              >
                Try Again
              </Button>
            </div>
          ) : notifications.length === 0 ? (
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
              {notifications.map((notification) => (
                <div 
                  key={notification.id}
                  className={cn(
                    "flex p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors",
                    !notification.read && "bg-blue-50/40"
                  )}
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
                        {notification.time_ago}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {notification.message}
                    </p>
                    <div className="flex justify-end mt-2">
                      {!notification.read && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-xs text-blue-600 hover:text-blue-800 px-2"
                          onClick={() => toggleRead(notification.id)}
                        >
                          Mark as read
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs text-red-600 hover:text-red-800 px-2"
                        onClick={() => deleteNotification(notification.id)}
                      >
                        Delete
                      </Button>
                    </div>
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