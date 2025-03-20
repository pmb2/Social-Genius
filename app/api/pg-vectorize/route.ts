import { NextRequest, NextResponse } from "next/server";
import PostgresService from "../../../services/postgres-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { documents, collectionName, businessId } = body;
    
    // Add debug logging
    console.log("Vectorization request received:", { 
      documentCount: documents?.length, 
      collectionName,
      businessId,
      hasMetadata: documents?.[0]?.metadata ? true : false
    });
    
    if (!documents || !Array.isArray(documents)) {
      return NextResponse.json({ success: false, error: "Invalid documents" }, { status: 400 });
    }

    if (!collectionName) {
      return NextResponse.json({ success: false, error: "Missing collection name" }, { status: 400 });
    }
    
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" }, { status: 500 });
    }
    
    // Initialize PostgreSQL service
    const dbService = PostgresService.getInstance();
    
    try {
      // Make sure database is initialized
      await dbService.initialize();
      
      // Prepare documents for storage
      const docsToStore = documents.map(doc => ({
        collection: collectionName,
        content: doc.pageContent,
        metadata: {
          ...(doc.metadata || {}),
          // Add businessId to metadata if provided
          ...(businessId ? { businessId } : {})
        }
      }));
      
      // Store documents
      const ids = await dbService.storeDocuments(docsToStore);
      
      return NextResponse.json({ 
        success: true,
        message: `${documents.length} documents vectorized and stored in PostgreSQL collection: ${collectionName}`,
        documentIds: ids
      });
      
    } catch (error) {
      console.error("Vectorization database error:", error);
      throw error; // Re-throw for the outer catch block
    }
    
  } catch (error: any) {
    // More detailed error logging
    console.error("Vectorization error:", {
      message: error?.message || "Unknown error",
      name: error?.name,
      stack: error?.stack?.substring(0, 200) // Log just the beginning of the stack
    });
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Error vectorizing documents" 
    }, { status: 500 });
  }
}