"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, FileText, ChevronDown, X, Paperclip, Loader2 } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    document_id: string;
    filename: string;
    score: number;
    excerpt: string;
  }>;
  isStreaming?: boolean;
}

const SUGGESTED_QUESTIONS = [
  "Summarize all contracts expiring this quarter",
  "What are the key deliverables in our product roadmap?",
  "Find all invoices over $10,000 from last month",
  "What action items were identified in the board meeting?",
];

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your DocuFlow AI assistant. I can answer questions about any of your documents, find information across your entire knowledge base, and help you make sense of complex documents. What would you like to know?",
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pinnedDocs, setPinnedDocs] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Add streaming assistant message
    const assistantMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      isStreaming: true,
    }]);

    try {
      // Simulate streaming response (replace with actual API call)
      const mockResponse = await simulateAIResponse(messageText);

      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId
          ? { ...m, content: mockResponse.answer, sources: mockResponse.sources, isStreaming: false }
          : m
      ));
    } catch (e) {
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId
          ? { ...m, content: "Sorry, I encountered an error. Please try again.", isStreaming: false }
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-50">
      {/* Chat Header */}
      <div className="bg-white border-b border-surface-200 px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <div className="w-9 h-9 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center">
          <Sparkles size={18} className="text-white" />
        </div>
        <div>
          <h2 className="font-display font-semibold text-ink-500">Ask Your Documents</h2>
          <p className="text-xs text-ink-100">12,483 documents indexed · Semantic search enabled</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            All docs
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {/* Suggested questions (only show when first message) */}
        {messages.length === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-3 max-w-2xl mx-auto"
          >
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-left p-4 bg-white border border-surface-200 rounded-xl hover:border-brand-300 hover:shadow-card transition-all text-sm text-ink-400 hover:text-ink-500 group"
              >
                <Sparkles size={14} className="mb-2 text-brand-400 group-hover:text-brand-500" />
                {q}
              </button>
            ))}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-surface-200 p-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="relative flex items-end bg-surface-50 rounded-2xl border border-surface-200 focus-within:border-brand-300 focus-within:shadow-glow transition-all">
            <button className="p-3 text-ink-100 hover:text-ink-400 transition-colors flex-shrink-0">
              <Paperclip size={18} />
            </button>
            <TextareaAutosize
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask anything about your documents..."
              minRows={1}
              maxRows={6}
              className="flex-1 bg-transparent resize-none outline-none py-3 text-sm text-ink-500 placeholder-ink-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="m-2 p-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 shadow-brand"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <p className="text-xs text-ink-50 text-center mt-2">
            AI responses are based on your documents. Press Enter to send, Shift+Enter for new line.
          </p>
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: Message }) {
  const [showSources, setShowSources] = useState(false);
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"} max-w-4xl mx-auto w-full`}
    >
      {!isUser && (
        <div className="w-8 h-8 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center flex-shrink-0 mr-3 mt-0.5">
          <Sparkles size={14} className="text-white" />
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-2`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-brand-500 text-white rounded-br-sm"
            : "bg-white border border-surface-200 text-ink-500 rounded-bl-sm shadow-card"
        }`}>
          {message.isStreaming ? (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="w-full">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1.5 text-xs text-ink-100 hover:text-ink-400 transition-colors"
            >
              <FileText size={12} />
              {message.sources.length} source{message.sources.length > 1 ? "s" : ""} referenced
              <ChevronDown size={12} className={`transition-transform ${showSources ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {showSources && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 space-y-2"
                >
                  {message.sources.map((source, i) => (
                    <div key={i} className="bg-white border border-surface-200 rounded-xl p-3 text-xs">
                      <div className="flex items-center gap-2 mb-1.5">
                        <FileText size={12} className="text-brand-500" />
                        <span className="font-medium text-ink-500 truncate">{source.filename}</span>
                        <span className="ml-auto text-ink-50 bg-surface-100 px-1.5 py-0.5 rounded-md">
                          {Math.round(source.score * 100)}% match
                        </span>
                      </div>
                      <p className="text-ink-100 line-clamp-2">{source.excerpt}</p>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Mock API response (replace with actual fetch)
async function simulateAIResponse(question: string) {
  await new Promise(r => setTimeout(r, 1500));

  const responses: Record<string, any> = {
    default: {
      answer: "Based on your documents, I found relevant information across multiple files. Here's what I discovered:\n\nThe key points from your knowledge base suggest that this topic is covered in several recent uploads. The most relevant documents highlight the main themes and provide detailed context.\n\nWould you like me to dig deeper into any specific aspect?",
      sources: [
        { document_id: "1", filename: "Q4 Report 2024.pdf", score: 0.92, excerpt: "Key findings from the quarterly analysis showing..." },
        { document_id: "2", filename: "Strategy Document.docx", score: 0.85, excerpt: "The strategic roadmap outlines the following priorities..." },
      ]
    }
  };

  return responses.default;
}
