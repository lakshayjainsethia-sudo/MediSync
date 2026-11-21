"""
Main Orchestrator (Enhanced with Streaming & Crisp Information Retrieval)
"""

from typing import List, Dict, Any, Optional, AsyncGenerator

from app.agent.intent_router import route_intent
from app.agent.tool_executor import execute_tool
from app.rag.pipeline import retrieve_document_context
from app.conversation.manager import (
    get_or_create_conversation,
    append_message,
    get_recent_messages,
)
from app.llm.ollama_provider import generate_response, stream_response
from app.config import settings

def _build_history_context(messages: list) -> str:
    """Convert recent message history to a readable format for the LLM."""
    if not messages:
        return ""
    lines = ["Recent conversation:"]
    for msg in messages[-6:]:
        role_label = "Patient" if msg["role"] == "user" else "Assistant"
        content = msg["content"][:200]
        lines.append(f"  {role_label}: {content}")
    return "\n".join(lines)

async def prepare_context(patient_id: str, jwt_token: str, user_message: str):
    """
    Execute tool / RAG retrieval and assemble combined context.
    Returns (tool_name, combined_context, citations, error).
    """
    tool_name = route_intent(user_message)
    context_data = ""
    fetch_error = None
    citations = []

    if tool_name == "query_patient_documents":
        rag_context, citations = await retrieve_document_context(patient_id, user_message)
        if rag_context:
            context_data = rag_context
        else:
            context_data = "No specific uploaded laboratory documents were found matching this query."
    elif tool_name != "general_qa":
        context_data, raw_data = await execute_tool(tool_name, jwt_token)
        if context_data.startswith("ERROR:UNAUTHORIZED"):
            return tool_name, "", [], "unauthorized"
        if context_data.startswith("ERROR:"):
            fetch_error = context_data
            context_data = ""
    else:
        rag_context, citations = await retrieve_document_context(patient_id, user_message, top_k=2)
        if rag_context:
            context_data = rag_context

    return tool_name, context_data, citations, fetch_error

async def process_message(
    patient_id: str,
    jwt_token: str,
    user_message: str,
    conversation_id: str = None,
) -> dict:
    """
    Unified non-streaming pipeline: Intent -> Tool/RAG -> LLM -> Persist -> Respond.
    """
    convo = await get_or_create_conversation(patient_id, conversation_id)
    convo_id_str = str(convo["_id"])

    tool_name, context_data, citations, fetch_error = await prepare_context(patient_id, jwt_token, user_message)
    if fetch_error == "unauthorized":
        return {
            "conversation_id": convo_id_str,
            "response": "Your session has expired. Please log in again.",
            "tool_used": tool_name,
            "citations": [],
            "error": "unauthorized",
        }

    history = await get_recent_messages(convo_id_str, patient_id, limit=6)
    history_text = _build_history_context(history)
    combined_context = "\n\n".join(filter(None, [history_text, context_data]))
    if len(combined_context) > settings.max_context_chars:
        combined_context = combined_context[-settings.max_context_chars:]

    llm_error = None
    try:
        response_text = await generate_response(user_message, combined_context)
    except Exception as e:
        response_text = "I'm having trouble connecting to my AI engine right now. Please try again in a moment."
        llm_error = str(e)

    await append_message(convo_id_str, patient_id, "user", user_message)
    await append_message(convo_id_str, patient_id, "assistant", response_text)

    return {
        "conversation_id": convo_id_str,
        "response": response_text,
        "tool_used": tool_name,
        "citations": citations,
        "error": fetch_error or llm_error,
    }

async def process_message_stream(
    patient_id: str,
    jwt_token: str,
    user_message: str,
    conversation_id: str = None,
) -> AsyncGenerator[dict, None]:
    """
    Unified streaming generator:
      Yields metadata header first: {"type": "metadata", "conversation_id": ..., "tool_used": ..., "citations": ...}
      Yields token chunks: {"type": "chunk", "text": "..."}
      Yields completion signal and persists messages: {"type": "done"}
    """
    convo = await get_or_create_conversation(patient_id, conversation_id)
    convo_id_str = str(convo["_id"])

    tool_name, context_data, citations, fetch_error = await prepare_context(patient_id, jwt_token, user_message)
    if fetch_error == "unauthorized":
        yield {
            "type": "error",
            "conversation_id": convo_id_str,
            "text": "Your session has expired. Please log in again.",
            "tool_used": tool_name,
            "citations": []
        }
        return

    # Yield initial metadata packet so frontend has tool and citations right away
    yield {
        "type": "metadata",
        "conversation_id": convo_id_str,
        "tool_used": tool_name,
        "citations": citations
    }

    history = await get_recent_messages(convo_id_str, patient_id, limit=6)
    history_text = _build_history_context(history)
    combined_context = "\n\n".join(filter(None, [history_text, context_data]))
    if len(combined_context) > settings.max_context_chars:
        combined_context = combined_context[-settings.max_context_chars:]

    full_response = []
    try:
        async for chunk in stream_response(user_message, combined_context):
            full_response.append(chunk)
            yield {"type": "chunk", "text": chunk}
    except Exception as e:
        err_msg = "\n[AI engine connection interrupted. Please try again.]"
        full_response.append(err_msg)
        yield {"type": "chunk", "text": err_msg}

    final_text = "".join(full_response).strip()
    await append_message(convo_id_str, patient_id, "user", user_message)
    await append_message(convo_id_str, patient_id, "assistant", final_text)
    yield {"type": "done", "conversation_id": convo_id_str}
