import { NextRequest, NextResponse } from "next/server";
import { performCompetitorResearch } from "../../../lib/research";

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
    
    // Build the research prompt
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

    try {
      // Log that we're starting the research
      console.log(`Researching ${competitorName} in ${location} for the ${industry} industry.`);
      
      // Use our shared performCompetitorResearch function
      const researchResult = await performCompetitorResearch({
        term: competitorName,
        industry,
        location,
        limit: 5
      });
      
      return NextResponse.json({ 
        success: true, 
        result: researchResult
      });
      
    } catch (apiError) {
      console.error("API error during competitor research:", apiError);
      return NextResponse.json({ 
        success: false, 
        error: apiError instanceof Error ? apiError.message : "Error during competitor research" 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error("Competitor research error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Error performing competitor research" 
    }, { status: 500 });
  }
}