"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchIcon, BarChart2, MapPin, Building } from "lucide-react"

interface ResearchFormData {
  competitorName: string
  location: string
  industry: string
  placeId?: string
}

interface PlaceSuggestion {
  description: string
  place_id: string
}

// Declare google as a global variable
declare global {
  namespace google.maps.places {
    class AutocompleteService {
      getPlacePredictions(
        request: {
          input: string;
          types?: string[];
          componentRestrictions?: { country: string };
        },
        callback: (
          predictions: Array<{ description: string; place_id: string }>,
          status: string
        ) => void
      ): void;
    }
    
    const PlacesServiceStatus: {
      OK: string;
    };
  }
  
  interface Window {
    google?: {
      maps: {
        places: {
          AutocompleteService: new () => google.maps.places.AutocompleteService;
          PlacesServiceStatus: {
            OK: string;
          };
        };
      };
    };
  }
}

export function CompetitorResearchTab() {
  const [formData, setFormData] = useState<ResearchFormData>({
    competitorName: "",
    location: "",
    industry: "",
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null)
  const placesServiceLoaded = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load Google Maps API
  useEffect(() => {
    if (typeof window !== "undefined" && !placesServiceLoaded.current) {
      if (!document.getElementById("google-maps-script")) {
        const script = document.createElement("script")
        script.id = "google-maps-script"
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.GOOGLE_MAPS_API_KEY}&libraries=places`
        script.async = true
        script.defer = true
        script.onload = () => {
          placesServiceLoaded.current = true
          autocompleteService.current = new window.google.maps.places.AutocompleteService()
        }
        document.head.appendChild(script)
      } else if (window.google && window.google.maps && window.google.maps.places) {
        placesServiceLoaded.current = true
        autocompleteService.current = new window.google.maps.places.AutocompleteService()
      }
    }
  }, [])

  // Handle input change for all fields
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    // If changing competitor name, fetch suggestions
    if (name === "competitorName" && value.length > 2 && placesServiceLoaded.current && autocompleteService.current) {
      autocompleteService.current.getPlacePredictions(
        {
          input: value,
          types: ["establishment"],
          componentRestrictions: formData.location ? { country: "us" } : undefined,
        },
        (predictions, status) => {
          if (
            window.google &&
            window.google.maps &&
            status === window.google.maps.places.PlacesServiceStatus.OK &&
            predictions
          ) {
            setSuggestions(predictions)
            setShowSuggestions(true)
          } else {
            setSuggestions([])
            setShowSuggestions(false)
          }
        },
      )
    } else if (name === "competitorName" && value.length <= 2) {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  // Handle selection of a place suggestion
  const handleSelectPlace = (suggestion: PlaceSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      competitorName: suggestion.description,
      placeId: suggestion.place_id,
    }))
    setSuggestions([])
    setShowSuggestions(false)
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/competitor-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      const data = await response.json()
      if (response.ok) {
        // Handle both API response formats (with or without success property)
        if (data.success === false) {
          setResult(`Error: ${data.error || "Unknown error occurred"}`)
        } else {
          setResult(data.result || "Analysis complete. No specific insights found.")
        }
      } else {
        setResult(`Error: ${data.error || "Unknown error occurred"}`)
      }
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="h-full min-h-[600px] m-0 p-6 overflow-auto scrollbar-hide" data-tab="competitor">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-4xl font-bold">Competitor Research</h3>
          <p className="text-gray-500 mt-2">
            Analyze your competitors to gain insights and improve your business strategy
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Research Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-[#FF1681] flex items-center justify-center flex-shrink-0">
              <SearchIcon className="w-4 h-4 text-white" />
            </div>
            <h4 className="text-xl font-semibold">Research Parameters</h4>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="competitorName">Competitor Name</Label>
              <div className="relative" ref={inputRef}>
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Building className="w-4 h-4 text-gray-400" />
                </div>
                <Input
                  id="competitorName"
                  name="competitorName"
                  value={formData.competitorName}
                  onChange={handleChange}
                  placeholder="Search for a business..."
                  className="w-full pl-10"
                  required
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    {suggestions.map((suggestion) => (
                      <div
                        key={suggestion.place_id}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => handleSelectPlace(suggestion)}
                      >
                        {suggestion.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <MapPin className="w-4 h-4 text-gray-400" />
                </div>
                <Input
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g., Boston, MA"
                  className="w-full pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                name="industry"
                value={formData.industry}
                onChange={handleChange}
                placeholder="e.g., Coffee Shop"
                className="w-full"
                required
              />
            </div>

            <div className="flex justify-center mt-6">
              <Button
                type="submit"
                disabled={loading}
                className="px-8 h-[56px] bg-gradient-to-b from-[#FFAB1A] to-[#FF1681] hover:opacity-90 text-white rounded-full text-base font-medium shrink-0"
              >
                {loading ? "Analyzing..." : "Run Competitor Research"}
              </Button>
            </div>
          </form>
        </div>

        {/* Results Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-[#0080FF] flex items-center justify-center flex-shrink-0">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <h4 className="text-xl font-semibold">Analysis Results</h4>
          </div>

          {result ? (
            <div className="overflow-auto max-h-[500px] pr-2">
              <div className="bg-gray-50 p-4 rounded-lg border">
                {result.includes("<think>") ? (
                  <div className="space-y-0">
                    {/* Thoughts toggle button */}
                    <button 
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium -mb-1"
                      onClick={(e) => {
                        e.preventDefault();
                        const thoughtsElement = e.currentTarget.nextElementSibling;
                        if (thoughtsElement) {
                          const isVisible = thoughtsElement.classList.contains("block");
                          thoughtsElement.classList.toggle("block", !isVisible);
                          thoughtsElement.classList.toggle("hidden", isVisible);
                          e.currentTarget.textContent = isVisible ? "Show thoughts" : "Hide thoughts";
                        }
                      }}
                    >
                      Show thoughts
                    </button>
                    
                    {/* Thoughts content (hidden by default) */}
                    <div className="hidden py-1 border-l-2 border-gray-200 pl-2 my-1">
                      <p className="text-sm text-gray-500 italic m-0 leading-snug">
                        {result.match(/<think>([\s\S]*?)<\/think>/)?.[1] || "No thoughts available"}
                      </p>
                    </div>
                    
                    {/* Main content without the think tags */}
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans m-0">
                      {result.replace(/<think>[\s\S]*?<\/think>/g, "").trim()}
                    </pre>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">{result}</pre>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <BarChart2 className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 max-w-md">
                Run a competitor analysis to see detailed insights about your competition and market positioning.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

