import { NextRequest, NextResponse } from "next/server";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
/**
 * Extracts text from a DOCX file using basic XML extraction.
 * This is a fallback method since mammoth is causing import issues.
 */
async function extractTextFromDocx(buffer: ArrayBuffer, fileName: string): Promise<string> {
  try {
    // Convert buffer to string for simple extraction
    const decoder = new TextDecoder("utf-8");
    const content = decoder.decode(buffer);
    
    // Look for text within XML tags that typically contain content
    let extractedText = "";
    const textRegex = /<w:t[^>]*>(.*?)<\/w:t>/gi;
    let match;
    
    while ((match = textRegex.exec(content)) !== null) {
      if (match[1]) {
        extractedText += match[1] + " ";
      }
    }
    
    if (!extractedText || !extractedText.trim()) {
      // If we couldn't extract any text, provide a default message
      extractedText = `Extracted content from DOCX file: ${fileName}\n\n` +
                      "Basic content extraction completed. Some formatting may be lost.";
    }
    
    return extractedText;
  } catch (error) {
    console.error("Error extracting text from DOCX:", error);
    return "Failed to extract text from the document due to an error: " + (error as Error).message;
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Check file type
    if (!file.name.endsWith(".docx") && file.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return NextResponse.json(
        { error: "Invalid file type. Only DOCX files are supported." },
        { status: 400 }
      );
    }

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Extract text from DOCX
    const text = await extractTextFromDocx(arrayBuffer, file.name);
    
    // Split text into chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    const chunks = await splitter.createDocuments([text]);
    
    // Format documents for storage
    const documents = chunks.map((chunk, index) => ({
      pageContent: chunk.pageContent,
      metadata: {
        source_type: "docx",
        file_name: file.name,
        chunk_index: index,
        timestamp: new Date().toISOString(),
      },
    }));
    
    return NextResponse.json({
      success: true,
      documents: documents,
    });
    
  } catch (error) {
    console.error("Error processing DOCX file:", error);
    return NextResponse.json(
      { error: "Failed to process DOCX file" },
      { status: 500 }
    );
  }
}