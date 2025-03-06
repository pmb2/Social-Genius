import { NextRequest, NextResponse } from "next/server";
import PostgresService from "../../../services/postgres-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      query, 
      collectionName, 
      similarityThreshold = 0.7, 
      documentIds = []
    } = body;
    
    if (!query) {
      return NextResponse.json({ success: false, error: "No query provided" }, { status: 400 });
    }

    if (!collectionName) {
      return NextResponse.json({ success: false, error: "No collection name provided" }, { status: 400 });
    }
    
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" }, { status: 500 });
    }
    
    // Initialize database service
    const dbService = PostgresService.getInstance();
    
    try {
      // Convert string IDs to numbers if needed
      let numericIds = undefined;
      if (documentIds && documentIds.length > 0) {
        try {
          numericIds = documentIds.map((id: string | number) => 
            typeof id === 'string' && id.includes('-') 
              ? parseInt(id.split('-')[1], 10)  // handle "text-1234567890" format
              : typeof id === 'string' 
                ? parseInt(id, 10) 
                : id
          );
          numericIds = numericIds.filter((id: any) => !isNaN(id));
        } catch (error) {
          console.error("Error parsing document IDs:", error, documentIds);
          numericIds = undefined;
        }
      }
      
      // Find similar documents
      const docs = await dbService.findSimilar(
        collectionName,
        query,
        5, // limit
        similarityThreshold,
        numericIds
      );
      
      // Format response
      return NextResponse.json({ 
        success: true, 
        docs: docs.map(doc => ({
          id: doc.id,
          pageContent: doc.content,
          metadata: doc.metadata,
          score: doc.similarity
        }))
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("relation \"documents\" does not exist")) {
        // Database not initialized yet
        await dbService.initialize();
        return NextResponse.json({ 
          success: true, 
          docs: [],
          message: "Database initialized. No documents found."
        });
      }
      throw error; // Re-throw for the outer catch block
    }
  } catch (error) {
    console.error("Document retrieval error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Error retrieving documents" 
    }, { status: 500 });
  }
}