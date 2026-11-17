/**
 * aiCompanionApi.ts
 *
 * API client for the MediSync AI Care Companion service.
 * All requests go through the existing api.ts axios instance, which:
 *   - Adds Authorization: Bearer <token> header automatically (interceptor)
 *   - Adds X-CSRF-Token header automatically (interceptor)
 *   - Handles 401 refresh-token retry
 *
 * The Node.js gateway proxies /api/v1/intelligence/* to the FastAPI service,
 * stripping the /api/v1/intelligence prefix before forwarding.
 *
 * So: frontend calls /api/v1/intelligence/chat
 *     Node.js proxies to FastAPI /chat
 *
 * SECURITY NOTE: patient_id is NOT sent by the client. The FastAPI service
 * resolves patient identity from the JWT token via the /auth/me endpoint,
 * preventing any possibility of cross-patient identity spoofing.
 */

import api from "../utils/api";

const BASE = "/intelligence";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface ChatResponse {
  conversation_id: string;
  response: string;
  tool_used: string;
  error?: string;
}

export interface Conversation {
  _id: string;
  patient_id: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

/**
 * Send a message and receive an AI response.
 * Patient identity is derived from the JWT token server-side.
 * @param message          The patient's question
 * @param conversationId   Existing conversation ID, or undefined to start new
 */
export async function sendMessage(
  message: string,
  conversationId?: string
): Promise<ChatResponse> {
  const { data } = await api.post(`${BASE}/chat`, {
    message,
    conversation_id: conversationId ?? null,
  });
  return data;
}

/**
 * Start a new conversation session.
 * Patient identity is derived from the JWT token server-side.
 */
export async function startConversation(): Promise<{ conversation_id: string }> {
  const { data } = await api.post(`${BASE}/conversations`);
  return data;
}

/**
 * List recent conversations for the authenticated patient.
 */
export async function listConversations(): Promise<{ conversations: Conversation[] }> {
  const { data } = await api.get(`${BASE}/conversations`);
  return data;
}

/**
 * Load all messages for a conversation.
 */
export async function getMessages(
  conversationId: string
): Promise<{ messages: ChatMessage[]; conversation_id: string }> {
  const { data } = await api.get(`${BASE}/conversations/${conversationId}/messages`);
  return data;
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  await api.delete(`${BASE}/conversations/${conversationId}`);
}

/**
 * Health check — for debugging.
 */
export async function getAiHealth(): Promise<any> {
  const { data } = await api.get(`${BASE}/health`);
  return data;
}
