import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, exaApiKey } = body;
    
    if (!query) {
      return NextResponse.json({ success: false, error: "No query provided" }, { status: 400 });
    }
    
    if (!exaApiKey) {
      return NextResponse.json({ success: false, error: "Exa API key not provided" }, { status: 400 });
    }
    
    // Call the Exa API for web search
    try {
      const response = await axios.post(
        "https://api.exa.ai/search",
        {
          query,
          numResults: 5,
          includeDomains: [
            "arxiv.org", 
            "wikipedia.org", 
            "github.com", 
            "medium.com",
            "stackoverflow.com",
            "developer.mozilla.org",
            "docs.microsoft.com",
            "docs.aws.amazon.com",
            "cloud.google.com"
          ], // Adding technical domains as this seems to be for brand/business research
          useAutoprompt: true // Enable Exa's query enhancement
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": exaApiKey
          }
        }
      );
      
      // Process and format results
      if (response.data.results && Array.isArray(response.data.results)) {
        const formattedResults = response.data.results
          .map((result: any) => {
            const title = result.title || "Untitled";
            const url = result.url || "";
            const text = result.text || "";
            // Create a formatted result entry with source information and excerpt
            return `Source: ${title} (${url})\n${text.substring(0, 800)}...\n`;
          })
          .join("\n\n");
        
        return NextResponse.json({ 
          success: true, 
          results: formattedResults,
          totalResults: response.data.results.length
        });
      } else {
        return NextResponse.json({ 
          success: false, 
          error: "No search results found" 
        }, { status: 404 });
      }
    } catch (apiError) {
      console.error("Exa API error:", apiError);
      // Handle specific API errors
      if (axios.isAxiosError(apiError) && apiError.response) {
        return NextResponse.json({ 
          success: false, 
          error: `Exa API error: ${apiError.response.status} - ${apiError.response.data.message || "Unknown error"}` 
        }, { status: apiError.response.status });
      }
      throw apiError; // Re-throw for the outer catch block
    }
  } catch (error) {
    console.error("Web search error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Error performing web search" 
    }, { status: 500 });
  }
}