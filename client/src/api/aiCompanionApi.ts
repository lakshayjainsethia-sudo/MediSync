/**
 * aiCompanionApi.ts
 *
 * API client for the MediSync AI Care Companion and Patient Document RAG service.
 * All requests go through the existing api.ts axios instance, which:
 *   - Adds Authorization: Bearer <token> header automatically (interceptor)
 *   - Adds X-CSRF-Token header automatically (interceptor)
 *   - Handles 401 refresh-token retry
 *
 * The Node.js gateway proxies /api/v1/intelligence/* to the FastAPI service,
 * stripping the /api/v1/intelligence prefix before forwarding.
 */

import api from "../utils/api";

const BASE = "/intelligence";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface CitationItem {
  document_id: string;
  document_name: string;
  page_number: number;
  similarity: number;
}

export interface ChatResponse {
  conversation_id: string;
  response: string;
  tool_used: string;
  citations?: CitationItem[];
  error?: string;
}

export interface Conversation {
  _id: string;
  patient_id: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface PatientDocument {
  document_id: string;
  filename: string;
  category: string;
  size_bytes: number;
  status: "processing" | "ready" | "failed";
  total_pages: number;
  total_chunks: number;
  created_at: string;
  error?: string;
}

/**
 * Send a message and receive an AI response with grounded document citations.
 */
export async function sendMessage(
  message: string,
  conversationId?: string
): Promise<ChatResponse> {
  const payload: { message: string; conversation_id?: string } = { message };
  if (conversationId) {
    payload.conversation_id = conversationId;
  }
  const res = await api.post<ChatResponse>(`${BASE}/chat`, payload);
  return res.data;
}

/**
 * Upload a clinical PDF or TXT document to the RAG subsystem.
 */
export async function uploadPatientDocument(
  file: File,
  category: string = "general_report"
): Promise<{ success: boolean; message: string; data: any }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);

  const res = await api.post(`${BASE}/documents/upload`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
}

/**
 * Fetch all uploaded documents for the authenticated patient.
 */
export async function getPatientDocuments(): Promise<PatientDocument[]> {
  const res = await api.get<{ success: boolean; documents: PatientDocument[] }>(
    `${BASE}/documents`
  );
  return res.data.documents || [];
}

/**
 * Delete a patient document and all associated vector chunks.
 */
export async function deletePatientDocument(
  documentId: string
): Promise<{ success: boolean; message: string }> {
  const res = await api.delete(`${BASE}/documents/${documentId}`);
  return res.data;
}

/**
 * Start a new conversation session.
 */
export async function newConversation(): Promise<string> {
  const res = await api.post<{ conversation_id: string }>(
    `${BASE}/conversations`,
    {}
  );
  return res.data.conversation_id;
}

/**
 * List recent conversation sessions for the authenticated patient.
 */
export async function listConversations(): Promise<Conversation[]> {
  const res = await api.get<{ conversations: Conversation[] }>(
    `${BASE}/conversations`
  );
  return res.data.conversations;
}

/**
 * Fetch messages from a past conversation.
 */
export async function getConversationMessages(
  conversationId: string
): Promise<ChatMessage[]> {
  const res = await api.get<{ messages: ChatMessage[] }>(
    `${BASE}/conversations/${conversationId}/messages`
  );
  return res.data.messages;
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(
  conversationId: string
): Promise<void> {
  await api.delete(`${BASE}/conversations/${conversationId}`);
}
