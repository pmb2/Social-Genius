import { performResearch } from "../lib/research"

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { competitorName, location, industry, placeId } = req.body
    
    // Check for required fields
    if (!competitorName || !location || !industry) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required parameters" 
      });
    }

    // Build the deep research prompt using our curated prompt and input parameters.
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
`

    try {
      // Run the research using the performResearch function
      const result = await performResearch(prompt)
      res.status(200).json({ success: true, result })
    } catch (error) {
      console.error("Error running deep research:", error)
      res.status(500).json({ 
        success: false, 
        error: error.message || "Error processing research" 
      })
    }
  } else {
    res.status(405).json({ success: false, error: "Method not allowed" })
  }
}