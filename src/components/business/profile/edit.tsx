"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { X } from "lucide-react"
import { toast } from "@/lib/ui/toast"
import { useAuth } from "@/lib/auth/context"

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

interface BusinessData {
  name: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  description: string;
}

export default function BusinessProfileEdit({ business, onClose }: BusinessProfileEditProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [formData, setFormData] = useState<BusinessData>({
    name: business?.name || "",
    website: "https://example.com", // Placeholder, replace with actual data if available
    address: "123 Business St", // Placeholder
    city: "San Francisco", // Placeholder
    state: "CA", // Placeholder
    zipCode: "94105", // Placeholder
    phone: "(415) 555-1234", // Placeholder
    email: "contact@business.com", // Placeholder
    description: "We are a professional business providing high-quality services to our customers.", // Placeholder
  });

  useEffect(() => {
    setIsMounted(true);
    if (business) {
      setFormData({
        name: business.name || "",
        website: business.website || "",
        address: business.address || "",
        city: business.city || "",
        state: business.state || "",
        zipCode: business.zipCode || "",
        phone: business.phone || "",
        email: business.email || "",
        description: business.description || "",
      });
    }
  }, [business]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [id]: value,
    }));
  };

  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !user) return;

    const updatedFields: Partial<BusinessData> = {};
    if (formData.name !== (business.name || "")) {
      updatedFields.name = formData.name;
    }
    if (formData.website !== (business.website || "")) {
      updatedFields.website = formData.website;
    }
    if (formData.address !== (business.address || "")) {
      updatedFields.address = formData.address;
    }
    if (formData.city !== (business.city || "")) {
      updatedFields.city = formData.city;
    }
    if (formData.state !== (business.state || "")) {
      updatedFields.state = formData.state;
    }
    if (formData.zipCode !== (business.zipCode || "")) {
      updatedFields.zipCode = formData.zipCode;
    }
    if (formData.phone !== (business.phone || "")) {
      updatedFields.phone = formData.phone;
    }
    if (formData.email !== (business.email || "")) {
      updatedFields.email = formData.email;
    }
    if (formData.description !== (business.description || "")) {
      updatedFields.description = formData.description;
    }

    if (Object.keys(updatedFields).length === 0) {
      toast.info("No changes to save.");
      onClose();
      return;
    }

    try {
      // Update user profile if name or email changed
      if (updatedFields.name || updatedFields.email) {
        const userUpdates: { name?: string, email?: string } = {};
        if (updatedFields.name) userUpdates.name = updatedFields.name;
        if (updatedFields.email) userUpdates.email = updatedFields.email;

        const userUpdateSuccess = await updateUser(userUpdates);

        if (!userUpdateSuccess) {
          throw new Error("Failed to update user profile.");
        }
      }

      const response = await fetch(`/api/businesses/${business.businessId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedFields),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update business profile.");
      }

      toast.success("Profile updated successfully");
      onClose(); // Close modal and trigger refresh in parent
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(`Error updating profile: ${error.message || "Unknown error"}`);
    }
  };

  if (!isMounted) {
    return null;
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
                  <Label htmlFor="name">Business Name</Label>
                  <Input id="name" placeholder="Enter business name" value={formData.name} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" placeholder="https://example.com" type="url" value={formData.website} onChange={handleChange} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" placeholder="Enter business address" value={formData.address} onChange={handleChange} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" placeholder="City" value={formData.city} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" placeholder="State" value={formData.state} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input id="zipCode" placeholder="ZIP Code" value={formData.zipCode} onChange={handleChange} />
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
                  <Input id="phone" placeholder="(123) 456-7890" type="tel" value={formData.phone} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    placeholder="contact@business.com"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
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
                value={formData.description}
                onChange={handleChange}
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
  );
}

