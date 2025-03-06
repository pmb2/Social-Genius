import { NextRequest, NextResponse } from "next/server";
import PostgresService from "../../../services/postgres-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { documentId, documentIds, collectionName } = body;
    
    // Support both single documentId and array of documentIds
    const idsToDelete = documentIds || (documentId ? [documentId] : []);
    
    if (!idsToDelete || !Array.isArray(idsToDelete) || idsToDelete.length === 0) {
      return NextResponse.json({ success: false, error: "Invalid document IDs" }, { status: 400 });
    }

    if (!collectionName) {
      return NextResponse.json({ success: false, error: "Missing collection name" }, { status: 400 });
    }
    
    // Initialize PostgreSQL service
    const dbService = PostgresService.getInstance();
    
    try {
      // Convert string IDs to numbers if needed
      const numericIds = idsToDelete.map((id: string | number) => {
        if (typeof id === 'string') {
          // Handle IDs in format "text-1234567890" or "pdf-1234567890"
          if (id.includes('-')) {
            const parts = id.split('-');
            if (parts.length > 1) {
              const numericPart = parseInt(parts[1], 10);
              if (!isNaN(numericPart)) {
                return numericPart;
              }
            }
          }
          return parseInt(id, 10);
        }
        return id;
      }).filter((id: any) => !isNaN(id));
      
      // Delete documents
      const deletedCount = await dbService.deleteDocuments(collectionName, numericIds);
      
      return NextResponse.json({ 
        success: true,
        message: `${deletedCount} documents deleted from collection: ${collectionName}`,
        deletedCount
      });
      
    } catch (error) {
      console.error("Document deletion database error:", error);
      throw error; // Re-throw for the outer catch block
    }
    
  } catch (error) {
    console.error("Document deletion error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Error deleting documents" 
    }, { status: 500 });
  }
}