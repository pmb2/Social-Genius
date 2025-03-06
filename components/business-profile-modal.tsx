"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import BusinessProfileEdit from "./business-profile-edit"
import { ComplianceTab } from "./compliance-tab"
import { BrandAlignmentTab } from "./brand-alignment-tab"
import { CompetitorResearchTab } from "./competitor-research-tab"
import Image from "next/image"

export default function BusinessProfileModal({ onClose }: { onClose: () => void }) {
  // Use client-side only rendering to avoid hydration issues
  const [isMounted, setIsMounted] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [businessId] = useState(1) // Mock business ID

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Don't render anything during SSR to avoid hydration mismatch
  if (!isMounted) {
    return (
      <div className="flex flex-col h-full bg-white rounded-xl">
        <div className="px-6 py-4 flex justify-between items-center border-b relative">
          <h2 className="text-lg font-medium">Business Profile Account</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8">
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
            className="h-8 w-8 rounded-full absolute -right-3 -top-3 bg-white border shadow-md hover:bg-gray-50 z-50 translate-x-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1"></div>
      </div>
    )
  }

  if (isEditing) {
    return <BusinessProfileEdit onClose={() => setIsEditing(false)} />
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl">
      <div className="px-6 py-4 flex justify-between items-center border-b relative">
        <h2 className="text-lg font-medium">Business Profile Account</h2>
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
          className="h-8 w-8 rounded-full absolute -right-3 -top-3 bg-white border shadow-md hover:bg-gray-50 z-50 translate-x-1/2 -translate-y-1/2"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="compliance" className="flex flex-col flex-1">
        <div className="flex-1 overflow-auto">
          <TabsContent value="compliance">
            <ComplianceTab businessId={businessId} />
          </TabsContent>

          <TabsContent value="brand">
            <BrandAlignmentTab />
          </TabsContent>

          <TabsContent value="competitor">
            <CompetitorResearchTab />
          </TabsContent>
        </div>

        <div className="mt-auto">
          <TabsList className="w-full h-12 p-0.5 rounded-5 bg-[url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Rectangle%2059-OqgO1gTt9VhosZRulWgSNvGYu6KkRA.png')] bg-cover">
            <TabsTrigger
              value="compliance"
              className="flex-1 h-full rounded-5 text-black data-[state=active]:bg-white data-[state=active]:text-black data-[state=inactive]:text-black/77"
            >
              Compliance
            </TabsTrigger>
            <TabsTrigger
              value="brand"
              className="flex-1 h-full rounded-5 text-black data-[state=active]:bg-white data-[state=active]:text-black data-[state=inactive]:text-black/77"
            >
              Brand Alignment
            </TabsTrigger>
            <TabsTrigger
              value="competitor"
              className="flex-1 h-full rounded-5 text-black data-[state=active]:bg-white data-[state=active]:text-black data-[state=inactive]:text-black/77"
            >
              Competitor Research
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>
    </div>
  )
}

