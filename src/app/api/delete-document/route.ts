import { NextRequest, NextResponse } from "next/server";
import { QdrantClient } from "@qdrant/js-client-rest";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { documentId, collectionName, qdrantApiKey, qdrantUrl } = body;
    
    if (!documentId) {
      return NextResponse.json({ success: false, error: "No document ID provided" }, { status: 400 });
    }

    if (!qdrantApiKey || !qdrantUrl) {
      return NextResponse.json({ success: false, error: "Missing Qdrant credentials" }, { status: 400 });
    }

    if (!collectionName) {
      return NextResponse.json({ success: false, error: "No collection name provided" }, { status: 400 });
    }
    
    // Connect to Qdrant
    const client = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey,
    });
    
    // Check if collection exists
    try {
      await client.getCollection(collectionName);
    } catch {
      return NextResponse.json({ 
        success: false, 
        error: `Collection ${collectionName} not found` 
      }, { status: 404 });
    }
    
    // Delete points with matching metadata.id
    // For Qdrant, we need to use a filter that targets the metadata field
    await client.delete(collectionName, {
      filter: {
        must: [
          {
            key: "metadata.id",
            match: {
              value: documentId
            }
          }
        ]
      }
    });
    
    return NextResponse.json({ 
      success: true,
      message: `Document ${documentId} deleted successfully from collection ${collectionName}`
    });
    
  } catch (error) {
    console.error("Document deletion error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Error deleting document" 
    }, { status: 500 });
  }
}