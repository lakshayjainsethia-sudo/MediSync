"""
FastAPI Routes

All routes require the patient's JWT, forwarded as Authorization: Bearer <token>.

The Node.js server strips /api/v1/intelligence before proxying to FastAPI,
so FastAPI routes start from /:

  Node.js sees:  POST /api/v1/intelligence/chat
  FastAPI sees:  POST /chat

JWT identity resolution:
  FastAPI does NOT decode or validate the JWT itself.
  Instead it calls GET /api/v1/auth/me with the Bearer token, which lets
  the trusted Node.js auth middleware validate the JWT and return the
  authenticated user's _id. This _id is used as patient_id throughout.

  This means patient_id is NEVER accepted from the request body — it always
  comes from the authenticated backend context, preventing identity spoofing.
"""

import httpx
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field
from typing import Optional

from app.agent.orchestrator import process_message
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


# ── Request/Response Models ──────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    conversation_id: Optional[str] = None
    # NOTE: patient_id is intentionally NOT accepted from the client.
    # Identity is resolved server-side from the JWT via _resolve_patient_id().


class ChatResponse(BaseModel):
    conversation_id: str
    response: str
    tool_used: str
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

    The Node.js auth middleware validates the JWT and returns the user object.
    We extract _id from that response. This is the ONLY source of patient_id —
    it cannot be overridden by request parameters, body fields, or LLM output.

    Raises HTTP 401 if the token is invalid or the user is not a patient.
    """
    url = f"{settings.node_api_base}/auth/me"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
            if resp.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid or expired token")
            resp.raise_for_status()
            data = resp.json()
            # Node.js returns {success: true, data: {_id, role, ...}}
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


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    authorization: Optional[str] = Header(None),
):
    """
    Main chat endpoint. Processes a patient message through the full pipeline:
    intent routing -> tool execution -> LLM response -> persistence.
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


@router.post("/conversations", response_model=NewConversationResponse)
async def new_conversation(
    body: dict,
    authorization: Optional[str] = Header(None),
):
    """Start a new conversation session. Returns conversation_id."""
    token = _extract_token(authorization)
    patient_id = await _resolve_patient_id(token)
    convo = await get_or_create_conversation(patient_id, conversation_id=None)
    return {"conversation_id": str(convo["_id"])}


@router.get("/conversations")
async def get_conversations(
    authorization: Optional[str] = Header(None),
):
    """List recent conversations for the authenticated patient."""
    token = _extract_token(authorization)
    patient_id = await _resolve_patient_id(token)
    convos = await list_conversations(patient_id, limit=10)
    return {"conversations": convos}


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    authorization: Optional[str] = Header(None),
):
    """Get messages for a specific conversation."""
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
    """Delete a conversation (patient-initiated)."""
    token = _extract_token(authorization)
    patient_id = await _resolve_patient_id(token)
    deleted = await delete_conversation(conversation_id, patient_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"deleted": True, "conversation_id": conversation_id}


@router.get("/health")
async def health():
    """Health check — reports Ollama status and MongoDB connectivity."""
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
    }


@router.get("/debug/route")
async def debug_route(q: str):
    """Debug endpoint: shows which tool would be selected for a query."""
    return explain_route(q)
