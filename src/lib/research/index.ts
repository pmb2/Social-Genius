// Research utilities and helpers 
import axios from "axios";

export interface CompetitorResearchParams {
  term: string;
  location: string;
  industry: string;
  limit?: number;
}

export async function performCompetitorResearch(params: CompetitorResearchParams): Promise<any> {
  const { term, location, industry, limit = 5 } = params;
  
  // Check for OpenAI API key in environment variables
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("OpenAI API key not configured");
  }
  
  // Build the research prompt using our curated prompt and input parameters
  const prompt = `
You are an expert business analyst specializing in local SEO and competitor research. I need you to create a comprehensive competitor analysis report for a business using the following information:

- Competitor Name: ${term}
- Location: ${location}
- Industry: ${industry}

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
    return researchResult;
  } else {
    throw new Error("No research results generated");
  }
}

export function formatCompetitorResults(results: any[], maxCount: number = 10): any[] {
  if (!results || !Array.isArray(results)) return [];
  
  // Format and limit results
  return results
    .slice(0, maxCount)
    .map(result => ({
      ...result,
      // Add any formatting or cleanup here
    }));
}

export function sanitizeCompetitorSearchQuery(query: string): string {
  if (!query) return '';
  
  // Remove any potentially problematic characters
  return query
    .trim()
    .replace(/[^\w\s]/g, ' ') // Replace non-alphanumeric with space
    .replace(/\s+/g, ' ');    // Replace multiple spaces with single space
}

export function enhanceSearchResults(results: any[]): any[] {
  if (!results || !Array.isArray(results)) return [];
  
  return results.map(result => {
    // Add confidence score and other enhancements
    return {
      ...result,
      confidence: calculateConfidence(result),
      timestamp: new Date().toISOString()
    };
  });
}

function calculateConfidence(result: any): number {
  // Simple confidence calculation based on available data
  let score = 0.5; // Default middle score
  
  if (result.title?.length > 0) score += 0.1;
  if (result.snippet?.length > 20) score += 0.1;
  if (result.link?.includes('https')) score += 0.1;
  
  return Math.min(1, score); // Cap at 1.0
}