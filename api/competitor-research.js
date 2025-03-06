import { performResearch } from "../../lib/research" // Adjust this import per your library

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { competitorName, location, industry } = req.body

    // Build the deep research prompt using our curated prompt and input parameters.
    const prompt = `
You are an expert in local SEO and competitor research, and your task is to perform a deep, comprehensive competitor analysis for a local business’s Google Business Profile optimization project using only free and open‐source (FOSS) tools. Your analysis must be professional, data‐driven, and reproducible. Follow these steps:

1. **Data Collection:**  
   - Use FOSS tools such as Matomo, SEO Panel, OpenStreetMap, GeoNames, and community‑driven GBP scraping projects on GitHub to gather essential competitor information.
   - Extract data on key GBP elements: business name, address, phone (NAP) consistency, review counts, review quality, photos, posts, business descriptions, and categories.

2. **Competitor Identification and Benchmarking:**  
   - Identify the top three competitors in the local market for a business in the "${industry}" industry located in "${location}".
   - Compare and benchmark their Google Business Profile against the target business by analyzing strengths and weaknesses (review management, visual content quality, update frequency, and keyword usage).

3. **Analysis and Insights:**  
   - Analyze gaps and opportunities by contrasting the target GBP with those of the top competitors.
   - Identify actionable areas for improvement (e.g., missing attributes, low-quality photos, inconsistent NAP data, underutilized review responses).
   - Highlight trends and best practices observed among the competitor profiles.

4. **Reporting:**  
   - Compile your findings into a clear, step‑by‑step report with supporting metrics and visualizations where applicable.
   - Provide recommendations for optimizing the target Google Business Profile based on your analysis.

Ensure that all steps use only FOSS tools and publicly available data sources. Your output should be detailed, methodical, and ready to share with a technical team for implementation.

For context, the competitor being analyzed is: "${competitorName}".
End your analysis with a summary of key findings and actionable next steps.
`

    try {
      // Run the research using the deep research function from open_deep_research.
      const result = await performResearch(prompt)
      res.status(200).json({ result })
    } catch (error) {
      console.error("Error running deep research:", error)
      res.status(500).json({ error: error.message || "Error processing research" })
    }
  } else {
    res.status(405).json({ error: "Method not allowed" })
  }
}

