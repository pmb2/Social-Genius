import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, model = "deepseek-r1-distill-llama-70b", groqApiKey } = body;
    
    if (!prompt) {
      return NextResponse.json({ success: false, error: "No prompt provided" }, { status: 400 });
    }
    
    // First try to use the provided API key, then fall back to the environment variable
    const apiKey = groqApiKey || process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: "Groq API key not provided. Please add GROQ_API_KEY to your .env file."
      }, { status: 400 });
    }
    
    // Validate model availability
    const supportedModels = [
      "deepseek-r1-distill-llama-70b",
      "llama3-70b-8192",
      "mixtral-8x7b-32768",
      "gemma-7b",
      "llama3-8b-8192",
      "codellama-70b",
      "codellama-34b"
    ];
    
    if (!supportedModels.includes(model)) {
      return NextResponse.json({ 
        success: false, 
        error: `Model "${model}" is not supported. Please use one of: ${supportedModels.join(", ")}` 
      }, { status: 400 });
    }
    
    // Call Groq API for text generation
    try {
      console.log("Calling Groq API with model:", model);
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model,
          messages: [
            {
              role: "system",
              content: "You are an Intelligent Agent specializing in developing brand voice and tone. You help users create and refine their brand's personality and communication style. Be precise, helpful, and professional."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2048
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          }
        }
      );
      
      if (response.data.choices && response.data.choices.length > 0) {
        const text = response.data.choices[0].message.content;
        
        return NextResponse.json({ 
          success: true, 
          text,
          usage: response.data.usage,
          model: response.data.model
        });
      } else {
        return NextResponse.json({ 
          success: false, 
          error: "No response generated" 
        }, { status: 500 });
      }
    } catch (apiError) {
      console.error("Groq API error:", apiError);
      // Handle specific API errors
      if (axios.isAxiosError(apiError) && apiError.response) {
        return NextResponse.json({ 
          success: false, 
          error: `Groq API error: ${apiError.response.data.error?.message || "Unknown error"}` 
        }, { status: apiError.response.status || 500 });
      }
      throw apiError; // Re-throw for the outer catch block
    }
  } catch (error) {
    console.error("Groq API error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Error generating response from Groq" 
    }, { status: 500 });
  }
}