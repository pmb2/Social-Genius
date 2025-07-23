'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogClose, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Image from 'next/image';
import { LogOut, User, Settings, Bell, HelpCircle, X, Building2 } from 'lucide-react';
import FeedbackModal from '@/components/ui/feedback/modal';
import NotificationsDialog from '@/components/notifications/index';
import ProfileSettingsTile from '@/components/user/profile-settings-tile';
import { SubscriptionPlansModal } from '@/components/subscription/subscription-plans-modal';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { subscriptionPlans } from '@/services/subscription/plans';
import { useStableModal } from '@/lib/ui/modal/use-stable-modal';

interface HeaderProps {
  businessCount?: number;
}

export function Header({ businessCount = 0 }: HeaderProps) {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);
  // Use our stable modal hook for subscription modal
  const subscriptionModal = useStableModal(false);
  const [feedbackType, setFeedbackType] = useState("feedback");
  const [notificationCount, setNotificationCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  
  // Use our custom auth context
  const { user, logout } = useAuth();
  
  // Get user's subscription plan
  const userSubscription = user?.subscription || 'basic';
  const currentPlan = subscriptionPlans.find(plan => plan.id === userSubscription) || subscriptionPlans[0];
  const locationLimit = currentPlan.businessLimit;
  
  // Function to fetch notification count from API
  const fetchNotificationCount = useCallback(async () => {
    if (!user) return;
    
    // Avoid state update if we're already loading
    if (!isLoadingNotifications) {
      setIsLoadingNotifications(true);
    }
    
    try {
      console.log('Client-side document.cookie before fetching notification count:', document.cookie);
      const response = await fetch('/api/notifications/count', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'X-Notification-Check': 'true',
        },
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        // Only update if count has changed to avoid unnecessary re-renders
        if (data.unreadCount !== notificationCount) {
          setNotificationCount(data.unreadCount || 0);
        }
      }
    } catch (error) {
      console.error('Error fetching notification count:', error);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [user, notificationCount, isLoadingNotifications]);

  // Fetch notification count when user is authenticated
  useEffect(() => {
    if (user) {
      fetchNotificationCount();
      
      // Set up a timer to periodically refresh notification count
      // Using a longer interval to reduce refresh frequency and potential disruptions
      const timer = setInterval(() => {
        // Don't refresh if a modal is open, as this could disrupt user experience
        if (typeof window !== 'undefined' && !window.__modalOpen) {
          fetchNotificationCount();
        }
      }, 10 * 60000); // Check every 10 minutes to further reduce refresh frequency
      
      return () => {
        clearInterval(timer);
      };
    }
  }, [user, fetchNotificationCount]);
    
  
  // Function to handle notification clicks and mark them as read
  const handleOpenNotifications = () => {
    setNotificationsOpen(true);
  };
  
  // Handle notification dialog close event to refresh notification count
  const handleNotificationsOpenChange = (open: boolean) => {
    setNotificationsOpen(open);
    if (!open) {
      // Refresh notification count when notification dialog closes
      setTimeout(() => {
        fetchNotificationCount();
      }, 500);
    }
  };
  
  const handleLogout = async () => {
    try {
      await logout();
      router.push('/auth');
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect to auth page even if logout fails
      router.push('/auth');
    }
  };
  
  return (
    <>
      <div className="flex justify-between items-center px-8 py-4 bg-black">
        <h1 className="text-xl text-white">Dashboard</h1>
        
        <div className="flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full p-0 h-auto w-auto hover:scale-105 transition-transform relative z-10"
                title={user?.email || "User"}
              >
                {/* Notification indicator on avatar */}
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-blue-500 rounded-full z-10 border-2 border-black flex items-center justify-center text-[10px] font-bold text-white">
                    {notificationCount}
                  </span>
                )}
                <Image
                  src={user?.profilePicture || "/default-avatar.png"}
                  alt="Profile"
                  className="rounded-full w-12 h-12 object-cover border-2 border-white/40 z-10"
                  width={48}
                  height={48}
                  style={{ 
                    width: "48px", 
                    height: "48px",
                    display: "block", // Ensure it's displayed as a block
                    opacity: 1, // Ensure it's fully visible
                    visibility: "visible" // Ensure it's visible
                  }}
                  priority
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center p-2 mb-1">
                <Image
                  src={user?.profilePicture || "/default-avatar.png"}
                  alt="Profile"
                  className="rounded-full w-8 h-8 object-cover mr-2 z-10"
                  width={32}
                  height={32}
                  style={{ 
                    display: "block", // Ensure it's displayed as a block
                    opacity: 1, // Ensure it's fully visible
                    visibility: "visible" // Ensure it's visible
                  }}
                />
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{user?.name || user?.email || "User"}</span>
                  <span className="text-xs text-gray-500 truncate">{user?.email || ""}</span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setProfileSettingsOpen(true)}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => {
                  // Force close the dropdown menu
                  const closeEvent = new Event('mousedown', { bubbles: true });
                  void document.dispatchEvent(closeEvent);
                  
                  // Open subscription modal using stable hook after a short delay
                  setTimeout(() => {
                    subscriptionModal.open();
                  }, 100);
                }}>
                <Building2 className="mr-2 h-4 w-4" />
                <div className="flex justify-between w-full">
                  <span>Locations</span>
                  <span className="text-xs font-medium bg-clip-text text-transparent bg-gradient-to-r from-[#FFAB1A] via-[#FF1681] to-[#0080FF]">
                    {businessCount} / {locationLimit === 9999 ? '∞' : locationLimit}
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleOpenNotifications} className="relative">
                <Bell className="mr-2 h-4 w-4" />
                <span>Notifications</span>
                {notificationCount > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-blue-500 rounded-full">
                    {notificationCount}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setFeedbackType("feedback");
                setFeedbackOpen(true);
              }}>
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>Help & Support</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-sm p-0 overflow-visible h-auto mx-auto" aria-describedby="settings-modal-description">
          <DialogTitle className="sr-only">User Settings</DialogTitle>
          <div id="settings-modal-description" className="sr-only">
            User settings and account management options
          </div>
          <div className="flex flex-col bg-white rounded-xl">
            <div className="px-6 py-4 flex justify-between items-center border-b relative">
              <h2 className="text-lg font-medium">Settings</h2>
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full absolute right-2 top-2 bg-white border shadow-md hover:bg-gray-50 z-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>
            
            <div className="p-4">
              {/* User Profile Section */}
              <div className="flex items-center p-3 mb-4 bg-gray-50 rounded-lg">
                <Image
                  src={user?.profilePicture || "/default-avatar.png"}
                  alt="Profile"
                  className="rounded-full w-16 h-16 object-cover mr-3 z-10"
                  width={64}
                  height={64}
                  style={{ 
                    width: "64px", 
                    height: "64px",
                    display: "block", 
                    opacity: 1, 
                    visibility: "visible" 
                  }}
                />
                <div>
                  <p className="font-medium">{user?.name || "User"}</p>
                  <p className="text-sm text-gray-600">{user?.email || ""}</p>
                </div>
              </div>
              
              {/* Menu Items */}
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start px-3 py-2 h-10 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  onClick={() => {
                    setSettingsOpen(false);
                    setTimeout(() => setProfileSettingsOpen(true), 100); // Slight delay to avoid animation conflicts
                  }}
                >
                  <User className="h-4 w-4 mr-3" />
                  Profile Settings
                </Button>
                
                <Button
                  variant="ghost"
                  className="w-full justify-start px-3 py-2 h-10 text-gray-700 hover:bg-gray-100 hover:text-gray-900 relative"
                  onClick={() => {
                    setSettingsOpen(false);
                    setTimeout(() => handleOpenNotifications(), 100); // Slight delay to avoid animation conflicts
                  }}
                >
                  <Bell className="h-4 w-4 mr-3" />
                  Notifications
                  {notificationCount > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-blue-500 rounded-full">
                      {notificationCount}
                    </span>
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  className="w-full justify-start px-3 py-2 h-10 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  onClick={() => {
                    setSettingsOpen(false);
                    setFeedbackType("feedback");
                    setTimeout(() => setFeedbackOpen(true), 100); // Slight delay to avoid animation conflicts
                  }}
                >
                  <HelpCircle className="h-4 w-4 mr-3" />
                  Help & Support
                </Button>
                
                <div className="pt-2 mt-2 border-t">
                  <Button
                    variant="ghost"
                    className="w-full justify-start px-3 py-2 h-10 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback Modal */}
      <FeedbackModal 
        open={feedbackOpen} 
        onOpenChange={setFeedbackOpen} 
        defaultType={feedbackType} 
      />

      {/* Notifications Modal */}
      <NotificationsDialog
        open={notificationsOpen}
        onOpenChange={handleNotificationsOpenChange}
      />

      {/* Profile Settings Modal */}
      <Dialog 
        open={profileSettingsOpen} 
        onOpenChange={(open) => {
          // On close, ensure we clean up any lingering event handlers
          if (!open) {
            setTimeout(() => {
              const event = new Event('mousedown', { bubbles: true });
              document.dispatchEvent(event);
            }, 50);
          }
          setProfileSettingsOpen(open);
        }}
      >
        <DialogContent className="max-w-3xl p-0 overflow-auto">
          <DialogTitle className="sr-only">Profile Settings</DialogTitle>
          <div className="p-6">
            <ProfileSettingsTile 
              isStandalone={true} 
              onClose={() => {
                setProfileSettingsOpen(false);
                // Force cleanup of events
                setTimeout(() => {
                  const event = new Event('mousedown', { bubbles: true });
                  document.dispatchEvent(event);
                }, 50);
              }} 
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Subscription Plans Modal */}
      <SubscriptionPlansModal
        isOpen={subscriptionModal.isOpen}
        onClose={() => {
          // Close without delay to prevent UI glitches
          subscriptionModal.close();
          
          // Force the DOM to clean up any stuck elements
          if (typeof document !== 'undefined') {
            setTimeout(() => {
              document.body.style.pointerEvents = '';
              document.body.style.overflow = '';
              
              // Force redraw
              void document.body.offsetHeight;
            }, 0);
          }
        }}
        currentPlan={userSubscription}
        locationsUsed={businessCount}
        locationsLimit={locationLimit}
      />
    </>
  );
}