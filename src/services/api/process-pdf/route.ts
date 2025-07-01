import { NextRequest, NextResponse } from "next/server";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }
    
    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Create a temporary file path - use a unique name based on timestamp
    const tempFilePath = `/tmp/${Date.now()}-${file.name}`;
    
    // Write buffer to file system
    import fs from 'fs';
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
      
      // Return processed documents
      return NextResponse.json({ 
        success: true, 
        documents: splitDocs.map(doc => ({
          pageContent: doc.pageContent,
          metadata: doc.metadata
        }))
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
      error: "Error processing PDF" 
    }, { status: 500 });
  }
}

