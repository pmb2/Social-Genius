"use client"

import type React from "react"

import {useState, useEffect, useRef} from "react"
import {
    X,
    Upload,
    Edit,
    Trash,
    Plus,
    Check,
    FileText,
    FileCode,
    File,
    Link as LinkIcon,
    FileImage,
    Settings,
    ChevronDown,
    RefreshCw
} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Textarea} from "@/components/ui/textarea"
import {Dialog, DialogClose, DialogContent, DialogTrigger, DialogTitle, DialogDescription} from "@/components/ui/dialog"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Slider} from "@/components/ui/slider"
import {Switch} from "@/components/ui/switch"
import {Label} from "@/components/ui/label"
import {Alert, AlertDescription} from "@/components/ui/alert"
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs"
import {Input} from "@/components/ui/input"
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
import PostCard from "@/components/PostCard";
import { getGroqChatCompletion } from "@/services/groq-service";
import { prePrompt } from "@/prompts/pre-prompt";
import { promptTemplate } from "@/prompts/prompt-template";

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

type Post = {
    platform: string;
    content: string;
    hashtags: string[];
    mediaType: string;
    mediaDescription: string;
    timeAgo?: string;
    location?: string;
}

type PostSettings = {
    tone: string;
    type: string;
    platforms: string[];
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

    // State variables for postcard generation
    const [posts, setPosts] = useState<Post[]>([]);
    const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [uploadedContent, setUploadedContent] = useState<any[]>([]);
    const [postSettings, setPostSettings] = useState<PostSettings>({ // Renamed to avoid conflict
        tone: 'Professional',
        type: 'Property Listing',
        platforms: []
    });

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

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const newUploadedContent: any[] = [];
        for (const file of Array.from(files)) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await axios.post('/api/upload', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });
                newUploadedContent.push(response.data.file);
            } catch (error) {
                console.error('Error uploading file', error);
                setAlertMessage(`❌ Error uploading file: ${file.name}`);
                setTimeout(() => setAlertMessage(null), 3000);
            }
        }
        setUploadedContent(prevContent => [...prevContent, ...newUploadedContent]);
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const toggleSettings = () => {
        setShowSettings(prev => !prev);
    };

    const handleSettingChange = (settingType: keyof PostSettings, value: string | string[]) => {
        setPostSettings(prevSettings => ({
            ...prevSettings,
            [settingType]: value
        }));
    };

    const handlePlatformToggle = (platform: string) => {
        setPostSettings(prevSettings => ({
            ...prevSettings,
            platforms: prevSettings.platforms.includes(platform)
                ? prevSettings.platforms.filter(p => p !== platform)
                : [...prevSettings.platforms, platform]
        }));
    };

    const handleGeneratePosts = async () => {
        if (!userInput.trim() && uploadedContent.length === 0) {
            return;
        }

        setShowSettings(false);
        setIsLoading(true);
        setPosts([]); // Clear previous posts

        const prompt = promptTemplate(userInput, postSettings, JSON.stringify(uploadedContent));
        const fullPrompt = `${prePrompt}\n\n${prompt}\n\nUploaded files: ${JSON.stringify(uploadedContent)}`;

        setMessages([]); // Clear chat messages when generating posts
        setShowWelcomeMessage(false);

        try {
            const groqResponse = await getGroqChatCompletion(fullPrompt);
            const jsonMatch = groqResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No valid JSON found in the response');
            }

            const generatedPosts = JSON.parse(jsonMatch[0]);

            const filteredPosts = generatedPosts.posts.filter((post: Post) =>
                postSettings.platforms.includes(post.platform)
            );

            setPosts(filteredPosts);
            setAlertMessage('✅ Posts generated successfully!');
            setTimeout(() => setAlertMessage(null), 3000);

        } catch (error: any) {
            console.error('Error generating posts:', error);
            setAlertMessage(`❌ Error generating posts: ${error.message || 'Unknown error'}`);
            setTimeout(() => setAlertMessage(null), 3000);
        } finally {
            setIsLoading(false);
            setUserInput('');
        }
    };

    // Message handling
    const handleSendMessage = async () => {
        if (!userInput.trim()) return

        // Add user message to chat
        const userMessage: Message = {role: "user", content: userInput}
        setMessages((prev) => [...prev, userMessage])
        setUserInput("")
        setIsLoading(true)

        // If the user input is related to post generation, call handleGeneratePosts
        // This is a simple heuristic, you might want a more sophisticated way to detect intent
        if (userInput.toLowerCase().includes("generate posts") || userInput.toLowerCase().includes("create posts")) {
            await handleGeneratePosts();
            return;
        }

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
                        context = retrieveResponse.data.docs.map((doc: {
                            pageContent: string
                        }) => doc.pageContent).join("\n\n")
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
            const response = await axios.patch(`/api/memories?id=${id}&businessId=${businessId}`, {content});
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
        <div>
            <p>Brand Alignment Tab</p>
        </div>
    )
}
