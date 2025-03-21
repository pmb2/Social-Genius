'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogClose, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';
import { LogOut, User, Settings, Bell, HelpCircle, X } from 'lucide-react';
import FeedbackModal from './feedback-modal';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export function Header() {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState("feedback");
  
  // Use our custom auth context
  const { user, logout } = useAuth();
  
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
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full p-0 h-auto w-auto hover:scale-105 transition-transform"
            title={user?.email || "User"}
            onClick={() => setSettingsOpen(true)}
          >
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Mask%20group%20(2)%201-5RMiT8g4J4BzlQiRnu7aemEcs324uL.png"
              alt="Profile"
              className="rounded-full w-12 h-12 object-cover border-2 border-white/40"
              width={48}
              height={48}
              style={{ width: "48px", height: "48px" }}
              priority
            />
          </Button>
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
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Mask%20group%20(2)%201-5RMiT8g4J4BzlQiRnu7aemEcs324uL.png"
                  alt="Profile"
                  className="rounded-full w-16 h-16 object-cover mr-3"
                  width={64}
                  height={64}
                  style={{ width: "64px", height: "64px" }}
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
                >
                  <Settings className="h-4 w-4 mr-3" />
                  Account Settings
                </Button>
                
                <Button
                  variant="ghost"
                  className="w-full justify-start px-3 py-2 h-10 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                >
                  <Bell className="h-4 w-4 mr-3" />
                  Notifications
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
    </>
  );
}