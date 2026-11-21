/**
 * AiCompanion.tsx
 *
 * MediSync AI Care Companion — Patient-facing chat UI.
 * Enhanced with Patient-Centric RAG citations, document source tags, and navigation.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  sendMessage,
  type ChatMessage,
  type CitationItem,
} from "../../api/aiCompanionApi";
import { FileText, Sparkles, AlertCircle } from "lucide-react";

interface Message extends ChatMessage {
  id: string;
  tool_used?: string;
  citations?: CitationItem[];
  error?: string;
}

const SUGGESTED_PROMPTS = [
  "Explain my latest blood test report",
  "Show me my current prescriptions",
  "What is my medical history?",
  "What are my allergies?",
  "Summarize my last consultation",
  "Explain the abnormal values in my report",
];

export const AiCompanion: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm your MediSync AI Care Companion. I can help you understand your medical records, prescriptions, and your uploaded laboratory & diagnostic reports. What would you like to know?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [showDebug, setShowDebug] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = useCallback((msg: Omit<Message, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setMessages((prev) => [...prev, { ...msg, id }]);
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !user?._id) return;

    setInput("");
    setLoading(true);

    addMessage({ role: "user", content: text, timestamp: new Date().toISOString() });

    try {
      const result = await sendMessage(text, conversationId);
      setConversationId(result.conversation_id);
      addMessage({
        role: "assistant",
        content: result.response,
        timestamp: new Date().toISOString(),
        tool_used: result.tool_used,
        citations: result.citations,
        error: result.error ?? undefined,
      });
    } catch (err: any) {
      const errorMsg =
        err?.response?.status === 401
          ? "Your session has expired. Please log in again."
          : "I'm having trouble responding right now. Please try again in a moment.";
      addMessage({
        role: "assistant",
        content: errorMsg,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, user, conversationId, addMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const handleNewConversation = () => {
    setConversationId(undefined);
    setMessages([
      {
        id: "welcome-new",
        role: "assistant",
        content: "Starting a new conversation. How can I help you?",
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-xl overflow-hidden shadow-sm border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-teal-500 flex items-center justify-center shadow-sm">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">AI Care Companion</h2>
            <p className="text-xs text-slate-500">Integrated Patient Health Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">

          <button
            onClick={handleNewConversation}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            New Chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-sm"
                  : "bg-white text-slate-800 rounded-bl-sm border border-slate-100"
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

              {/* RAG Citations */}
              {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs">
                  <p className="font-semibold text-indigo-700 flex items-center gap-1 mb-1.5">
                    <FileText className="h-3.5 w-3.5" /> Verified Sources Cited:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.citations.map((c, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200/80 text-indigo-900 px-2 py-0.5 rounded text-[11px]"
                      >
                        <span className="font-medium truncate max-w-[140px]">{c.document_name}</span>
                        <span className="text-indigo-500 font-semibold">(Pg. {c.page_number})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}


              {msg.timestamp && (
                <p
                  className={`text-[10px] mt-1.5 ${
                    msg.role === "user" ? "text-indigo-200" : "text-slate-400"
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts — only shown at start */}
      {messages.length <= 1 && (
        <div className="px-4 pb-3 flex gap-2 flex-wrap">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSuggestedPrompt(prompt)}
              className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full px-3 py-1.5 transition-colors font-medium"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="px-4 pb-1 text-center">
        <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
          <AlertCircle className="h-3 w-3" />
          AI responses are for clinical informational guidance only and do not replace doctor evaluations.
        </p>
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex gap-2 items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-200 transition-all">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your test reports, blood counts, prescriptions, or past visits..."
            disabled={loading}
            className="flex-1 text-sm outline-none bg-transparent text-slate-700 placeholder-slate-400 disabled:opacity-50"
            maxLength={1000}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="w-8 h-8 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg transition-colors flex-shrink-0"
            aria-label="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiCompanion;
