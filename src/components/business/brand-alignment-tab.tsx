"use client"

import React, { useState, useEffect, useRef } from "react"

import Link from "next/link"
import {
    Upload,
    Edit,
    Trash,
    Plus,
    Check,
    Settings,
    RefreshCw
} from "lucide-react"
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
import PostCard from "@/components/PostCard"
import { getGroqChatCompletion } from "@/services/groq-service"
import { prePrompt } from "@/prompts/pre-prompt"
import { promptTemplate } from "@/prompts/prompt-template"

// Define types
type Message = {
    role: "user" | "assistant";
    content: React.ReactNode;
}

type ProcessedDocument = {
    id: string;
    name: string;
    type: "pdf" | "url" | "text" | "docx";
    timestamp: string;
}

type Memory = {
    id: string;
    content: string;
    timestamp: string;
    type: "task" | "summary" | "custom";
    isCompleted?: boolean;
}

type RagSettings = {
    modelVersion: string;
    ragEnabled: boolean;
    similarityThreshold: number;
    useWebSearch: boolean;
    forceWebSearch: boolean;
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

type UploadedFile = {
    name: string;
    type: string;
    size: number;
    url: string;
    content?: string;
}

export function BrandAlignmentTab({ onOpenSettings, userProfilePicture }: { onOpenSettings: (tab: string, highlight: string) => void, userProfilePicture?: string }) {
    // Constants
    const COLLECTION_NAME = "brand-alignment-rag";
    const businessId = "business-123"; // In a real app, this would come from context or props

    // State variables
    const [isMemoriesOpen, setIsMemoriesOpen] = useState(false);
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
    ]);
    const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
    const [newMemoryContent, setNewMemoryContent] = useState("");
    const [userInput, setUserInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [processedDocuments, setProcessedDocuments] = useState<ProcessedDocument[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
    const [settings, setSettings] = useState<RagSettings>({
        modelVersion: "deepseek-r1-distill-llama-70b",
        ragEnabled: true,
        similarityThreshold: 0.7,
        useWebSearch: false,
        forceWebSearch: false,
    });
    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [uploadedContent, setUploadedContent] = useState<UploadedFile[]>([]);
    const [postSettings, setPostSettings] = useState<PostSettings>({
        tone: 'Professional',
        type: 'Property Listing',
        platforms: []
    });

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Drag and drop handlers
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

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    // File processing functions
    const processTextFile = async (file: File) => {
        setIsLoading(true);
        try {
            let text: string;
            let sourceType: string = "text";

            if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                file.name.endsWith(".docx")) {
                sourceType = "docx";
                text = `Content extracted from ${file.name}\n\n`;

                try {
                    text += `This is a DOCX file named "${file.name}". ` +
                        `It was uploaded on ${new Date().toLocaleString()}. ` +
                        `The file is being processed as plain text, so formatting may be lost.`;
                } catch (e) {
                    console.error("Error extracting text from DOCX:", e);
                    text += "Content could not be fully extracted. This is a simple text representation.";
                }
            } else {
                text = await file.text();
            }

            // Split text into chunks
            const chunkSize = 1000;
            const overlapSize = 200;
            const chunks = [];

            for (let i = 0; i < text.length; i += chunkSize - overlapSize) {
                const chunk = text.slice(i, i + chunkSize);
                chunks.push(chunk);
            }

            const validChunks = chunks.filter(chunk => chunk && chunk.trim().length > 10);

            if (validChunks.length === 0) {
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
            }));

            try {
                if (!documents || documents.length === 0) {
                    throw new Error("No valid documents to process");
                }

                const vectorizeResponse = await axios.post("/api/pg-vectorize", {
                    documents: documents,
                    collectionName: COLLECTION_NAME,
                    businessId: businessId,
                }, { withCredentials: true });

                if (vectorizeResponse.data.success) {
                    const newDoc: ProcessedDocument = {
                        id: `text-${Date.now()}`,
                        name: file.name,
                        type: sourceType === "docx" ? "docx" : "text",
                        timestamp: new Date().toISOString(),
                    };
                    setProcessedDocuments((prev) => [...prev, newDoc]);
                    setAlertMessage(`✅ Added text file: ${file.name}`);
                    setTimeout(() => setAlertMessage(null), 3000);
                }
            } catch (vectorizeError) {
                console.error("Vectorization request failed:", vectorizeError);
                setAlertMessage(`❌ Could not process file: ${file.name}. Storage error.`);
                setTimeout(() => setAlertMessage(null), 3000);
            }
        } catch (error) {
            console.error("Error processing text file:", error);
            setAlertMessage(`❌ Error processing file: ${file.name}`);
            setTimeout(() => setAlertMessage(null), 3000);
        } finally {
            setIsLoading(false);
        }
    };

    const processDocxFile = async (file: File) => {
        try {
            await processTextFile(file);
        } catch (error) {
            console.error("Error in DOCX fallback processing:", error);
            setAlertMessage("❌ Could not process this DOCX file");
            setTimeout(() => setAlertMessage(null), 3000);
            setIsLoading(false);
        }
    };

    const processFile = async (file: File) => {
        setIsLoading(true);
        try {
            if (file.type === "application/pdf") {
                const formData = new FormData();
                formData.append("file", file);

                const response = await axios.post("/api/pg-process-pdf", formData, {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                    withCredentials: true
                });

                if (response.data.success) {
                    const vectorizeResponse = await axios.post("/api/pg-vectorize", {
                        documents: response.data.documents,
                        collectionName: COLLECTION_NAME,
                        businessId: businessId,
                    }, { withCredentials: true });

                    if (vectorizeResponse.data.success) {
                        const newDoc: ProcessedDocument = {
                            id: `pdf-${Date.now()}`,
                            name: file.name,
                            type: "pdf",
                            timestamp: new Date().toISOString(),
                        };
                        setProcessedDocuments((prev) => [...prev, newDoc]);
                        setAlertMessage(`✅ Added PDF: ${file.name}`);
                        setTimeout(() => setAlertMessage(null), 3000);
                    }
                }
            } else if (
                file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                file.name.endsWith(".docx")
            ) {
                await processTextFile(file);
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
                await processTextFile(file);
            } else {
                setAlertMessage("❌ Unsupported file type. Please upload PDF, DOCX, or text files.");
                setTimeout(() => setAlertMessage(null), 3000);
            }
        } catch (error) {
            console.error("Error processing file:", error);
            setAlertMessage("❌ Error processing file");
            setTimeout(() => setAlertMessage(null), 3000);
        } finally {
            setIsLoading(false);
        }
    };

    const processWebUrl = async (url: string) => {
        setIsLoading(true);
        try {
            const response = await axios.post("/api/pg-process-url", {
                url,
                collectionName: COLLECTION_NAME,
                businessId: businessId,
            }, { withCredentials: true });

            if (response.data.success) {
                const newDoc: ProcessedDocument = {
                    id: `url-${Date.now()}`,
                    name: url,
                    type: "url",
                    timestamp: new Date().toISOString(),
                };
                setProcessedDocuments((prev) => [...prev, newDoc]);
                setAlertMessage(`✅ Added URL: ${url}`);
                setTimeout(() => setAlertMessage(null), 3000);
            }
        } catch (error) {
            console.error("Error processing URL:", error);
            setAlertMessage("❌ Error processing URL");
            setTimeout(() => setAlertMessage(null), 3000);
        } finally {
            setIsLoading(false);
        }
    };

    // File upload handlers
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const newUploadedContent: UploadedFile[] = [];
        for (const file of Array.from(files)) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await axios.post('/api/upload', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    },
                    withCredentials: true
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

    // Document management
    const toggleDocumentSelection = (docId: string) => {
        const newSelection = new Set(selectedDocuments);
        if (newSelection.has(docId)) {
            newSelection.delete(docId);
        } else {
            newSelection.add(docId);
        }
        setSelectedDocuments(newSelection);
    };

    const handleDeleteDocument = async (docId: string) => {
        try {
            await axios.post("/api/pg-delete-document", {
                documentId: docId,
                collectionName: COLLECTION_NAME,
            });

            setProcessedDocuments((prev) => prev.filter((doc) => doc.id !== docId));
            const newSelection = new Set(selectedDocuments);
            newSelection.delete(docId);
            setSelectedDocuments(newSelection);
        } catch (error) {
            console.error("Error deleting document:", error);
        }
    };

    // Settings handlers
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

    // Post generation
    const handleGeneratePosts = async () => {
        if (!userInput.trim() && uploadedContent.length === 0) {
            return;
        }

        setShowSettings(false);
        setIsLoading(true);
        setPosts([]);

        const prompt = promptTemplate(userInput, postSettings, JSON.stringify(uploadedContent));
        const fullPrompt = `${prePrompt}\n\n${prompt}\n\nUploaded files: ${JSON.stringify(uploadedContent)}`;

        setMessages([]);
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
        if (!userInput.trim()) return;

        const userMessage: Message = { role: "user", content: userInput };
        setMessages((prev) => [...prev, userMessage]);
        setUserInput("");
        setIsLoading(true);

        if (userInput.toLowerCase().includes("generate posts") || userInput.toLowerCase().includes("create posts")) {
            await handleGeneratePosts();
            return;
        }

        try {
            let context = "";
            let docsRetrieved = false;

            let groqApiKey = "";
            let openrouterApiKey = "";
            let modelVersion = "groq/llama3-8b-8192";

            // Fetch model settings from the database
            try {
                const userSettingsResponse = await axios.get('/api/user-settings', { withCredentials: true });
                if (userSettingsResponse.data.success) {
                    const settings = userSettingsResponse.data.settings;
                    groqApiKey = settings.groqApiKey || "";
                    openrouterApiKey = settings.openrouterApiKey || "";
                    modelVersion = settings.modelVersion || "groq/llama3-8b-8192";
                }
            } catch (err) {
                console.error("Error fetching user settings:", err);
            }

            if (settings.ragEnabled && !settings.forceWebSearch) {
                if (!localStorage.getItem('DATABASE_URL')) {
                    console.warn("Database URL missing in client, will try to use server-side connection");
                }

                try {
                    const retrieveResponse = await axios.post("/api/pg-retrieve", {
                        query: userInput,
                        collectionName: COLLECTION_NAME,
                        similarityThreshold: settings.similarityThreshold,
                        documentIds: Array.from(selectedDocuments),
                        businessId: businessId
                    }, { withCredentials: true });

                    if (retrieveResponse.data.docs && retrieveResponse.data.docs.length > 0) {
                        context = retrieveResponse.data.docs.map((doc: {
                            pageContent: string;
                        }) => doc.pageContent).join("\n\n");
                        docsRetrieved = true;
                    }
                } catch (err) {
                    console.error("Error retrieving documents:", err);
                }
            }

            if ((settings.useWebSearch && !docsRetrieved) || settings.forceWebSearch) {
                if (!openrouterApiKey) {
                    console.warn("OpenRouter API key missing in client, will try to use server-side key");
                }

                try {
                    const webSearchResponse = await axios.post("/api/web-search", {
                    query: userInput,
                    exaApiKey: openrouterApiKey,
                }, { withCredentials: true });

                    if (webSearchResponse.data.results) {
                        context = `Web Search Results:\n${webSearchResponse.data.results}`;
                    }
                } catch (err) {
                    console.error("Error during web search:", err);
                }
            }

            let memoryContext = "";
            try {
                const memorySearchResponse = await axios.post('/api/memories-search', {
                query: userInput,
                businessId,
                limit: 3,
                similarityThreshold: 0.6
            }, { withCredentials: true });

                if (memorySearchResponse.data.success && memorySearchResponse.data.memories.length > 0) {
                    memoryContext = "Relevant memories:\n" + memorySearchResponse.data.memories
                        .map((mem: Memory) => `- ${mem.content}${mem.type === 'task' ? (mem.isCompleted ? ' (completed)' : ' (not completed)') : ''}`)
                        .join("\n");
                }
            } catch (err) {
                console.error("Error retrieving relevant memories:", err);
            }

            let combinedContext = "";
            if (context) combinedContext += `Document context:\n${context}\n\n`;
            if (memoryContext) combinedContext += `${memoryContext}\n\n`;

            const promptWithContext = combinedContext
                ? `Context: ${combinedContext}\n\nQuestion: ${userInput}\n\nPlease provide a comprehensive answer based on the available information.`
                : userInput;

            console.log("Sending request to Groq with model:", modelVersion);
            const groqResponse = await axios.post("/api/groq", {
                prompt: promptWithContext,
                model: modelVersion,
                groqApiKey: groqApiKey,
            }, { withCredentials: true });

            if (groqResponse.data.text) {
                const assistantMessage: Message = {
                    role: "assistant",
                    content: groqResponse.data.text,
                };
                setMessages((prev) => [...prev, assistantMessage]);
            }
        } catch (error: any) {
            console.error("Error generating response:", error);
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: `I'm sorry, I encountered an error: ${error.message || "Unknown error occurred"}. Please check the console for details and ensure all required API keys are properly set.`,
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Utility functions
    const getDocumentIcon = (type: string) => {
        switch (type) {
            case "pdf":
                return "📄";
            case "docx":
                return "📋";
            case "url":
                return "🌐";
            case "text":
                return "📝";
            default:
                return "📄";
        }
    };

    // Memory management functions
    const addMemory = async (content: string, type: "task" | "summary" | "custom" = "custom") => {
        const newMemory: Memory = {
            id: `mem-${Date.now()}`,
            content,
            timestamp: new Date().toISOString(),
            type,
            isCompleted: type === "task" ? false : undefined
        };

        try {
            const response = await axios.post('/api/memories', {
                ...newMemory,
                businessId
            }, { withCredentials: true });

            if (response.data.success) {
                setMemories(prev => [newMemory, ...prev]);
                setNewMemoryContent("");
                setAlertMessage(`✅ Memory added successfully`);
                setTimeout(() => setAlertMessage(null), 3000);
            }
        } catch (error) {
            console.error('Error adding memory:', error);
            setAlertMessage("❌ Error saving memory");
            setTimeout(() => setAlertMessage(null), 3000);
        }
    };

    const updateMemory = async (id: string, content: string) => {
        try {
            const response = await axios.patch(`/api/memories?id=${id}&businessId=${businessId}`, { content }, { withCredentials: true });
            if (response.data.success) {
                setMemories(prev =>
                    prev.map(mem => mem.id === id ? { ...mem, content } : mem)
                );
                setEditingMemoryId(null);
            }
        } catch (error) {
            console.error('Error updating memory:', error);
            setAlertMessage("❌ Error updating memory");
            setTimeout(() => setAlertMessage(null), 3000);
        }
    };

    const deleteMemory = async (id: string) => {
        try {
            const response = await axios.delete(`/api/memories?id=${id}&businessId=${businessId}`, { withCredentials: true });
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
    };

    const toggleMemoryCompletion = async (id: string) => {
        const memory = memories.find(mem => mem.id === id);
        if (!memory || memory.type !== 'task') return;

        try {
            const response = await axios.patch(`/api/memories?id=${id}&businessId=${businessId}`, {
                isCompleted: !memory.isCompleted
            }, { withCredentials: true });

            if (response.data.success) {
                setMemories(prev =>
                    prev.map(mem => mem.id === id && mem.type === "task"
                        ? { ...mem, isCompleted: !mem.isCompleted }
                        : mem
                    )
                );
            }
        } catch (error) {
            console.error('Error updating memory completion:', error);
            setAlertMessage("❌ Error updating task status");
            setTimeout(() => setAlertMessage(null), 3000);
        }
    };

    // Effects
    useEffect(() => {
        const missingKeys = [];
        const modelVersion = localStorage.getItem('MODEL_VERSION') || "groq/llama3-8b-8192";

        if (modelVersion.includes("groq")) {
            if (!localStorage.getItem('OPENROUTER_API_KEY')) missingKeys.push("OpenRouter API Key");
        } else if (modelVersion.includes("openrouter")) {
            if (!localStorage.getItem('OPENROUTER_API_KEY')) missingKeys.push("OpenRouter API Key");
        } else if (modelVersion.includes("ollama")) {
            // Ollama typically runs locally and doesn't require an API key
            // but if a custom endpoint is configured that requires auth, this would be checked here.
        }

        if (missingKeys.length > 0) {
            setMessages([
                {
                    role: "assistant",
                    content: <>
                        ⚠️ To use the selected model, the following API keys are missing: {missingKeys.join(", ")}.
                        Please configure them in your <a href="#" onClick={(e) => { e.preventDefault(); onOpenSettings("api-settings", "model-settings"); }} className="underline text-blue-500 hover:text-blue-700">Profile Settings &gt; API Settings</a>.
                        <br /><br />
                        You can still use this interface, but some features might not work properly.
                        <br /><br />
                        <Button onClick={() => onOpenSettings("api-settings", "model-settings")}>Choose a Model & Provide Details</Button>
                    </>,
                },
            ]);
        } else {
            setMessages([
                {
                    role: "assistant",
                    content: "👋 Welcome! I'm here to help you develop a strong, consistent brand voice. Let's work together to define your brand's personality and tone.\n\nYou can start by describing your ideal brand voice, or upload examples of content that represents your desired tone. Simply drag and drop files here or use the input below.",
                },
            ]);
        }
    }, [onOpenSettings]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

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

    return (
        <div className="flex flex-col h-full">
            <main className="flex-1 flex flex-col">
                <div className="card messaging-area flex-1">
                    <div className="chat-area">
                        <div className="chat-messages" ref={chatContainerRef}>
                            {messages.map((message, index) => (
                                <div className={`message-container ${message.role === 'user' ? 'sent' : 'received'}`}>
                                    <div className="avatar">
                                        <Image 
                                            src={message.role === 'user' ? (userProfilePicture || '/default-avatar.png') : '/favicon.ico'}
                                            alt={`${message.role} avatar`}
                                            width={40}
                                            height={40}
                                            className="rounded-full"
                                        />
                                    </div>
                                    <div className={`message ${message.role === 'user' ? 'sent' : 'received'}`} key={index}>
                                        {message.content}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="text-center p-4">
                                    <RefreshCw className="animate-spin h-5 w-5 mx-auto" />
                                </div>
                            )}
                        </div>
                        <div className="message-input">
                            <button className="upload-btn" onClick={handleUploadClick}>
                                <Upload size={20} />
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                            </button>
                            <button className="settings-btn" onClick={() => onOpenSettings("api-settings", "model-settings")}>
                                <Settings size={20} />
                            </button>
                            <input
                                type="text"
                                placeholder="Type your message..."
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            <button onClick={handleSendMessage}>Send</button>
                        </div>
                    </div>
                </div>
            </main>
            <style jsx>{`
                .card {
                    background-color: white;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                .messaging-area {
                    display: flex;
                    height: 100%;
                }

                .contacts-list {
                    width: 25%;
                    border-right: 1px solid #e0e0e0;
                    overflow-y: auto;
                }

                .contact-item {
                    padding: 10px;
                    cursor: pointer;
                    border-bottom: 1px solid #e0e0e0;
                }

                .contact-item:hover {
                    background-color: #f5f5f5;
                }

                .chat-area {
                    display: flex;
                    flex-direction: column;
                }

                .chat-messages {
                    flex-grow: 1;
                    overflow-y: auto;
                    padding: 10px;
                    display: flex;
                    flex-direction: column;
                }

                .message-container {
                    display: flex;
                    align-items: flex-start;
                    margin-bottom: 10px;
                }

                .message-container.sent {
                    flex-direction: row-reverse;
                }

                .avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    margin: 0 10px;
                }

                .message {
                    padding: 8px 12px;
                    border-radius: 18px;
                    max-width: 70%;
                }

                .message.received {
                    background-color: #e0e0e0;
                }

                .message.sent {
                    background-color: #0a66c2;
                    color: white;
                }

                .message-input {
                    display: flex;
                    align-items: center; 
                    padding: 10px;
                    border-top: 1px solid #e0e0e0;
                }

                .upload-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 8px;
                    margin-right: 8px;
                }

                .settings-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 8px;
                    margin-right: 8px;
                }

                .message-input input {
                    flex-grow: 1;
                    padding: 10px;
                    border: 1px solid #e0e0e0;
                    border-radius: 20px;
                }

                .message-input button {
                    margin-left: 10px;
                    padding: 10px 20px;
                    border: none;
                    background-color: #0a66c2;
                    color: white;
                    border-radius: 20px;
                    cursor: pointer;
                }

                .ai-suggestions {
                    padding: 10px;
                    background-color: #f9f9f9;
                    border-top: 1px solid #e0e0e0;
                }

                .ai-suggestion {
                    display: inline-block;
                    margin: 5px;
                    padding: 5px 10px;
                    background-color: #e0e0e0;
                    border-radius: 15px;
                    cursor: pointer;
                }
            `}</style>
        </div>
    );
}
