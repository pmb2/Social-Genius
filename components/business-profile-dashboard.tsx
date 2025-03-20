"use client"

import { useState, useEffect, useMemo, useCallback, Suspense } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ProgressCircle } from "./progress-circle"
import { StatusIndicator } from "./status-indicator"
// Import specific icons instead of the whole library to reduce bundle size
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import MailIcon from "lucide-react/dist/esm/icons/mail"
import Building2Icon from "lucide-react/dist/esm/icons/building-2"
import Image from "next/image"
import dynamic from "next/dynamic"

// Dynamically import heavy components to reduce initial load time
const BusinessProfileModal = dynamic(() => import("./business-profile-modal"), {
  loading: () => <div className="animate-pulse bg-gray-200 w-full h-full rounded-xl"></div>,
  ssr: false
})

// Will be populated from API
const initialBusinessAccounts: Business[] = []

// Define Business type
type Business = {
  id: number;
  businessId: string;
  name: string;
  status: string;
  createdAt: string;
}

export function BusinessProfileDashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isAddBusinessModalOpen, setIsAddBusinessModalOpen] = useState(false)
  const [businessName, setBusinessName] = useState("")
  const [businessEmail, setBusinessEmail] = useState("")
  const [businessType, setBusinessType] = useState("google") // "google" or "invite"
  const [businesses, setBusinesses] = useState<Business[]>(initialBusinessAccounts)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null)
  
  // Fetch businesses on component mount
  useEffect(() => {
    fetchBusinesses();
  }, []);
  
  // Function to fetch businesses from API
  const fetchBusinesses = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Fetching businesses for current user...');
      
      // Add cache-busting parameter and cache control
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/businesses?t=${timestamp}`, {
        method: 'GET',
        credentials: 'include', // Include cookies for authentication
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        console.error(`Error response from businesses API: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch businesses: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Fetched ${data.businesses?.length || 0} businesses from API`);
      
      if (data.businesses) {
        // Sort businesses by creation date (newest first)
        const sortedBusinesses = [...data.businesses].sort((a, b) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        setBusinesses(sortedBusinesses);
      } else {
        setBusinesses([]);
      }
    } catch (err) {
      console.error('Error fetching businesses:', err);
      setError('Failed to load businesses. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAddBusiness = async () => {
    try {
      console.log(`Adding new business: "${businessName}" (type: ${businessType})`);
      
      if (!businessName.trim()) {
        alert('Please enter a business name');
        return;
      }
      
      if (businessType === "invite" && !businessEmail.trim()) {
        alert('Please enter a business email');
        return;
      }
      
      // Call the API to add the business
      const response = await fetch('/api/businesses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          name: businessName.trim(),
          type: businessType,
          email: businessType === "invite" ? businessEmail.trim() : undefined
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add business');
      }
      
      console.log(`Business added successfully: ${data.businessId}`);
      
      // Reset form and close modal
      setBusinessName("");
      setBusinessEmail("");
      setIsAddBusinessModalOpen(false);
      
      // Refresh the business list with a slight delay to ensure server processes are complete
      setTimeout(() => {
        fetchBusinesses();
      }, 300);
    } catch (err) {
      console.error('Error adding business:', err);
      alert(`Failed to add business: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Memoize filtered business counts to prevent recalculation on each render
  const businessCounts = useMemo(() => {
    const noncompliantCount = businesses.filter(b => b.status === 'noncompliant').length;
    const compliantCount = businesses.filter(b => b.status === 'compliant').length;
    const activeCount = businesses.filter(b => b.status === 'active').length;
    const completionRate = businesses.length > 0 
      ? Math.round((compliantCount / businesses.length) * 100) 
      : 0;
    
    return {
      noncompliantCount,
      compliantCount,
      activeCount,
      completionRate
    };
  }, [businesses]);
  
  // Memoize event handlers
  const handleRowClick = useCallback((business: Business) => {
    setSelectedBusiness(business);
    setIsModalOpen(true);
  }, []);
  
  const handleClose = useCallback(() => {
    setIsModalOpen(false);
  }, []);
  
  const handleAddBusinessClick = useCallback(() => {
    setIsAddBusinessModalOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      {/* Header - moved to Header component */}
      <div className="hidden">
        {/* Keep this div to prevent layout shifts during refactoring */}
      </div>

      <div className="w-full max-w-[1200px] h-auto min-h-[600px] mx-auto bg-white rounded-2xl shadow-sm">
        <div className="p-8">
          {/* Stats Section */}
          <div className="flex items-center justify-between mb-10 min-w-[600px]">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Group%20362-rvrX4OJ5ZH5Nbk05Br5thefaRKSJih.png"
                alt="Brand Logo"
                width={220}
                height={120}
                priority={true}
                quality={80}
              />
            </div>

            {/* Stats */}
            <div className="text-center">
              <div className="text-7xl font-bold text-black mb-[14px]">
                {businessCounts.noncompliantCount}
              </div>
              <div className="flex justify-center">
                <StatusIndicator status="noncompliant" />
              </div>
              <div className="text-sm text-gray-600 mt-[26px]">Noncompliant</div>
            </div>

            <div className="text-center">
              <div className="text-7xl font-bold text-black mb-[14px]">
                {businessCounts.compliantCount}
              </div>
              <div className="flex justify-center">
                <StatusIndicator status="compliant" />
              </div>
              <div className="text-sm text-gray-600 mt-[26px]">Compliant</div>
            </div>

            <div className="text-center">
              <div className="text-7xl font-bold text-black mb-[14px]">
                {businessCounts.activeCount}
              </div>
              <div className="flex justify-center">
                <StatusIndicator status="active" />
              </div>
              <div className="text-sm text-gray-600 mt-[26px]">Active</div>
            </div>

            {/* Progress Circle */}
            <div className="flex-shrink-0">
              <div className="flex flex-col items-center">
                <ProgressCircle value={businessCounts.completionRate} />
                <span className="text-sm mt-2rem text-gray-600">Completion Rate</span>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg overflow-hidden border border-gray-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-black hover:bg-black">
                  <TableHead className="text-white font-normal text-base py-4">
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 rounded-full bg-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddBusinessClick();
                        }}
                      >
                        <PlusIcon className="h-4 w-4 text-black" />
                      </Button>
                      <span>Account Name</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-white font-normal text-base text-right py-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : error || businesses.length === 0 ? (
                  <TableRow className="cursor-pointer hover:bg-gray-50" onClick={handleAddBusinessClick}>
                    <TableCell colSpan={2} className="text-center py-10">
                      <div className="flex flex-col items-center">
                        <div className="bg-gradient-to-r from-[#FFAB1A] via-[#FF1681] to-[#0080FF] p-[2px] rounded-lg mb-4">
                          <div className="bg-white px-8 py-4 rounded-lg">
                            <h3 className="text-xl font-semibold bg-gradient-to-r from-[#FFAB1A] via-[#FF1681] to-[#0080FF] inline-block text-transparent bg-clip-text">
                              Let's get started!
                            </h3>
                          </div>
                        </div>
                        <div className="flex items-center justify-center space-x-1">
                          <span className="text-gray-500 font-medium">Add your first business</span>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  // Render businesses with a virtualized approach for better performance
                  businesses.slice(0, 10).map((business) => (
                    <TableRow
                      key={business.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleRowClick(business)}
                    >
                      <TableCell className="text-black py-4">{business.name}</TableCell>
                      <TableCell className="text-right py-4 pr-8">
                        <div className="flex justify-end">
                          <StatusIndicator status={business.status} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                  // Show "Load more" button if there are more than 10 businesses
                  )}
                  {businesses.length > 10 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-4">
                        <Button 
                          variant="ghost" 
                          className="text-sm text-gray-500 hover:text-black"
                          onClick={() => console.log("Load more businesses")}
                        >
                          Load more ({businesses.length - 10} remaining)
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* No floating add button - using the one in the table header instead */}

      {/* Business Profile Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open);
        // Refresh businesses list when modal is closed to reflect any changes
        if (!open) {
          fetchBusinesses();
        }
      }}>
        <DialogContent className="p-0 max-w-[1200px] w-[95vw] h-[95vh] max-h-[980px]" aria-describedby="profile-modal-description">
          <DialogTitle className="sr-only">Business Profile Details</DialogTitle>
          <div id="profile-modal-description" className="sr-only">
            Business profile details and management interface
          </div>
          <BusinessProfileModal business={selectedBusiness} onClose={() => {
            handleClose();
            // Also refresh businesses when modal is closed via the close button
            fetchBusinesses();
          }} />
        </DialogContent>
      </Dialog>
      
      {/* Add Business Modal - Enhanced Version */}
      <Dialog open={isAddBusinessModalOpen} onOpenChange={setIsAddBusinessModalOpen}>
        <DialogContent className="max-w-sm p-6 max-h-[90vh]" aria-describedby="add-business-description">
          <DialogTitle className="text-xl font-semibold mb-2">Add Business</DialogTitle>
          <DialogDescription id="add-business-description">
            Add a new business to manage through Social Genius.
          </DialogDescription>
          
          <div className="py-4 space-y-4">
            {/* Option Selection */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Select an option:</h3>
              <div className="grid grid-cols-1 gap-3">
                {/* Google Business Profile Option */}
                <div 
                  className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${businessType === 'google' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50/50'}`}
                  onClick={() => setBusinessType('google')}
                >
                  <div className="h-4 w-4 rounded-full border border-gray-300 flex items-center justify-center flex-shrink-0">
                    {businessType === 'google' && (
                      <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <Building2Icon className="h-5 w-5 text-blue-600" />
                    <div>
                      <div>Google Business Profile</div>
                      <div className="text-xs text-gray-500">Connect an existing Google Business Profile</div>
                    </div>
                  </div>
                </div>

                {/* Invitation Option */}
                <div 
                  className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${businessType === 'invite' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50/50'}`}
                  onClick={() => setBusinessType('invite')}
                >
                  <div className="h-4 w-4 rounded-full border border-gray-300 flex items-center justify-center flex-shrink-0">
                    {businessType === 'invite' && (
                      <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <MailIcon className="h-5 w-5 text-blue-600" />
                    <div>
                      <div>Send Invitation Email</div>
                      <div className="text-xs text-gray-500">Invite a client to add their business</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Business Name Field */}
            <div className="space-y-2">
              <label htmlFor="business-name" className="block text-sm font-medium">
                Business Name
              </label>
              <input 
                id="business-name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Enter business name"
              />
            </div>
            
            {/* Email Field - Only shown for invitation option */}
            {businessType === 'invite' && (
              <div className="space-y-2">
                <label htmlFor="business-email" className="block text-sm font-medium">
                  Business Email
                </label>
                <input 
                  id="business-email"
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  placeholder="Enter contact email"
                />
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setIsAddBusinessModalOpen(false)}
              className="px-4 py-2"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddBusiness}
              disabled={!businessName || (businessType === 'invite' && !businessEmail)}
              className="px-4 py-2 bg-gradient-to-r from-[#FFAB1A] via-[#FF1681] to-[#0080FF] text-white hover:opacity-90"
            >
              Add Business
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default BusinessProfileDashboard