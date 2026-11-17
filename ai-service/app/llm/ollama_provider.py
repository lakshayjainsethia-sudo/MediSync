"""
Ollama LLM provider using /api/generate endpoint.

Why /api/generate instead of /api/chat:
  The /api/chat endpoint (required for native tool calling) triggers a much
  larger compute buffer allocation in llama.cpp that causes OOM on machines
  with <2GB free RAM. The /api/generate endpoint works reliably with
  num_ctx=512 and is sufficient for our architecture since tool dispatch
  is handled deterministically by intent_router.py — the LLM's sole job
  is generating natural-language responses from pre-fetched, injected data.
"""

import json
import httpx
from app.config import settings


SYSTEM_PROMPT = """You are MediSync AI Care Companion, a patient-facing healthcare information assistant.

RULES (strictly enforce all):
1. You help patients understand THEIR OWN medical records, prescriptions, and consultations.
2. You NEVER make NEW diagnoses. You may explain diagnoses already documented in the patient records provided to you. If asked for a new diagnosis, say: "I'm not able to make medical diagnoses. Please consult your doctor."
3. You NEVER prescribe medication or recommend dosage changes.
4. You ONLY discuss information from the medical data provided to you in this conversation.
5. For emergencies say: "Please call your local emergency services immediately."
6. You speak in plain, friendly English — avoid complex medical jargon unless the patient asks for clinical detail.
7. Never make up or assume patient data not present in the context.
"""


async def generate_response(prompt: str, context_data: str = "") -> str:
    """
    Call Ollama /api/generate with injected context data.

    The full prompt structure is:
      [PATIENT DATA]
      {context_data}
      [END PATIENT DATA]

      Patient question: {prompt}

    This pattern (data injection) is more reliable than tool calls
    for small models like qwen2.5:1.5b.
    """
    if context_data:
        full_prompt = (
            f"[PATIENT DATA]\n{context_data}\n[END PATIENT DATA]\n\n"
            f"Patient question: {prompt}"
        )
    else:
        # No patient records were fetched (general_qa path).
        # Constrain the LLM: only answer if it is clearly a general health
        # education question. If the patient is asking about their own records,
        # tell them to ask more specifically so the right tool can be invoked.
        full_prompt = (
            "No patient-specific records were retrieved for this query.\n\n"
            f"Patient question: {prompt}\n\n"
            "If this is a general health education question (e.g. what is a medication, "
            "how does a condition work), answer it briefly and clearly. "
            "If this is a question about the patient's own medical data (history, "
            "prescriptions, consultations), say: 'I don't have your records for that topic "
            "yet — could you ask more specifically? For example: "
            "\"Show my prescriptions\" or \"What is my medical history?\"'"
        )

    payload = {
        "model": settings.ollama_model,
        "prompt": full_prompt,
        "system": SYSTEM_PROMPT,
        "stream": False,
        "options": {
            "temperature": settings.ollama_temperature,
            "num_predict": settings.ollama_num_predict,
            "num_ctx": settings.ollama_num_ctx,
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{settings.ollama_url}/api/generate",
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", "").strip()


async def health_check() -> dict:
    """Check if Ollama is reachable and the model is available."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.ollama_url}/api/tags")
            resp.raise_for_status()
            models = [m["name"] for m in resp.json().get("models", [])]
            model_available = any(settings.ollama_model in m for m in models)
            return {
                "status": "ok" if model_available else "model_missing",
                "ollama_reachable": True,
                "model": settings.ollama_model,
                "model_available": model_available,
                "available_models": models,
            }
    except Exception as e:
        return {
            "status": "error",
            "ollama_reachable": False,
            "error": str(e),
        }
