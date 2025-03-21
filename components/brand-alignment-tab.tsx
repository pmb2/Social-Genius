"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { X, Upload, Edit, Trash, Plus, Check, FileText, FileCode, File, Link as LinkIcon, FileImage, Settings, ChevronDown, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogClose, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import axios from "axios"
import Image from "next/image"

// Define types
type Message = {
  role: "user" | "assistant"
  content: string
}

type ProcessedDocument = {
  id: string
  name: string
  type: "pdf" | "url" | "text" | "docx"
  timestamp: string
}

type Memory = {
  id: string
  content: string
  timestamp: string
  type: "task" | "summary" | "custom"
  isCompleted?: boolean
}

type RagSettings = {
  modelVersion: string
  ragEnabled: boolean
  similarityThreshold: number
  useWebSearch: boolean
  forceWebSearch: boolean
}

export function BrandAlignmentTab() {
  // Capture drag and drop events at the component level
  const handleGlobalDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleGlobalDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };
  // State variables
  const [isMemoriesOpen, setIsMemoriesOpen] = useState(false)
  const [memories, setMemories] = useState<Memory[]>([
    {
      id: "mem-1",
      content: "Research competitor pricing structure and create a comparison chart",
      timestamp: new Date().toISOString(),
      type: "task",
      isCompleted: false
    },
    {
      id: "mem-2",
      content: "The business focuses on sustainable manufacturing processes with carbon-neutral goals by 2025",
      timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      type: "summary",
    },
    {
      id: "mem-3",
      content: "Target audience is primarily eco-conscious millennials in urban areas",
      timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      type: "custom",
    }
  ])
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
  const [newMemoryContent, setNewMemoryContent] = useState("")
  const [userInput, setUserInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [processedDocuments, setProcessedDocuments] = useState<ProcessedDocument[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [apiKeys] = useState({
    databaseUrl: process.env.NEXT_PUBLIC_DATABASE_URL || "",
    exaApiKey: process.env.NEXT_PUBLIC_EXA_API_KEY || "",
    groqApiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY || "",
  })
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set())
  const [settings, setSettings] = useState<RagSettings>({
    modelVersion: "deepseek-r1-distill-llama-70b",
    ragEnabled: true,
    similarityThreshold: 0.7,
    useWebSearch: false,
    forceWebSearch: false,
  })
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const COLLECTION_NAME = "brand-alignment-rag"

  // Initial welcome message and API key validation
  useEffect(() => {
    // Check for necessary API keys
    const missingKeys = [];
    if (!apiKeys.groqApiKey) missingKeys.push("GROQ_API_KEY");
    if (!apiKeys.databaseUrl) missingKeys.push("DATABASE_URL");
    if (!apiKeys.exaApiKey) missingKeys.push("EXA_API_KEY");

    if (missingKeys.length > 0) {
      setMessages([
        {
          role: "assistant",
          content:
            `⚠️ Some required API keys are missing: ${missingKeys.join(", ")}. Please add them to your .env file to enable full functionality.\n\nYou can still use this interface, but some features might not work properly.`,
        },
      ]);
    } else {
      setMessages([
        {
          role: "assistant",
          content:
            "👋 Welcome! I'm here to help you develop a strong, consistent brand voice. Let's work together to define your brand's personality and tone.\n\nYou can start by describing your ideal brand voice, or upload examples of content that represents your desired tone. Simply drag and drop files here or use the input below.",
        },
      ]);
    }
  }, [apiKeys.groqApiKey, apiKeys.databaseUrl, apiKeys.exaApiKey])

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, isLoading])

  // Helper function to process text files
  const processTextFile = async (file: File) => {
    setIsLoading(true)
    try {
      // Different handling depending on file type
      let text;
      let sourceType = "text";
      
      if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
          file.name.endsWith(".docx")) {
        // If it's a DOCX file, we still call it a DOCX in the metadata but process as text
        sourceType = "docx";
        text = `Content extracted from ${file.name}\n\n`;
        
        // Try to get some text directly - this won't be ideal but better than nothing
        try {
          // For DOCX files, we need to be cautious as they're binary
          // Create a simple message rather than trying to extract text
          text += `This is a DOCX file named "${file.name}". ` +
                 `It was uploaded on ${new Date().toLocaleString()}. ` +
                 `The file is being processed as plain text, so formatting may be lost.`;
                 
        } catch (e) {
          console.error("Error extracting text from DOCX:", e);
          text += "Content could not be fully extracted. This is a simple text representation.";
        }
      } else {
        // Regular text processing
        text = await file.text();
      }

      // Split text into chunks of approximately 1000 characters with 200 character overlap
      const chunkSize = 1000
      const overlapSize = 200
      const chunks = []

      for (let i = 0; i < text.length; i += chunkSize - overlapSize) {
        const chunk = text.slice(i, i + chunkSize)
        chunks.push(chunk)
      }

      // Create documents from chunks
      // Ensure chunks aren't empty and have reasonable content
      const validChunks = chunks.filter(chunk => chunk && chunk.trim().length > 10);
      
      if (validChunks.length === 0) {
        // If we have no valid chunks, create one with basic info
        validChunks.push(`File: ${file.name} - This file appears to contain no valid text content that could be extracted.`);
      }
      
      const documents = validChunks.map((chunk, index) => ({
        pageContent: chunk,
        metadata: {
          source_type: sourceType,
          file_name: file.name,
          chunk_index: index,
          timestamp: new Date().toISOString(),
        },
      }))

      // Add to PostgreSQL via API with business ID
      try {
        // Add some basic validation and safety checks
        if (!documents || documents.length === 0) {
          throw new Error("No valid documents to process");
        }
        
        const vectorizeResponse = await axios.post("/api/pg-vectorize", {
          documents: documents,
          collectionName: COLLECTION_NAME,
          businessId: businessId,
        });

        if (vectorizeResponse.data.success) {
          const newDoc: ProcessedDocument = {
            id: `text-${Date.now()}`,
            name: file.name,
            type: "text",
            timestamp: new Date().toISOString(),
          }
          setProcessedDocuments((prev) => [...prev, newDoc])
          setAlertMessage(`✅ Added text file: ${file.name}`)
          setTimeout(() => setAlertMessage(null), 3000)
        }
      } catch (vectorizeError) {
        console.error("Vectorization request failed:", vectorizeError);
        setAlertMessage(`❌ Could not process file: ${file.name}. Storage error.`);
        setTimeout(() => setAlertMessage(null), 3000);
      }
    } catch (error) {
      console.error("Error processing text file:", error)
      setAlertMessage(`❌ Error processing file: ${file.name}`)
      setTimeout(() => setAlertMessage(null), 3000)
    } finally {
      setIsLoading(false)
    }
  }
  
  // Process DOCX files (currently disabled - using the text processor instead)
  const processDocxFile = async (file: File) => {
    try {
      // Just use text file processing for now
      await processTextFile(file);
    } catch (error) {
      console.error("Error in DOCX fallback processing:", error);
      setAlertMessage("❌ Could not process this DOCX file");
      setTimeout(() => setAlertMessage(null), 3000);
      setIsLoading(false);
    }
  }

  // Helper functions for document processing
  const processFile = async (file: File) => {
    setIsLoading(true)
    try {
      // Check file type and process accordingly
      if (file.type === "application/pdf") {
        // Process PDF file directly without creating an arrayBuffer
        // const arrayBuffer = await file.arrayBuffer()
        // const blob = new Blob([arrayBuffer])
        // const url = URL.createObjectURL(blob)

        // Use server API to process the PDF
        const formData = new FormData()
        formData.append("file", file)

        const response = await axios.post("/api/pg-process-pdf", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })

        if (response.data.success) {
          // Add to PostgreSQL via API with business ID
          const vectorizeResponse = await axios.post("/api/pg-vectorize", {
            documents: response.data.documents,
            collectionName: COLLECTION_NAME,
            businessId: businessId,
          })

          if (vectorizeResponse.data.success) {
            const newDoc: ProcessedDocument = {
              id: `pdf-${Date.now()}`,
              name: file.name,
              type: "pdf",
              timestamp: new Date().toISOString(),
            }
            setProcessedDocuments((prev) => [...prev, newDoc])
            setAlertMessage(`✅ Added PDF: ${file.name}`)
            setTimeout(() => setAlertMessage(null), 3000)
          }
        }
      } else if (
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.endsWith(".docx")
      ) {
        // Process DOCX file as text file instead since DOCX processing is having issues
        await processTextFile(file)
      } else if (
        file.type === "text/plain" ||
        file.type === "text/markdown" ||
        file.type === "text/csv" ||
        file.type === "text/html" ||
        file.type === "application/json" ||
        file.name.endsWith(".txt") ||
        file.name.endsWith(".md") ||
        file.name.endsWith(".csv") ||
        file.name.endsWith(".html") ||
        file.name.endsWith(".json") ||
        file.name.endsWith(".xml")
      ) {
        await processTextFile(file)
      } else {
        setAlertMessage("❌ Unsupported file type. Please upload PDF, DOCX, or text files.")
        setTimeout(() => setAlertMessage(null), 3000)
      }
    } catch (error) {
      console.error("Error processing file:", error)
      setAlertMessage("❌ Error processing file")
      setTimeout(() => setAlertMessage(null), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  const processWebUrl = async (url: string) => {
    setIsLoading(true)
    try {
      const response = await axios.post("/api/pg-process-url", {
        url,
        collectionName: COLLECTION_NAME,
        businessId: businessId,
      })

      if (response.data.success) {
        const newDoc: ProcessedDocument = {
          id: `url-${Date.now()}`,
          name: url,
          type: "url",
          timestamp: new Date().toISOString(),
        }
        setProcessedDocuments((prev) => [...prev, newDoc])
        setAlertMessage(`✅ Added URL: ${url}`)
        setTimeout(() => setAlertMessage(null), 3000)
      }
    } catch (error) {
      console.error("Error processing URL:", error)
      setAlertMessage("❌ Error processing URL")
      setTimeout(() => setAlertMessage(null), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle file upload events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0])
    }
  }

  const toggleDocumentSelection = (docId: string) => {
    const newSelection = new Set(selectedDocuments)
    if (newSelection.has(docId)) {
      newSelection.delete(docId)
    } else {
      newSelection.add(docId)
    }
    setSelectedDocuments(newSelection)
  }

  const handleDeleteDocument = async (docId: string) => {
    try {
      // Delete from PostgreSQL via API
      await axios.post("/api/pg-delete-document", {
        documentId: docId,
        collectionName: COLLECTION_NAME,
      })

      setProcessedDocuments((prev) => prev.filter((doc) => doc.id !== docId))
      const newSelection = new Set(selectedDocuments)
      newSelection.delete(docId)
      setSelectedDocuments(newSelection)
    } catch (error) {
      console.error("Error deleting document:", error)
    }
  }

  // Message handling
  const handleSendMessage = async () => {
    if (!userInput.trim()) return

    // Add user message to chat
    const userMessage: Message = { role: "user", content: userInput }
    setMessages((prev) => [...prev, userMessage])
    setUserInput("")
    setIsLoading(true)

    try {
      let context = ""
      let docsRetrieved = false

      // Check if required API keys are available
      if (!apiKeys.groqApiKey) {
        console.warn("GROQ API key missing in client, will try to use server-side key")
      }

      // Retrieve relevant documents if RAG is enabled
      if (settings.ragEnabled && !settings.forceWebSearch) {
        if (!apiKeys.databaseUrl) {
          console.warn("Database URL missing in client, will try to use server-side connection")
        }

        try {
          const retrieveResponse = await axios.post("/api/pg-retrieve", {
            query: userInput,
            collectionName: COLLECTION_NAME,
            similarityThreshold: settings.similarityThreshold,
            documentIds: Array.from(selectedDocuments),
            businessId: businessId
          })

          if (retrieveResponse.data.docs && retrieveResponse.data.docs.length > 0) {
            context = retrieveResponse.data.docs.map((doc: { pageContent: string }) => doc.pageContent).join("\n\n")
            docsRetrieved = true
          }
        } catch (err) {
          console.error("Error retrieving documents:", err)
          // Continue execution without retrieved documents
        }
      }

      // Use web search if enabled and no documents found or forced
      if ((settings.useWebSearch && !docsRetrieved) || settings.forceWebSearch) {
        if (!apiKeys.exaApiKey) {
          console.warn("Exa API key missing in client, will try to use server-side key")
        }

        try {
          const webSearchResponse = await axios.post("/api/web-search", {
            query: userInput,
            exaApiKey: apiKeys.exaApiKey,
          })

          if (webSearchResponse.data.results) {
            context = `Web Search Results:\n${webSearchResponse.data.results}`
          }
        } catch (err) {
          console.error("Error during web search:", err)
          // Continue execution without web search results
        }
      }

      // Find relevant memories using semantic search
      let memoryContext = "";
      try {
        const memorySearchResponse = await axios.post('/api/memories-search', {
          query: userInput,
          businessId,
          limit: 3,
          similarityThreshold: 0.6
        });
        
        if (memorySearchResponse.data.success && memorySearchResponse.data.memories.length > 0) {
          memoryContext = "Relevant memories:\n" + memorySearchResponse.data.memories
            .map((mem: Memory) => `- ${mem.content}${mem.type === 'task' ? (mem.isCompleted ? ' (completed)' : ' (not completed)') : ''}`)
            .join("\n");
        }
      } catch (err) {
        console.error("Error retrieving relevant memories:", err);
      }
      
      // Generate response using Groq with both document context and memory context
      let combinedContext = "";
      if (context) combinedContext += `Document context:\n${context}\n\n`;
      if (memoryContext) combinedContext += `${memoryContext}\n\n`;
      
      const promptWithContext = combinedContext
        ? `Context: ${combinedContext}\n\nQuestion: ${userInput}\n\nPlease provide a comprehensive answer based on the available information.`
        : userInput

      console.log("Sending request to Groq with model:", settings.modelVersion);
      const groqResponse = await axios.post("/api/groq", {
        prompt: promptWithContext,
        model: settings.modelVersion,
        groqApiKey: apiKeys.groqApiKey,
      })

      if (groqResponse.data.text) {
        const assistantMessage: Message = {
          role: "assistant",
          content: groqResponse.data.text,
        }
        setMessages((prev) => [...prev, assistantMessage])
      }
    } catch (error: any) {
      console.error("Error generating response:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `I'm sorry, I encountered an error: ${error.message || "Unknown error occurred"}. Please check the console for details and ensure all required API keys are properly set.`,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Get file type icon
  const getDocumentIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return "📄"
      case "docx":
        return "📋"
      case "url":
        return "🌐"
      case "text":
        return "📝"
      default:
        return "📄"
    }
  }
  
  // Current business ID (in a real app, this would come from a context or prop)
  const [businessId] = useState("business-123");

  // Fetch memories from database on component mount
  useEffect(() => {
    const fetchMemories = async () => {
      try {
        const response = await axios.get(`/api/memories?businessId=${businessId}`);
        if (response.data.success) {
          setMemories(response.data.memories);
        }
      } catch (error) {
        console.error('Error fetching memories:', error);
      }
    };
    
    fetchMemories();
  }, [businessId]);
  
  // Memory management functions with API integration
  const addMemory = async (content: string, type: "task" | "summary" | "custom" = "custom") => {
    const newMemory: Memory = {
      id: `mem-${Date.now()}`,
      content,
      timestamp: new Date().toISOString(),
      type,
      isCompleted: type === "task" ? false : undefined
    }
    
    try {
      // Store memory in database with business ID
      const response = await axios.post('/api/memories', {
        ...newMemory,
        businessId
      });
      
      if (response.data.success) {
        setMemories(prev => [newMemory, ...prev]);
        setNewMemoryContent("");
        // Show success message
        setAlertMessage(`✅ Memory added successfully`);
        setTimeout(() => setAlertMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error adding memory:', error);
      setAlertMessage("❌ Error saving memory");
      setTimeout(() => setAlertMessage(null), 3000);
    }
  }
  
  const updateMemory = async (id: string, content: string) => {
    try {
      // Update memory in database
      const response = await axios.patch(`/api/memories?id=${id}&businessId=${businessId}`, { content });
      if (response.data.success) {
        setMemories(prev => 
          prev.map(mem => mem.id === id ? {...mem, content} : mem)
        );
        setEditingMemoryId(null);
      }
    } catch (error) {
      console.error('Error updating memory:', error);
      setAlertMessage("❌ Error updating memory");
      setTimeout(() => setAlertMessage(null), 3000);
    }
  }
  
  const deleteMemory = async (id: string) => {
    try {
      // Delete memory from database
      const response = await axios.delete(`/api/memories?id=${id}&businessId=${businessId}`);
      if (response.data.success) {
        setMemories(prev => prev.filter(mem => mem.id !== id));
        setAlertMessage(`✅ Memory deleted`);
        setTimeout(() => setAlertMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error deleting memory:', error);
      setAlertMessage("❌ Error deleting memory");
      setTimeout(() => setAlertMessage(null), 3000);
    }
  }
  
  const toggleMemoryCompletion = async (id: string) => {
    // First find the memory to get its current completion status
    const memory = memories.find(mem => mem.id === id);
    if (!memory || memory.type !== 'task') return;
    
    try {
      // Toggle completion status in database
      const response = await axios.patch(`/api/memories?id=${id}&businessId=${businessId}`, { 
        isCompleted: !memory.isCompleted 
      });
      
      if (response.data.success) {
        setMemories(prev => 
          prev.map(mem => mem.id === id && mem.type === "task" 
            ? {...mem, isCompleted: !mem.isCompleted} 
            : mem
          )
        );
      }
    } catch (error) {
      console.error('Error updating memory completion:', error);
      setAlertMessage("❌ Error updating task status");
      setTimeout(() => setAlertMessage(null), 3000);
    }
  }
  
  return (
    <div 
      className="h-full min-h-[600px] flex flex-col m-0 p-4 overflow-hidden relative"
      data-tab="brand"
      onDragEnter={handleGlobalDrag}
      onDragOver={handleGlobalDrag}
      onDragLeave={handleGlobalDrag}
      onDrop={handleGlobalDrop}
    >
      {/* File Drop Overlay */}
      {dragActive && (
        <div className="absolute inset-0 bg-[#FF1681]/10 backdrop-blur-sm z-30 border-4 border-[#FF1681] rounded-xl flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl shadow-xl flex flex-col items-center max-w-md">
            <Upload className="h-10 w-10 text-[#FF1681] mb-4" />
            <h3 className="text-xl font-medium text-gray-800 mb-2">Drop to Upload</h3>
            <p className="text-sm text-gray-500 text-center">Release your file to add it to your brand alignment context</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-[250px_1fr] gap-6 h-full max-h-full min-h-0">
        <div className="bg-[#F3F4F6] rounded-xl p-6 space-y-4 flex flex-col h-full max-h-full">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold">Brand Alignment</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full border border-gray-300 hover:bg-gray-100"
              onClick={() => {
                // Clear the user input and add a welcome message
                setUserInput("");
                setMessages([{
                  role: "assistant",
                  content: "👋 Welcome! I'm here to help you develop a strong, consistent brand voice. Let's work together to define your brand's personality and tone."
                }]);
              }}
              aria-label="Reset chat"
              title="Reset chat"
            >
              <RefreshCw className="h-3.5 w-3.5 text-gray-700" />
            </Button>
          </div>

          {/* Settings Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="w-full bg-white border-2 border-black text-black hover:bg-gray-50 flex justify-between items-center"
              >
                <span className="flex items-center">
                  <Settings className="w-4 h-4 mr-2" />
                  Agent Settings
                </span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[280px]" align="start">
              <DropdownMenuLabel>Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {/* Model Selection */}
              <div className="px-2 py-1.5 space-y-1.5">
                <Label htmlFor="model-selection" className="text-xs font-medium">Model Selection</Label>
                <Select
                  value={settings.modelVersion}
                  onValueChange={(value) => setSettings({ ...settings, modelVersion: value })}
                >
                  <SelectTrigger id="model-selection" className="w-full text-sm">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deepseek-r1-distill-llama-70b">deepseek-r1-distill-llama-70b</SelectItem>
                    <SelectItem value="llama3-70b-8192">llama3-70b-8192</SelectItem>
                    <SelectItem value="mixtral-8x7b-32768">mixtral-8x7b-32768</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <DropdownMenuSeparator />
              
              {/* RAG Toggle */}
              <div className="px-2 py-1.5 flex items-center justify-between">
                <Label htmlFor="rag-toggle" className="text-sm">Enable RAG Mode</Label>
                <Switch
                  id="rag-toggle"
                  checked={settings.ragEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, ragEnabled: checked })}
                  className="data-[state=checked]:bg-[#FF1681]"
                />
              </div>
              
              {/* Similarity Threshold (Only visible when RAG is enabled) */}
              {settings.ragEnabled && (
                <div className="px-2 py-1.5 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="similarity-threshold" className="text-xs font-medium">Similarity Threshold</Label>
                    <span className="text-xs text-gray-500">{settings.similarityThreshold.toFixed(1)}</span>
                  </div>
                  <Slider
                    id="similarity-threshold"
                    min={0}
                    max={1}
                    step={0.1}
                    value={[settings.similarityThreshold]}
                    onValueChange={(value) => setSettings({ ...settings, similarityThreshold: value[0] })}
                    className="w-full"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Lower values will return more documents but might be less relevant.
                  </p>
                </div>
              )}
              
              <DropdownMenuSeparator />
              
              {/* Web Search Toggle */}
              <div className="px-2 py-1.5 flex items-center justify-between">
                <Label htmlFor="web-search-toggle" className="text-sm">Web Search Fallback</Label>
                <Switch
                  id="web-search-toggle"
                  checked={settings.useWebSearch}
                  onCheckedChange={(checked) => setSettings({ ...settings, useWebSearch: checked })}
                  className="data-[state=checked]:bg-[#FF1681]"
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Memories Dialog (Document Manager) */}
          <Dialog open={isMemoriesOpen} onOpenChange={setIsMemoriesOpen}>
            <DialogTrigger asChild>
              <Button
                className="w-full bg-white border-2 border-black text-black hover:bg-gray-50"
                onClick={() => setIsMemoriesOpen(true)}
              >
                Memories
              </Button>
            </DialogTrigger>
            <DialogContent 
              className="max-w-md p-0 overflow-visible h-auto" 
              onInteractOutside={() => setIsMemoriesOpen(false)}
              aria-describedby="memories-description"
            >
              <DialogTitle className="sr-only">AI Memories</DialogTitle>
              <DialogDescription id="memories-description" className="sr-only">Manage your brand memories and chat context</DialogDescription>
              <div className="flex flex-col h-full bg-white rounded-xl">
                <div className="px-6 py-4 flex justify-between items-center border-b relative">
                  <h2 className="text-lg font-medium">Memories & Context</h2>
                  <DialogClose asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full absolute right-2 top-2 bg-white border shadow-md hover:bg-gray-50 z-50"
                      onClick={() => setIsMemoriesOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </DialogClose>
                </div>

                <Tabs defaultValue="memories" className="w-full">
                  <TabsList className="grid grid-cols-2 mx-6 mt-2">
                    <TabsTrigger value="memories">Memories</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                  </TabsList>
                  
                  {/* Memories Tab Content */}
                  <TabsContent value="memories" className="p-0">
                    <div className="p-6 space-y-4 overflow-y-auto max-h-[50vh]">
                      {memories.length === 0 ? (
                        <p className="text-center text-gray-500 py-4">
                          No memories yet. Add context or tasks to get started.
                        </p>
                      ) : (
                        memories.map((memory) => (
                          <div
                            key={memory.id}
                            className={`group flex items-start gap-3 p-3 rounded-lg border ${
                              memory.type === 'task' 
                                ? memory.isCompleted 
                                  ? 'bg-gray-50 border-gray-200' 
                                  : 'bg-white border-gray-200' 
                                : memory.type === 'summary' 
                                  ? 'bg-blue-50 border-blue-100' 
                                  : 'bg-amber-50 border-amber-100'
                            } transition-all hover:shadow-md hover:scale-[1.01]`}
                          >
                            {memory.type === 'task' && (
                              <button 
                                onClick={() => toggleMemoryCompletion(memory.id)}
                                className="mt-1"
                              >
                                {memory.isCompleted ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <div className="h-4 w-4 border border-gray-300 rounded-sm" />
                                )}
                              </button>
                            )}
                            
                            <div className="flex-1">
                              {editingMemoryId === memory.id ? (
                                <Textarea
                                  value={memory.content}
                                  onChange={(e) => {
                                    const newContent = e.target.value
                                    setMemories(prev => 
                                      prev.map(mem => mem.id === memory.id ? {...mem, content: newContent} : mem)
                                    )
                                  }}
                                  className="min-h-[60px] text-sm focus:border-[#FF1681] focus:ring-[#FF1681]/20 transition-shadow focus:shadow-[0_0_0_3px_rgba(255,22,129,0.1)]"
                                  autoFocus
                                  onBlur={() => updateMemory(memory.id, memory.content)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault()
                                      updateMemory(memory.id, memory.content)
                                    }
                                  }}
                                />
                              ) : (
                                <div 
                                  className={`text-sm ${memory.type === 'task' && memory.isCompleted ? 'line-through text-gray-500' : ''}`}
                                >
                                  {memory.content}
                                </div>
                              )}
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-gray-500">
                                  {memory.type === 'custom' ? 'Custom' : 
                                   memory.type === 'summary' ? 'Context Summary' : 'Task'}
                                </span>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100"
                                    onClick={() => setEditingMemoryId(memory.id)}
                                  >
                                    <Edit className="h-3 w-3 text-blue-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#FF1681]/10"
                                    onClick={() => deleteMemory(memory.id)}
                                  >
                                    <Trash className="h-3 w-3 text-[#FF1681]" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    
                    <div className="p-6 border-t bg-gray-50">
                      <div className="flex flex-col gap-2">
                        <Textarea
                          placeholder="Add a new memory or task..."
                          value={newMemoryContent}
                          onChange={(e) => setNewMemoryContent(e.target.value)}
                          className="min-h-[60px] text-sm focus:border-[#FF1681] focus:ring-[#FF1681]/20 transition-shadow focus:shadow-[0_0_0_3px_rgba(255,22,129,0.1)]"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey && newMemoryContent.trim()) {
                              e.preventDefault()
                              const isTask = newMemoryContent.toLowerCase().includes('task:') || 
                                          newMemoryContent.toLowerCase().includes('to-do:') || 
                                          newMemoryContent.toLowerCase().includes('todo:')
                              addMemory(newMemoryContent, isTask ? 'task' : 'custom')
                            }
                          }}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="transition-all hover:border-blue-500 hover:text-blue-600"
                            onClick={() => newMemoryContent.trim() && addMemory(newMemoryContent, 'task')}
                          >
                            Add as Task
                          </Button>
                          <Button
                            className="bg-gradient-to-r from-[#FFAB1A] via-[#FF1681] to-[#0080FF] text-white hover:opacity-90 shadow-md hover:shadow-lg transition-shadow"
                            size="sm"
                            onClick={() => newMemoryContent.trim() && addMemory(newMemoryContent, 'custom')}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Memory
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Documents Tab Content */}
                  <TabsContent value="documents" className="p-0">
                    <div className="p-6 space-y-4 overflow-y-auto max-h-[50vh]">
                      {processedDocuments.length === 0 ? (
                        <p className="text-center text-gray-500 py-4">
                          No documents added yet. Upload files to get started.
                        </p>
                      ) : (
                        processedDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className="group flex items-center gap-3 p-3 rounded-lg border bg-white hover:bg-gray-50 transition-all hover:shadow-md hover:scale-[1.01]"
                          >
                            <input
                              type="checkbox"
                              className="h-5 w-5 rounded-md border-gray-300 text-[#FF1681] focus:ring-[#FF1681] transition-shadow focus:shadow-[0_0_0_3px_rgba(255,22,129,0.1)]"
                              checked={selectedDocuments.has(doc.id)}
                              onChange={() => toggleDocumentSelection(doc.id)}
                            />
                            <span className="flex-1 text-sm truncate">
                              {getDocumentIcon(doc.type)} {doc.name}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteDocument(doc.id)
                              }}
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="p-6 border-t bg-gray-50">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter URL to process..."
                          className="flex-1 px-3 py-2 border rounded-lg text-sm focus:border-[#FF1681] focus:ring-[#FF1681]/20 transition-shadow focus:shadow-[0_0_0_3px_rgba(255,22,129,0.1)] focus:outline-none"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const target = e.target as HTMLInputElement
                              processWebUrl(target.value)
                              target.value = ""
                            }
                          }}
                        />
                        <Button
                          className="bg-gradient-to-r from-[#FFAB1A] via-[#FF1681] to-[#0080FF] text-white hover:opacity-90 shadow-md hover:shadow-lg transition-shadow"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.txt,.md,.csv,.html,.json,.xml,.docx,text/plain,text/markdown,text/csv,text/html,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </DialogContent>
          </Dialog>

          {/*/!* Web Search Toggle *!/*/}
          {/*<div className="flex items-center justify-between">*/}
          {/*  <Label htmlFor="force-web-search">Force Web Search</Label>*/}
          {/*  <Switch*/}
          {/*    id="force-web-search"*/}
          {/*    checked={settings.forceWebSearch}*/}
          {/*    onCheckedChange={(checked) => setSettings({ ...settings, forceWebSearch: checked })}*/}
          {/*  />*/}
          {/*</div>*/}

          {/* Document list summary */}
          {processedDocuments.length > 0 && (
            <div className="mt-4 overflow-hidden">
              <h4 className="text-sm font-medium mb-2">Documents ({processedDocuments.length})</h4>
              <div className="space-y-1 max-h-[120px] overflow-y-auto">
                {processedDocuments.slice(0, 5).map((doc) => (
                  <div key={doc.id} className="text-xs text-gray-600 truncate">
                    {getDocumentIcon(doc.type)} {doc.name}
                  </div>
                ))}
                {processedDocuments.length > 5 && (
                  <div className="text-xs text-gray-600">+{processedDocuments.length - 5} more...</div>
                )}
              </div>
            </div>
          )}
          
          {/* File Upload Info - Bottom of Sidebar */}
          <div className="mt-auto">
            <div className="bg-white rounded-md border border-gray-200 px-3 py-2 flex items-center gap-2">
              <Upload className="h-3.5 w-3.5 text-[#FF1681]" />
              <p className="text-xs text-gray-600">Drag files anywhere to upload</p>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="border rounded-xl flex flex-col overflow-hidden h-full min-h-0 max-h-full">
          <div className="flex-1 p-4 overflow-y-auto min-h-0" ref={chatContainerRef}>
            {messages.map((message, index) => (
              <div key={index} className={`flex gap-4 mb-6 ${message.role === "user" ? "flex-row-reverse justify-start" : ""} animate-in fade-in-10 slide-in-from-bottom-5 duration-300`}>
                <div className={`flex-shrink-0 w-10 h-10 rounded-full ${message.role === "user" ? "bg-transparent" : "bg-black"} overflow-hidden flex items-center justify-center`}>
                  {message.role === "assistant" ? (
                    <Image
                      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Dark%20Logo-qzFx0r77gWWhGLXSabVCOiJcKqbKzt.png"
                      alt="AI Assistant"
                      className="w-full h-full object-cover"
                      width={40}
                      height={40}
                    />
                  ) : (
                    <Image
                      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Mask%20group%20(2)%201-5RMiT8g4J4BzlQiRnu7aemEcs324uL.png"
                      alt="User"
                      className="w-full h-full object-cover rounded-full"
                      width={40}
                      height={40}
                    />
                  )}
                </div>
                <div className={`flex flex-col max-w-[80%] ${message.role === "user" ? "items-end" : ""}`}>
                  <div className={`rounded-xl p-4 ${message.role === "assistant" ? "bg-[#F3F4F6]" : "bg-blue-50"}`}>
                    {message.role === "assistant" && message.content.includes("<think>") ? (
                      <div className="space-y-0">
                        {/* Thoughts toggle button */}
                        <button 
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium -mb-1"
                          onClick={(e) => {
                            e.preventDefault();
                            const thoughtsElement = e.currentTarget.nextElementSibling;
                            if (thoughtsElement) {
                              const isVisible = thoughtsElement.classList.contains("block");
                              thoughtsElement.classList.toggle("block", !isVisible);
                              thoughtsElement.classList.toggle("hidden", isVisible);
                              e.currentTarget.textContent = isVisible ? "Show thoughts" : "Hide thoughts";
                            }
                          }}
                        >
                          Show thoughts
                        </button>
                        
                        {/* Thoughts content (hidden by default) */}
                        <div className="hidden py-1 border-l-2 border-gray-200 pl-2 my-1">
                          <p className="text-sm text-gray-500 italic m-0 leading-snug">
                            {message.content
                              .match(/<think>([\s\S]*?)<\/think>/)?.[1] || "No thoughts available"}
                          </p>
                        </div>
                        
                        {/* Main content without the think tags */}
                        <p className="text-black whitespace-pre-line m-0 text-left">
                          {message.content.replace(/<think>[\s\S]*?<\/think>/g, "").trim()}
                        </p>
                      </div>
                    ) : (
                      <p className="text-black whitespace-pre-line">{message.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-black overflow-hidden flex items-center justify-center">
                  <Image
                    src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Dark%20Logo-qzFx0r77gWWhGLXSabVCOiJcKqbKzt.png"
                    alt="AI Assistant"
                    className="w-full h-full object-cover"
                    width={40}
                    height={40}
                  />
                </div>
                <div className="flex flex-col max-w-[80%]">
                  <div className="bg-[#F3F4F6] rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex space-x-1">
                        <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                        <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                        <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                      </div>
                      <p className="text-black">Thinking...</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>


          {/* Input Area */}
          <div className="p-4 border-t shrink-0">
            <div className="flex gap-4 items-center">
              <Textarea
                placeholder="Describe your Brand tone..."
                className="flex-1 resize-none text-base rounded-xl border-gray-200 h-[56px] py-4 focus:border-[#FF1681] focus:ring-[#FF1681]/20 transition-shadow focus:shadow-[0_0_0_3px_rgba(255,22,129,0.1)]"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button
                className="px-8 h-[56px] bg-gradient-to-b from-[#FFAB1A] to-[#FF1681] hover:opacity-90 text-white rounded-full text-base font-medium shrink-0 shadow-md hover:shadow-lg transition-shadow"
                onClick={handleSendMessage}
                disabled={isLoading}
              >
                {isLoading ? 
                  <div className="flex items-center">
                    <div className="h-2 w-2 bg-white rounded-full animate-pulse mr-2"></div>
                    <span>Sending...</span>
                  </div> 
                : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Alert message */}
      {alertMessage && (
        <div className="fixed bottom-4 right-4 z-50">
          <Alert className="max-w-md shadow-lg animate-in slide-in-from-bottom-5 fade-in-20 duration-300">
            <AlertDescription>{alertMessage}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}

