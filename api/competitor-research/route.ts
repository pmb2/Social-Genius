import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { competitorName, location, industry, placeId } = body;
    
    if (!competitorName || !location || !industry) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" }, 
        { status: 400 }
      );
    }
    
    // Check for OpenAI API key in environment variables
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" }, { status: 500 });
    }
    
    try {
      // First, fetch local business data using Places API or similar service
      // For this implementation, we'll simulate by using GPT-4 to generate researched content
      // In a real implementation, you would integrate with Google Places API, Yelp API, etc.
      
      // Step 1: Gather basic information and reviews via search
      const searchQuery = `${competitorName} ${industry} ${location} reviews`;
      
      // First, search for basic information using web search (if available)
      let businessContext = "";
      try {
        const googleSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
        // For demo, we're not making the actual API call since it requires payment setup
        // In a real implementation, you would call the Places API and extract business information
        
        businessContext = `Researching ${competitorName} in ${location} for the ${industry} industry.`;
      } catch (searchError) {
        console.log("Google Search API error (continuing with analysis):", searchError);
      }

      // Step 2: Generate the competitor analysis using GPT-4 via OpenAI API
      const prompt = `
You are an expert business analyst specializing in local SEO and competitor research. I need you to create a comprehensive competitor analysis report for a business using the following information:

- Competitor Name: ${competitorName}
- Location: ${location}
- Industry: ${industry}
${placeId ? `- Google Place ID: ${placeId}` : ''}

Please structure your analysis with the following sections:

1. Business Overview - Include industry, location and estimated GBP status
2. Key Findings - Break down into Strengths and Areas for Improvement
3. Competitive Analysis - List top 3 competitors with key strengths
4. Recommendations - Break down into Immediate Actions, Short-term Strategy (1-2 months), and Long-term Strategy (3-6 months)
5. Competitive Advantage Opportunities

Focus on Google Business Profile optimization elements: review management, business description, images, posts, attributes, hours consistency, etc.

Format the response in Markdown for readability. Make it detailed and professional, with specific recommendations that provide actionable insights.
`;

      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4-turbo",
          messages: [
            {
              role: "system",
              content: "You are a professional business analyst specializing in competitor analysis, local SEO, and Google Business Profile optimization."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 3000
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiApiKey}`
          }
        }
      );
      
      if (response.data.choices && response.data.choices.length > 0) {
        const researchResult = response.data.choices[0].message.content;
        
        return NextResponse.json({ 
          success: true, 
          result: researchResult
        });
      } else {
        throw new Error("No research results generated");
      }
      
    } catch (apiError) {
      console.error("API error during competitor research:", apiError);
      if (axios.isAxiosError(apiError) && apiError.response) {
        return NextResponse.json({ 
          success: false, 
          error: `API error: ${apiError.response.status} - ${apiError.response.data.error?.message || "Unknown error"}` 
        }, { status: apiError.response.status || 500 });
      }
      throw apiError; // Re-throw for the outer catch block
    }
    
  } catch (error) {
    console.error("Competitor research error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Error performing competitor research" 
    }, { status: 500 });
  }
}