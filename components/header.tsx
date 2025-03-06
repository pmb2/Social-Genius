'use client';

import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export function Header() {
  const router = useRouter();
  
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
    <div className="flex justify-between items-center px-8 py-4 bg-black">
      <h1 className="text-xl text-white">Dashboard</h1>
      
      <div className="flex items-center">
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full p-0 mr-2"
          title="User Profile"
        >
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Mask%20group%20(2)%201-5RMiT8g4J4BzlQiRnu7aemEcs324uL.png"
            alt="Profile"
            className="rounded-full w-10 h-10 object-cover"
            width={40}
            height={40}
            style={{ width: "auto", height: "auto" }}
          />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-gray-800 rounded-full"
          onClick={handleLogout}
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}