"""
Main Orchestrator

The single-agent pipeline:

  1. Receive patient message + JWT token + conversation_id
  2. Determine intent via deterministic intent_router
  3. Execute tool (fetch real patient data from Node.js API using JWT)
  4. Build LLM prompt with: system prompt + conversation history + fetched data + question
  5. Call Ollama /api/generate
  6. Persist both user message and assistant response to MongoDB
  7. Return response to frontend

Error handling:
  - If JWT is rejected by Node.js (401): return auth error to frontend
  - If Ollama is down: return fallback message
  - If data fetch fails: LLM answers without data context
"""

from app.agent.intent_router import route_intent
from app.agent.tool_executor import execute_tool
from app.conversation.manager import (
    get_or_create_conversation,
    append_message,
    get_recent_messages,
    _serialize,
)
from app.llm.ollama_provider import generate_response
from app.config import settings


def _build_history_context(messages: list) -> str:
    """Convert recent message history to a readable format for the LLM."""
    if not messages:
        return ""
    lines = ["Recent conversation:"]
    for msg in messages[-6:]:  # last 3 exchanges (user+assistant pairs)
        role_label = "Patient" if msg["role"] == "user" else "Assistant"
        content = msg["content"][:200]  # truncate long messages
        lines.append(f"  {role_label}: {content}")
    return "\n".join(lines)


async def process_message(
    patient_id: str,
    jwt_token: str,
    user_message: str,
    conversation_id: str = None,
) -> dict:
    """
    Full pipeline: intent → tool → LLM → persist → respond.

    Returns:
      {
        conversation_id: str,
        response: str,
        tool_used: str,
        error: str | None
      }
    """

    # 1. Load or create conversation
    convo = await get_or_create_conversation(patient_id, conversation_id)
    convo_id_str = str(convo["_id"])

    # 2. Route intent
    tool_name = route_intent(user_message)

    # 3. Execute tool — fetch patient data
    context_data = ""
    fetch_error = None
    if tool_name != "general_qa":
        context_data, raw_data = await execute_tool(tool_name, jwt_token)
        if context_data.startswith("ERROR:UNAUTHORIZED"):
            return {
                "conversation_id": convo_id_str,
                "response": "Your session has expired. Please log in again.",
                "tool_used": tool_name,
                "error": "unauthorized",
            }
        if context_data.startswith("ERROR:"):
            fetch_error = context_data
            context_data = ""  # Let LLM answer generically

    # 4. Build conversation history context
    history = await get_recent_messages(convo_id_str, patient_id, limit=10)
    history_text = _build_history_context(history)

    # Combine history + fetched data into one context block
    combined_context = "\n\n".join(filter(None, [history_text, context_data]))

    # Trim context to stay within num_ctx budget
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
        "error": fetch_error or llm_error,
    }
