/**
 * AiCompanion.tsx
 *
 * MediSync AI Care Companion — Patient-facing chat UI.
 *
 * This component:
 *   - Is only rendered inside PatientDashboard (role-gated by PrivateRoute)
 *   - Uses AuthContext to get the patient's _id and JWT token
 *   - Calls aiCompanionApi.ts which routes through the existing api.ts interceptors
 *   - Maintains conversation_id in state for multi-turn context
 *   - Shows typing indicator while waiting for LLM response
 *   - Shows which data tool was used (optional debug badge)
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  sendMessage,
  type ChatMessage,
} from "../../api/aiCompanionApi";

interface Message extends ChatMessage {
  id: string;
  tool_used?: string;
  error?: string;
}

const SUGGESTED_PROMPTS = [
  "Show me my current prescriptions",
  "What is my medical history?",
  "What are my allergies?",
  "Summarize my last consultation",
  "Give me a summary of my health",
];

export const AiCompanion: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm your MediSync AI Care Companion. I can help you understand your medical records, prescriptions, and past consultations. What would you like to know?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [showDebug, setShowDebug] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages update
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

    // Optimistically add user message
    addMessage({ role: "user", content: text, timestamp: new Date().toISOString() });

    try {
      const result = await sendMessage(text, conversationId);
      setConversationId(result.conversation_id);
      addMessage({
        role: "assistant",
        content: result.response,
        timestamp: new Date().toISOString(),
        tool_used: result.tool_used,
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
    <div className="flex flex-col h-full bg-gray-50 rounded-xl overflow-hidden shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
            <span className="text-white text-sm font-bold">AI</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">AI Care Companion</h2>
            <p className="text-xs text-gray-500">Powered by Qwen2.5 · Local & Private</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDebug((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded"
            title="Toggle debug info"
          >
            {showDebug ? "Hide debug" : "Debug"}
          </button>
          <button
            onClick={handleNewConversation}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition-colors"
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
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-white text-gray-800 rounded-bl-sm border border-gray-100"
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {showDebug && msg.tool_used && msg.role === "assistant" && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-400 font-mono">
                    tool: {msg.tool_used}
                    {msg.error && ` | warn: ${msg.error.slice(0, 40)}`}
                  </span>
                </div>
              )}
              {msg.timestamp && (
                <p
                  className={`text-xs mt-1.5 ${
                    msg.role === "user" ? "text-blue-200" : "text-gray-400"
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
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
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
              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-full px-3 py-1.5 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="px-4 pb-1 text-center">
        <p className="text-xs text-gray-400">
          AI responses are for informational purposes only. Not a substitute for professional medical advice.
        </p>
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex gap-2 items-center bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your prescriptions, records, or past consultations..."
            disabled={loading}
            className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400 disabled:opacity-50"
            maxLength={1000}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors flex-shrink-0"
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
