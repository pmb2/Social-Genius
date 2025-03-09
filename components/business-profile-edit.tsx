"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { X } from "lucide-react"

interface Business {
  id: number;
  businessId: string;
  name: string;
  status: string;
  createdAt: string;
}

interface BusinessProfileEditProps {
  business: Business | null;
  onClose: () => void;
}

export default function BusinessProfileEdit({ business, onClose }: BusinessProfileEditProps) {
  // Use client-side only rendering to avoid hydration issues
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission
    onClose()
  }

  if (!isMounted) {
    return null // Return nothing during server-side rendering
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl">
      <div className="px-6 py-4 flex justify-between items-center border-b relative">
        <h2 className="text-lg font-medium">Edit Business Profile</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full absolute -right-3 -top-3 bg-white border shadow-md hover:bg-gray-50 z-50 translate-x-1/2 -translate-y-1/2"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Business Details Section */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Business Details</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input id="businessName" placeholder="Enter business name" defaultValue={business?.name || "Business Profile Account"} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" placeholder="https://example.com" type="url" defaultValue="https://example.com" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" placeholder="Enter business address" defaultValue="123 Business St" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" placeholder="City" defaultValue="San Francisco" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" placeholder="State" defaultValue="CA" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input id="zipCode" placeholder="ZIP Code" defaultValue="94105" />
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Contact Information</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" placeholder="(123) 456-7890" type="tel" defaultValue="(415) 555-1234" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    placeholder="contact@business.com"
                    type="email"
                    defaultValue="contact@business.com"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Business Hours */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Business Hours</h3>

            <div className="grid grid-cols-2 gap-4">
              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                <div key={day} className="flex items-center gap-4">
                  <div className="w-24">
                    <Label>{day}</Label>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <Input placeholder="9:00 AM" className="w-24" defaultValue="9:00 AM" />
                    <span className="text-gray-500">to</span>
                    <Input placeholder="5:00 PM" className="w-24" defaultValue="5:00 PM" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Business Description</h3>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter a description of your business..."
                className="min-h-[100px]"
                defaultValue="We are a professional business providing high-quality services to our customers."
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="border-t p-6 bg-gray-50 flex justify-center gap-4">
          <Button
            type="button"
            variant="outline"
            className="px-8 h-[56px] border-2 border-black text-black hover:bg-gray-50 rounded-full text-base font-medium shrink-0"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="px-8 h-[56px] bg-gradient-to-b from-[#FFAB1A] to-[#FF1681] hover:opacity-90 text-white rounded-full text-base font-medium shrink-0"
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  )
}

