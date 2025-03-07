# API Documentation for Social Genius

This document outlines the API routes implemented in Social Genius, providing details on request parameters, response formats, and implementation notes.

> **Important**: All API routes are implemented in the `app/api` directory following Next.js App Router conventions. Each API route is defined in a `route.ts` file within its respective directory (e.g., `app/api/retrieve/route.ts`).

## Document Processing APIs

### 1. Process PDF (`/api/process-pdf`)

**Purpose:** Upload and process PDF documents into text chunks for later vectorization.

**Request:**
- Method: `POST`
- Format: `FormData`
- Parameters:
  - `file`: PDF file to process

**Response:**
```json
{
  "success": true,
  "documents": [
    {
      "pageContent": "Text content from the PDF",
      "metadata": {
        "source_type": "pdf",
        "file_name": "filename.pdf",
        "timestamp": "2025-03-04T12:34:56.789Z",
        "page": 1,
        "loc": { "pageNumber": 1 }
      }
    }
  ]
}
```

**Implementation Notes:**
- Uses `@langchain/community/document_loaders/fs/pdf` to extract text from PDFs
- Temporarily saves uploaded file to process with the loader
- Splits content into manageable chunks using RecursiveCharacterTextSplitter

### 2. Process URL (`/api/process-url`)

**Purpose:** Scrape and process web content into text chunks and store in vector database.

**Request:**
- Method: `POST`
- Format: `JSON`
- Parameters:
  - `url`: URL to scrape and process
  - `collectionName`: Name of Qdrant collection to store vectors
  - `qdrantApiKey`: API key for Qdrant
  - `qdrantUrl`: URL of Qdrant instance

**Response:**
```json
{
  "success": true,
  "message": "URL https://example.com processed successfully. Created 15 document chunks.",
  "documentCount": 15
}
```

**Implementation Notes:**
- Uses `@langchain/community/document_loaders/web/cheerio` to scrape web content
- Splits content into chunks with RecursiveCharacterTextSplitter
- Stores vectors directly in Qdrant collection

### 3. Vectorize (`/api/vectorize`)

**Purpose:** Convert documents to vector embeddings and store in Qdrant.

**Request:**
- Method: `POST`
- Format: `JSON`
- Parameters:
  - `documents`: Array of document objects with pageContent and metadata
  - `collectionName`: Name of Qdrant collection to store vectors
  - `qdrantApiKey`: API key for Qdrant
  - `qdrantUrl`: URL of Qdrant instance

**Response:**
```json
{
  "success": true,
  "message": "10 documents vectorized and stored in Qdrant collection: mycollection"
}
```

**Implementation Notes:**
- Creates Qdrant collection if it doesn't exist
- Uses OpenAI's text-embedding-3-small model (1536 dimensions)
- Auto-detects collection vector size based on embedding model

## Retrieval and Search APIs

### 4. Retrieve (`/api/retrieve`)

**Purpose:** Perform vector similarity search in Qdrant.

**Request:**
- Method: `POST`
- Format: `JSON`
- Parameters:
  - `query`: Text query to search for
  - `collectionName`: Name of Qdrant collection to search
  - `similarityThreshold`: (optional) Minimum similarity score (default: 0.7)
  - `qdrantApiKey`: API key for Qdrant
  - `qdrantUrl`: URL of Qdrant instance
  - `selectedDocumentIds`: (optional) Array of document IDs to filter by

**Response:**
```json
{
  "success": true,
  "docs": [
    {
      "pageContent": "Matching document content",
      "metadata": {
        "source_type": "url",
        "url": "https://example.com",
        "timestamp": "2025-03-04T12:34:56.789Z"
      },
      "score": 0.89
    }
  ]
}
```

**Implementation Notes:**
- Uses similarity search with post-retrieval similarity score filtering
- Returns documents with scores above the specified threshold
- Includes score in response for each document
- Supports filtering to specific document IDs using Qdrant's filtering syntax
- Filter example: `{ must: [{ key: "id", match: { any: ["id1", "id2"] } }] }`

### 5. Web Search (`/api/web-search`)

**Purpose:** Search the web using Exa API.

**Request:**
- Method: `POST`
- Format: `JSON`
- Parameters:
  - `query`: Search query
  - `numResults`: (optional) Number of results to return (default: 5)
  - `exaApiKey`: (optional) Exa API key (fallback to environment variable)

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "title": "Result title",
      "url": "https://example.com/result",
      "content": "Snippet of content from the result",
      "publishDate": "2025-02-01"
    }
  ]
}
```

### 6. Delete Document (`/api/delete-document`)

**Purpose:** Remove documents from vector database.

**Request:**
- Method: `POST`
- Format: `JSON`
- Parameters:
  - `pointIds`: Array of point IDs to delete
  - `collectionName`: Name of Qdrant collection
  - `qdrantApiKey`: API key for Qdrant
  - `qdrantUrl`: URL of Qdrant instance

**Response:**
```json
{
  "success": true,
  "message": "3 documents deleted from collection: mycollection"
}
```

## AI Analysis APIs

### 7. Groq (`/api/groq`)

**Purpose:** Interact with Groq LLM API for fast AI responses.

**Request:**
- Method: `POST`
- Format: `JSON`
- Parameters:
  - `messages`: Array of message objects with role and content
  - `model`: (optional) Groq model to use (default: "llama3-8b-8192")
  - `temperature`: (optional) Temperature setting (default: 0.7)

**Response:**
```json
{
  "success": true,
  "response": {
    "role": "assistant",
    "content": "AI generated response text"
  }
}
```

### 8. Competitor Research (`/api/competitor-research`)

**Purpose:** Perform AI-powered competitor analysis for local businesses.

**Request:**
- Method: `POST`
- Format: `JSON`
- Parameters:
  - `competitorName`: Name of competitor business
  - `location`: Business location
  - `industry`: Business industry
  - `placeId`: (optional) Google Place ID

**Response:**
```json
{
  "success": true,
  "result": "Markdown formatted competitor analysis report"
}
```

**Implementation Notes:**
- Uses OpenAI's GPT-4 Turbo to generate comprehensive analysis
- Formats response in Markdown for frontend rendering
- Future enhancement: integrate with Google Places API for real data

## Troubleshooting

### Common Issues

1. **"OpenAI API key not configured"**
   - Make sure OPENAI_API_KEY is set in your .env file

2. **"Missing Qdrant credentials"**
   - Check that qdrantApiKey and qdrantUrl are provided in the request or set in .env

3. **PDF Processing Errors**
   - Ensure PDFs are not password-protected
   - Check server has proper permissions for temp directory

4. **Vector Database Connection Issues**
   - Verify Qdrant instance is running and accessible
   - Check API key permissions

### Required Dependencies

This project relies on several key dependencies:
- `@langchain/community`: Document loaders and vector stores
- `@langchain/textsplitters`: Text chunking utilities 
- `@langchain/openai`: OpenAI embeddings integration
- `@qdrant/js-client-rest`: Qdrant vector database client
- `axios`: HTTP client for API requests