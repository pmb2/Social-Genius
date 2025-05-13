import { NextRequest, NextResponse } from "next/server";
import { QdrantClient } from "@qdrant/js-client-rest";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/community/vectorstores/qdrant";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { documents, collectionName, qdrantApiKey, qdrantUrl } = body;
    
    if (!documents || !Array.isArray(documents)) {
      return NextResponse.json({ success: false, error: "Invalid documents" }, { status: 400 });
    }

    if (!qdrantApiKey || !qdrantUrl) {
      return NextResponse.json({ success: false, error: "Missing Qdrant credentials" }, { status: 400 });
    }
    
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" }, { status: 500 });
    }
    
    // Connect to Qdrant
    const client = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey,
    });
    
    // Create embeddings using OpenAI
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: openaiApiKey,
      modelName: "text-embedding-3-small" // Using OpenAI's modern embeddings model
    });
    
    // Convert to Document objects
    const langchainDocs = documents.map(
      doc => new Document({
        pageContent: doc.pageContent,
        metadata: doc.metadata
      })
    );
    
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
    const vectorStore = await QdrantVectorStore.fromDocuments(
      langchainDocs,
      embeddings,
      {
        url: qdrantUrl,
        collectionName,
        apiKey: qdrantApiKey,
      }
    );
    
    return NextResponse.json({ 
      success: true,
      message: `${documents.length} documents vectorized and stored in Qdrant collection: ${collectionName}`
    });
    
  } catch (error) {
    console.error("Vectorization error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Error vectorizing documents" 
    }, { status: 500 });
  }
}