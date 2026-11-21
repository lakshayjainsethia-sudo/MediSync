"""
Main Orchestrator (Enhanced with Deep Patient Record Access & General QA)

The unified single-agent pipeline:
  1. Receive patient message + JWT token + conversation_id
  2. Determine intent via deterministic intent_router
  3. Execute tool:
     - If query_patient_documents: invoke RAG retrieval engine
     - If structured medical tool: fetch data from Node.js API Gateway using verified JWT
     - If general query: check if patient's records or uploaded documents have relevant context
  4. Build LLM prompt with: system prompt + conversation history + retrieved clinical data + patient question
  5. Call Ollama /api/generate
  6. Persist both user message and assistant response to MongoDB
  7. Return grounded response along with document citations
"""

from typing import List, Dict, Any, Optional

from app.agent.intent_router import route_intent
from app.agent.tool_executor import execute_tool
from app.rag.pipeline import retrieve_document_context
from app.conversation.manager import (
    get_or_create_conversation,
    append_message,
    get_recent_messages,
)
from app.llm.ollama_provider import generate_response
from app.config import settings

def _build_history_context(messages: list) -> str:
    """Convert recent message history to a readable format for the LLM."""
    if not messages:
        return ""
    lines = ["Recent conversation:"]
    for msg in messages[-6:]:
        role_label = "Patient" if msg["role"] == "user" else "Assistant"
        content = msg["content"][:250]
        lines.append(f"  {role_label}: {content}")
    return "\n".join(lines)

async def process_message(
    patient_id: str,
    jwt_token: str,
    user_message: str,
    conversation_id: str = None,
) -> dict:
    """
    Unified pipeline: Intent -> Tool/RAG -> LLM -> Persist -> Respond.
    """
    # 1. Load or create conversation
    convo = await get_or_create_conversation(patient_id, conversation_id)
    convo_id_str = str(convo["_id"])

    # 2. Route intent
    tool_name = route_intent(user_message)

    context_data = ""
    fetch_error = None
    citations = []

    # 3. Execution routing
    if tool_name == "query_patient_documents":
        # RAG pipeline across uploaded laboratory & diagnostic reports
        rag_context, citations = await retrieve_document_context(patient_id, user_message)
        if rag_context:
            context_data = rag_context
        else:
            context_data = "No specific uploaded laboratory documents were found matching this query."

    elif tool_name != "general_qa":
        # Structured Node.js API Tool (prescriptions, records, past visits, or full 360 summary)
        context_data, raw_data = await execute_tool(tool_name, jwt_token)
        if context_data.startswith("ERROR:UNAUTHORIZED"):
            return {
                "conversation_id": convo_id_str,
                "response": "Your session has expired. Please log in again.",
                "tool_used": tool_name,
                "citations": [],
                "error": "unauthorized",
            }
        if context_data.startswith("ERROR:"):
            fetch_error = context_data
            context_data = ""
    else:
        # General question or open-ended clinical query:
        # Check both RAG and core profile to provide relevant background if helpful
        rag_context, citations = await retrieve_document_context(patient_id, user_message, top_k=2)
        if rag_context:
            context_data = rag_context

    # 4. Build conversation history context
    history = await get_recent_messages(convo_id_str, patient_id, limit=8)
    history_text = _build_history_context(history)

    # Combine history + fetched context
    combined_context = "\n\n".join(filter(None, [history_text, context_data]))

    # Trim context to stay safely within num_ctx budget
    if len(combined_context) > settings.max_context_chars:
        combined_context = combined_context[-settings.max_context_chars:]

    # 5. Call LLM
    llm_error = None
    try:
        response_text = await generate_response(user_message, combined_context)
    except Exception as e:
        response_text = (
            "I'm having trouble connecting to my AI engine right now. "
            "Please try again in a moment, or contact the hospital front desk for assistance."
        )
        llm_error = str(e)

    # 6. Persist messages
    await append_message(convo_id_str, patient_id, "user", user_message)
    await append_message(convo_id_str, patient_id, "assistant", response_text)

    return {
        "conversation_id": convo_id_str,
        "response": response_text,
        "tool_used": tool_name,
        "citations": citations,
        "error": fetch_error or llm_error,
    }
