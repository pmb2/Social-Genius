"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Settings, ChevronDown } from "lucide-react"
import { DropdownMenu, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu-lite"

export function BrandAlignmentTab() {
  const [loading, setLoading] = useState(false)
  const [brandVoice, setBrandVoice] = useState("")
  
  return (
    <div className="h-full min-h-[600px] flex flex-col m-0 p-4 overflow-hidden relative">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Brand Alignment</h2>
        <p className="text-gray-600">
          Define your brand voice and values to ensure consistent communication.
        </p>
      </div>
      
      <div className="grid grid-cols-1 gap-6 mb-6">
        <div>
          <Label className="text-base font-medium mb-2 block">Brand Voice & Tone</Label>
          <Textarea
            placeholder="Describe your brand's voice, tone, and communication style..."
            className="min-h-[120px] text-base"
            value={brandVoice}
            onChange={(e) => setBrandVoice(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex justify-between items-center mt-4">
        <Button 
          className="bg-blue-600 hover:bg-blue-700"
          disabled={loading}
          onClick={() => setLoading(true)}
        >
          {loading ? "Saving..." : "Save Brand Profile"}
        </Button>
        
        {/* Settings Dropdown */}
        <DropdownMenu
          trigger={
            <Button
              className="bg-white border-2 border-black text-black hover:bg-gray-50 flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Settings
              <ChevronDown className="w-4 h-4" />
            </Button>
          }
          align="right"
        >
          <DropdownMenuLabel>Brand Settings</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => console.log("Option 1 clicked")}>
            Option 1
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => console.log("Option 2 clicked")}>
            Option 2
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
    </div>
  )
}