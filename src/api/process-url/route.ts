import { NextRequest, NextResponse } from "next/server";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantClient } from "@qdrant/js-client-rest";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/community/vectorstores/qdrant";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, collectionName, qdrantApiKey, qdrantUrl } = body;
    
    if (!url) {
      return NextResponse.json({ success: false, error: "No URL provided" }, { status: 400 });
    }

    if (!qdrantApiKey || !qdrantUrl) {
      return NextResponse.json({ success: false, error: "Missing Qdrant credentials" }, { status: 400 });
    }
    
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" }, { status: 500 });
    }
    
    // Load content from URL using Cheerio loader
    const loader = new CheerioWebBaseLoader(url, {
      selector: "body", // Extracts content from the body tag
      // You can customize further with additional options like:
      // - prettyPrint: to format HTML nicely
      // - timeout: to set request timeout
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
    
    // Connect to Qdrant
    const client = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey,
    });
    
    // Create embeddings using OpenAI
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: openaiApiKey,
      modelName: "text-embedding-3-small"
    });
    
    // Create or get collection in Qdrant
    try {
      // Check if collection exists
      await client.getCollection(collectionName);
    } catch (error) {
      // Collection doesn't exist, create it
      await client.createCollection(collectionName, {
        vectors: {
          size: 1536,  // OpenAI embedding dimension for text-embedding-3-small
          distance: "Cosine"
        }
      });
    }
    
    // Store documents in Qdrant
    await QdrantVectorStore.fromDocuments(
      splitDocs,
      embeddings,
      {
        url: qdrantUrl,
        collectionName,
        apiKey: qdrantApiKey,
      }
    );
    
    return NextResponse.json({ 
      success: true,
      message: `URL ${url} processed successfully. Created ${splitDocs.length} document chunks.`,
      documentCount: splitDocs.length
    });
    
  } catch (error) {
    console.error("URL processing error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Error processing URL" 
    }, { status: 500 });
  }
}