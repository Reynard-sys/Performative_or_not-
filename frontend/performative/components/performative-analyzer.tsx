"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Upload, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

interface AnalysisResult {
  rating: number;
  explanation: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function PerformativeAnalyzer() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleImageUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Image = e.target?.result as string;
      setUploadedImage(base64Image);
      setResult(null);
      setChatMessages([]);

      await analyzeImage(base64Image);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (base64Image: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: base64Image }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze image");
      }

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Analysis error:", error);
      setResult({
        rating: 0,
        explanation: "Failed to analyze the image. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !uploadedImage) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput,
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: uploadedImage,
          message: chatInput,
          conversation_history: chatMessages,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.response,
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Failed to process your message. Please try again.",
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) {
      handleImageUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold tracking-tight text-foreground mb-3 leading-tight">
          Performative or Not?
        </h1>
        <p className="text-sm text-muted-foreground font-light">
          Upload a picture to discover how performative it really is
        </p>
      </div>

      <div className="flex flex-col items-center gap-8">
        {!uploadedImage && !result && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full max-w-lg p-12 border-2 rounded-3xl transition-all duration-300 cursor-pointer ${
              isDragging
                ? "border-primary bg-primary/5 shadow-lg shadow-primary/20"
                : "border-border bg-card hover:shadow-md hover:shadow-primary/10 hover:border-primary/30"
            }`}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-primary/10 rounded-full">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-light text-foreground/70 mb-6">
                  Upload a picture to check how performative it is
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full px-8 py-2 transition-all duration-200"
                >
                  Upload Image
                </Button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {uploadedImage && isLoading && (
          <div className="flex flex-col items-center gap-8 animate-in fade-in duration-300">
            <div className="relative w-full max-w-md aspect-square rounded-3xl overflow-hidden shadow-xl shadow-black/10">
              <Image
                src={uploadedImage || "/placeholder.svg"}
                alt="Uploaded"
                fill
                className="object-cover"
              />
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20 rounded-full animate-soft-shimmer"></div>
              <span className="text-sm font-light text-muted-foreground">
                Analyzing your image...
              </span>
            </div>
          </div>
        )}

        {uploadedImage && !isLoading && result && (
          <div className="w-full animate-in fade-in duration-300">
            <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-start lg:justify-center">
              <div className="flex-shrink-0 w-full lg:w-56">
                <div className="relative aspect-square rounded-3xl overflow-hidden shadow-lg shadow-black/10 transition-all duration-500">
                  <Image
                    src={uploadedImage || "/placeholder.svg"}
                    alt="Uploaded"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>

              <div className="flex-1 w-full lg:w-auto max-w-md">
                <div className="bg-card rounded-3xl shadow-lg shadow-black/5 p-8 border border-border hover:shadow-xl hover:shadow-black/10 transition-shadow duration-300 flex flex-col h-full">
                  <div className="mb-8">
                    <div className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium uppercase tracking-wide mb-6">
                      Performativity Score
                    </div>

                    <div className="mb-4">
                      <div className="text-6xl font-bold text-foreground">
                        {result.rating}
                        <span className="text-3xl text-muted-foreground font-light ml-2">
                          /10
                        </span>
                      </div>
                      <div className="h-1.5 w-20 bg-gradient-to-r from-primary/30 to-primary rounded-full mt-4"></div>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                      Analysis
                    </h3>
                    <div className="text-sm font-light text-foreground/80 leading-relaxed prose prose-invert">
                      <ReactMarkdown>{result.explanation}</ReactMarkdown>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 mb-6">
                    {chatMessages.length > 0 && (
                      <div className="flex flex-col gap-4 max-h-64 overflow-y-auto pr-2">
                        {chatMessages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`flex ${
                              msg.role === "user"
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-xs px-4 py-2 rounded-2xl text-sm font-light prose prose-invert ${
                                msg.role === "user"
                                  ? "bg-primary/10 text-foreground rounded-br-none"
                                  : "bg-background border border-border text-foreground rounded-bl-none"
                              }`}
                            >
                              <ReactMarkdown>
                                {msg.content.replace(/\\n/g, "\n")}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ))}
                        <div ref={chatEndRef} />
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleChatSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask a follow-up question..."
                      disabled={isChatLoading}
                      className="flex-1 px-4 py-2 rounded-full bg-background border border-border text-sm font-light text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                    />
                    <Button
                      type="submit"
                      disabled={isChatLoading || !chatInput.trim()}
                      className="p-2 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200 disabled:opacity-50"
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  </form>

                  <div className="pt-6 border-t border-border mt-6">
                    <Button
                      onClick={() => {
                        setUploadedImage(null);
                        setResult(null);
                        setChatMessages([]);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      variant="outline"
                      className="w-full border-border hover:bg-primary/5 hover:border-primary/30 text-foreground font-light rounded-full transition-all duration-200"
                    >
                      Analyze Another Image
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
