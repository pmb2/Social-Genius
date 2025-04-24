import { NextRequest, NextResponse } from "next/server";
import { QdrantClient } from "@qdrant/js-client-rest";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/community/vectorstores/qdrant";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      query, 
      collectionName, 
      similarityThreshold = 0.7, 
      qdrantApiKey, 
      qdrantUrl,
      selectedDocumentIds = []
    } = body;
    
    if (!query) {
      return NextResponse.json({ success: false, error: "No query provided" }, { status: 400 });
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
      modelName: "text-embedding-3-small"
    });
    
    // Create vector store and configure retriever
    try {
      // First check if collection exists
      await client.getCollection(collectionName);
      
      // Create vector store
      const vectorStore = new QdrantVectorStore(embeddings, {
        client,
        collectionName,
      });
      
      // Create retriever with similarity search
      const retriever = vectorStore.asRetriever({
        searchType: "similarity",
        k: 5, // Return up to 5 documents
        filter: selectedDocumentIds.length > 0 ? {
          must: [
            {
              key: "id",
              match: {
                any: selectedDocumentIds
              }
            }
          ]
        } : undefined
      });
      
      // We'll apply similarity threshold filtering in code after retrieval
      
      // Filter is now applied directly in the retriever options above
      
      // Retrieve relevant documents
      let docs = await retriever.getRelevantDocuments(query);
      
      // Apply similarity threshold filtering manually
      // For this, we need to use the vectorStore directly to get scores
      const results = await vectorStore.similaritySearchWithScore(query, 10);
      
      // Map the documents with their scores
      const docsWithScores = results.map(([doc, score]) => ({
        pageContent: doc.pageContent,
        metadata: doc.metadata,
        score: score
      }));
      
      // Filter by similarity threshold
      const filteredDocs = docsWithScores.filter(doc => doc.score >= similarityThreshold);
      
      return NextResponse.json({ 
        success: true, 
        docs: filteredDocs.map(doc => ({
          pageContent: doc.pageContent,
          metadata: doc.metadata,
          score: doc.score
        }))
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Collection not found")) {
        return NextResponse.json({ 
          success: true, 
          docs: [],
          message: "Collection does not exist or is empty"
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