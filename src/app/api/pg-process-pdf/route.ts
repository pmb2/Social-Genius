import { NextRequest, NextResponse } from "next/server";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { DatabaseService } from "@/services/database";
import * as fs from "fs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const collectionName = formData.get("collectionName") as string || "default";
    
    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }
    
    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Create a temporary file path - use a unique name based on timestamp
    const tempFilePath = `/tmp/${Date.now()}-${file.name}`;
    
    // Write buffer to file system
    fs.writeFileSync(tempFilePath, buffer);
    
    try {
      // Load PDF using LangChain's PDFLoader
      const loader = new PDFLoader(tempFilePath);
      const docs = await loader.load();
      
      // Add metadata to each document
      docs.forEach(doc => {
        doc.metadata = {
          ...doc.metadata,
          source_type: "pdf",
          file_name: file.name,
          timestamp: new Date().toISOString()
        };
      });
      
      // Split text into chunks for better processing
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
      
      // Return processed documents with their IDs
      return NextResponse.json({ 
        success: true, 
        message: `PDF processed and ${splitDocs.length} document chunks stored in collection: ${collectionName}`,
        documentCount: splitDocs.length,
        documentIds: ids
      });
    } finally {
      // Clean up temp file - make sure this runs even if there's an error
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.error("Error cleaning up temp file:", cleanupError);
      }
    }
  } catch (error) {
    console.error("PDF processing error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Error processing PDF" 
    }, { status: 500 });
  }
}