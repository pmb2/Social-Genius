import { NextRequest, NextResponse } from "next/server";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { DatabaseService } from "@/services/database";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, collectionName = "default" } = body;
    
    if (!url) {
      return NextResponse.json({ success: false, error: "No URL provided" }, { status: 400 });
    }
    
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" }, { status: 500 });
    }
    
    // Load content from URL using Cheerio loader
    const loader = new CheerioWebBaseLoader(url, {
      selector: "body", // Extracts content from the body tag
    });
    
    // Load the documents
    const docs = await loader.load();
    
    // Add metadata to each document
    docs.forEach(doc => {
      doc.metadata = {
        ...doc.metadata,
        source_type: "url",
        url: url,
        timestamp: new Date().toISOString()
      };
    });
    
    // Split the content into smaller chunks for better processing
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200
    });
    
    const splitDocs = await textSplitter.splitDocuments(docs);
    
    // Initialize PostgreSQL service and store documents
    const dbService = DatabaseService.getInstance();
    await dbService.initialize();
    
    // Prepare documents for storage
    const docsToStore = splitDocs.map(doc => ({
      collection: collectionName,
      content: doc.pageContent,
      metadata: doc.metadata || {}
    }));
    
    // Store documents
    const ids = await dbService.storeDocuments(docsToStore);
    
    return NextResponse.json({ 
      success: true,
      message: `URL ${url} processed successfully. Created ${splitDocs.length} document chunks.`,
      documentCount: splitDocs.length,
      documentIds: ids
    });
    
  } catch (error) {
    console.error("URL processing error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Error processing URL" 
    }, { status: 500 });
  }
}