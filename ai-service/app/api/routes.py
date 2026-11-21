"""
FastAPI Routes (Integrated with Patient Document RAG)

All routes require the patient's JWT, forwarded as Authorization: Bearer <token>.
Provides:
  - /chat (Unified AI Care Companion with RAG citations)
  - /documents/upload (Upload medical PDF/TXT with validation, structure-aware chunking & vector indexing)
  - /documents (List patient uploaded documents)
  - /documents/{document_id} (Delete patient document and vector chunks)
  - /health (Detailed health probe for service, LLM, embedding & DB)
"""

import httpx
from fastapi import APIRouter, HTTPException, Header, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from app.agent.orchestrator import process_message
from app.rag.pipeline import (
    ingest_document,
    delete_patient_document,
    list_patient_documents,
)
from app.conversation.manager import (
    list_conversations,
    delete_conversation,
    get_recent_messages,
    get_or_create_conversation,
)
from app.llm.ollama_provider import health_check
from app.agent.intent_router import explain_route
from app.db.mongo import get_db
from app.config import settings

router = APIRouter()

# ── Models ──────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    conversation_id: Optional[str] = None

class CitationItem(BaseModel):
    document_id: str
    document_name: str
    page_number: int
    similarity: float

class ChatResponse(BaseModel):
    conversation_id: str
    response: str
    tool_used: str
    citations: List[CitationItem] = []
    error: Optional[str] = None

class NewConversationResponse(BaseModel):
    conversation_id: str

# ── Helpers ──────────────────────────────────────────────────────────────────

def _extract_token(authorization: Optional[str]) -> str:
    """Extract Bearer token from Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")
    return parts[1]

async def _resolve_patient_id(token: str) -> str:
    """
    Derive the authenticated patient's MongoDB _id by calling GET /api/v1/auth/me.
    """
    url = f"{settings.node_api_base}/auth/me"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
            if resp.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid or expired token")
            resp.raise_for_status()
            data = resp.json()
            user = data.get("data", data)
            patient_id = user.get("_id") or user.get("id")
            role = (user.get("role") or "").lower()
            if not patient_id:
                raise HTTPException(status_code=401, detail="Could not resolve user identity")
            if role != "patient":
                raise HTTPException(status_code=403, detail="AI Care Companion is only available to patients")
            return str(patient_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Identity service unavailable: {str(e)[:60]}")

# ── AI Companion Chat ────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    authorization: Optional[str] = Header(None),
):
    """
    Processes patient query through: intent routing -> tool/RAG execution -> LLM generation -> citations.
    """
    token = _extract_token(authorization)
    patient_id = await _resolve_patient_id(token)

    result = await process_message(
        patient_id=patient_id,
        jwt_token=token,
        user_message=body.message,
        conversation_id=body.conversation_id,
    )
    return ChatResponse(**result)

# ── Patient Document RAG Management ─────────────────────────────────────────

@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form("general_report"),
    authorization: Optional[str] = Header(None),
):
    """
    Secure patient document upload and vector ingestion endpoint.
    Accepts PDF and TXT clinical documents, verifies authorization,
    chunks text, generates Ollama nomic-embed-text vectors, and indexes.
    """
    token = _extract_token(authorization)
    patient_id = await _resolve_patient_id(token)

    # Read bytes safely
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        res = await ingest_document(
            patient_id=patient_id,
            filename=file.filename or "uploaded_document.pdf",
            file_bytes=file_bytes,
            document_category=category,
        )
        return {
            "success": True,
            "message": "Document ingested and indexed successfully",
            "data": res
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

@router.get("/documents")
async def get_patient_documents(
    authorization: Optional[str] = Header(None),
):
    """
    List all uploaded medical reports for the authenticated patient.
    """
    token = _extract_token(authorization)
    patient_id = await _resolve_patient_id(token)
    docs = await list_patient_documents(patient_id)
    return {"success": True, "documents": docs}

@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    authorization: Optional[str] = Header(None),
):
    """
    Delete a patient medical document, along with all associated vector chunks and embeddings.
    """
    token = _extract_token(authorization)
    patient_id = await _resolve_patient_id(token)
    deleted = await delete_patient_document(patient_id, document_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized")
    return {"success": True, "message": "Document and vector index deleted successfully"}

# ── Conversations ────────────────────────────────────────────────────────────

@router.post("/conversations", response_model=NewConversationResponse)
async def new_conversation(
    body: dict,
    authorization: Optional[str] = Header(None),
):
    token = _extract_token(authorization)
    patient_id = await _resolve_patient_id(token)
    convo = await get_or_create_conversation(patient_id, conversation_id=None)
    return {"conversation_id": str(convo["_id"])}

@router.get("/conversations")
async def get_conversations(
    authorization: Optional[str] = Header(None),
):
    token = _extract_token(authorization)
    patient_id = await _resolve_patient_id(token)
    convos = await list_conversations(patient_id, limit=10)
    return {"conversations": convos}

@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    authorization: Optional[str] = Header(None),
):
    token = _extract_token(authorization)
    patient_id = await _resolve_patient_id(token)
    messages = await get_recent_messages(conversation_id, patient_id, limit=50)
    for msg in messages:
        if hasattr(msg.get("timestamp"), "isoformat"):
            msg["timestamp"] = msg["timestamp"].isoformat()
    return {"messages": messages, "conversation_id": conversation_id}

@router.delete("/conversations/{conversation_id}")
async def delete_convo(
    conversation_id: str,
    authorization: Optional[str] = Header(None),
):
    token = _extract_token(authorization)
    patient_id = await _resolve_patient_id(token)
    deleted = await delete_conversation(conversation_id, patient_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"deleted": True, "conversation_id": conversation_id}

# ── Diagnostics ──────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    """Health check — reports Ollama status, embedding capability, and MongoDB connectivity."""
    llm_health = await health_check()
    db = get_db()
    db_status = "unavailable"
    if db is not None:
        try:
            await db.command("ping")
            db_status = "ok"
        except Exception as e:
            db_status = f"error: {str(e)[:50]}"

    return {
        "service": "medisync-ai-care-companion",
        "llm": llm_health,
        "database": db_status,
        "rag_subsystem": "ready"
    }

@router.get("/debug/route")
async def debug_route(q: str):
    return explain_route(q)
