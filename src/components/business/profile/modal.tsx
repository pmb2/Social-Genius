"use client"

import { useState, useEffect } from "react"
import { X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogTitle, DialogContent, DialogDescription } from "@/components/ui/dialog"
import BusinessProfileEdit from "./edit"

import { useSearchParams } from 'next/navigation'

import { GenerateTab } from "@/components/business/generate-tab"
import { CompetitorResearchTab } from "@/components/business/competitor/research-tab"
import { toast } from "@/lib/ui/toast"
import Image from "next/image"

interface Business {
  id: number;
  businessId: string;
  name: string;
  status: string;
  createdAt: string;
}

export default function BusinessProfileModal({
  business,
  onClose,
  onOpenSettings,
  currentUser
}: {
  business: Business | null;
  onClose: () => void;
  onOpenSettings: (tab: string, highlight?: string) => void;
  currentUser: any; // Define a proper type for user later
}) {
  // Use client-side only rendering to avoid hydration issues
  const [isMounted, setIsMounted] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  // Use the actual business ID if available
  const businessId = business?.id || 1
  // States for delete confirmation
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // State to track the active tab
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || "investigate";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const highlight = searchParams.get('highlight');
    if (highlight) {
      // You can use this highlight value to scroll to a specific element
      // or highlight a section within the active tab.
      // For now, we'll just log it.
      console.log("Highlighting section:", highlight);
    }
  }, [searchParams]);

  useEffect(() => {
    const highlight = searchParams.get('highlight');
    if (highlight) {
      // You can use this highlight value to scroll to a specific element
      // or highlight a section within the active tab.
      // For now, we'll just log it.
      console.log("Highlighting section:", highlight);
    }
  }, [searchParams]);

  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // Function to handle business deletion
  const handleDeleteBusiness = async () => {
    if (!business?.businessId) return
    
    try {
      setIsDeleting(true)
      setDeleteError(null)
      
      const response = await fetch(`/api/businesses?businessId=${business.businessId}`, {
        method: 'DELETE',
        credentials: 'include', // Include cookies for authentication
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete business')
      }
      
      // Clear the API cache by making a cache-busting request
      await fetch('/api/businesses?t=' + new Date().getTime(), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      // Close the delete dialog and the modal
      setIsDeleteDialogOpen(false)
      
      // Show success toast notification
      toast.success(`Business "${business.name}" successfully deleted`)
      
      // Close the modal and trigger the parent's onClose which will refresh the businesses list
      // instead of reloading the entire page
      onClose()
    } catch (error) {
      console.error('Error deleting business:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete business'
      setDeleteError(errorMessage)
      toast.error(`Error: ${errorMessage}`)
    } finally {
      setIsDeleting(false)
    }
  }

  
  // Don't render anything during SSR to avoid hydration mismatch
  if (!isMounted) {
    return (
      <div className="flex flex-col h-full bg-white rounded-xl">
        <div className="px-6 py-4 flex justify-between items-center border-b relative">
          <h2 className="text-lg font-medium">{business ? business.name : 'Business Profile Account'}</h2>
          <div className="flex items-center gap-2 mr-6">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/pencil-dU5dMJDm9paKGUCdBJX5awBEHoRhXl.png"
                alt="Edit"
                className="w-4 h-4 opacity-80"
                width={16}
                height={16}
              />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Trash2 className="w-5 h-5 text-[#FF1681] opacity-80" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full absolute right-2 top-2 bg-white border shadow-md hover:bg-gray-50 z-50"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1"></div>
      </div>
    )
  }

  if (isEditing) {
    return <BusinessProfileEdit business={business} onClose={() => setIsEditing(false)} />
  }

  return (
    <div className="flex flex-col h-full min-h-[700px] max-h-full bg-white rounded-xl">
      <div className="px-6 py-4 flex justify-between items-center border-b relative shrink-0">
        <h2 className="text-lg font-medium">{business ? business.name : 'Business Profile Account'}</h2>
        <div className="flex items-center gap-2 mr-6">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full border-0 bg-white hover:border-2 hover:border-black"
            onClick={() => setIsEditing(true)}
          >
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/pencil-dU5dMJDm9paKGUCdBJX5awBEHoRhXl.png"
              alt="Edit"
              className="w-4 h-4 opacity-80"
              width={16}
              height={16}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full border-0 bg-white hover:border-2 hover:border-[#FF1681]"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="w-5 h-5 text-[#FF1681] opacity-80" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full absolute right-2 top-2 bg-white border shadow-md hover:bg-gray-50 z-50"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Fixed layout structure with content and tab bar - using a single Tabs component */}
      <div className="flex flex-col flex-1 h-[calc(100%-56px)]">
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab} 
          className="h-full flex flex-col"
        >
          {/* Main scrollable content area */}
          <div className="h-[calc(100%-64px)] overflow-hidden flex-1">
            <div className="h-full overflow-y-auto scrollbar-hide">
              <TabsContent 
                value="investigate" 
                className="h-full data-[state=active]:flex data-[state=active]:flex-col"
                forceMount={activeTab === "investigate"}
              >
                <CompetitorResearchTab />
              </TabsContent>

              <TabsContent 
                value="generate" 
                className="h-full data-[state=active]:flex data-[state=active]:flex-col"
                forceMount={activeTab === "generate"}
              >
                <GenerateTab onOpenSettings={(tab, highlight) => {
                  setActiveTab(tab); // Change the tab within the current modal
                  // If highlight needs to be handled, it would be done here or passed further down
                }} userProfilePicture={currentUser?.profilePicture} />
              </TabsContent>
            </div>
          </div>
          
          {/* Fixed position tab bar at bottom */}
          <div className="h-[64px] shrink-0 flex items-center px-2 py-2 border-t mt-auto bg-white">
            <TabsList className="w-full h-12 p-0.5 rounded-5 bg-[url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Rectangle%2059-OqgO1gTt9VhosZRulWgSNvGYu6KkRA.png')] bg-cover">
              <TabsTrigger
                value="investigate"
                className="flex-1 h-full rounded-5 text-black data-[state=active]:bg-white data-[state=active]:text-black data-[state=inactive]:text-black/77"
              >
                Investigate
              </TabsTrigger>
              <TabsTrigger
                value="generate"
                className="flex-1 h-full rounded-5 text-black data-[state=active]:bg-white data-[state=active]:text-black data-[state=inactive]:text-black/77"
              >
                Generate
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-5xl p-6 h-auto max-h-[90vh] w-full overflow-visible" aria-describedby="dialog-description">
          <DialogTitle className="text-xl font-semibold mb-2 text-[#FF1681]">Delete Business</DialogTitle>
          <DialogDescription id="dialog-description" className="text-gray-700 mb-4">
            Are you sure you want to delete <span className="font-semibold">{business?.name}</span>? This action cannot be undone and will remove all associated data.
          </DialogDescription>
          
          {deleteError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {deleteError}
            </div>
          )}
          
          <div className="flex justify-end gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
              className="px-4 py-2"
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteBusiness}
              disabled={isDeleting}
              className="px-4 py-2 bg-[#FF1681] hover:opacity-90 text-white"
            >
              {isDeleting ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-t-2 border-white border-solid rounded-full animate-spin mr-2"></div>
                  Deleting...
                </div>
              ) : (
                'Delete Business'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

