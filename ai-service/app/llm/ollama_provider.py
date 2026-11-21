"""
Ollama LLM provider using /api/generate endpoint.
"""

import json
import httpx
from app.config import settings


SYSTEM_PROMPT = """You are MediSync AI Care Companion, an intelligent and compassionate healthcare assistant for the patient.

CAPABILITIES & SCOPE:
1. Patient Records: You have secure access to the patient's prescriptions, medical records, past doctor visits, allergies, and diagnostic reports. Use them to answer questions clearly.
2. General Health Queries: You can answer general health questions, explain medical terminology, lifestyle recommendations, how medications work, side effects, and diet/exercise guidance.
3. Clarity: Speak in empathetic, clear, everyday English. If clinical terms are needed, explain them simply.

SAFETY BOUNDARIES:
- You never make a brand-new definitive clinical diagnosis. If the patient has severe new symptoms, provide supportive educational guidance and urge them to consult their physician.
- In emergencies (e.g., severe chest pain, inability to breathe, loss of consciousness), immediately advise calling emergency medical services.
"""


async def generate_response(prompt: str, context_data: str = "") -> str:
    """
    Call Ollama /api/generate with injected context data.
    """
    if context_data:
        full_prompt = (
            f"[PATIENT MEDICAL CONTEXT]\n{context_data}\n[END PATIENT MEDICAL CONTEXT]\n\n"
            f"Patient Query: {prompt}\n\n"
            "Instructions: Provide a helpful, clear, and reassuring answer based on the medical context above and general medical knowledge."
        )
    else:
        full_prompt = (
            f"Patient Query: {prompt}\n\n"
            "Instructions: Provide an informative, empathetic, and scientifically accurate answer to the patient's general health or wellness query."
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
    """Check Ollama connectivity and model availability."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.ollama_url}/api/tags")
            if resp.status_code == 200:
                models = [m.get("name", "") for m in resp.json().get("models", [])]
                model_ready = any(
                    settings.ollama_model in m for m in models
                )
                return {
                    "status": "ok" if model_ready else "model_missing",
                    "ollama_reachable": True,
                    "model": settings.ollama_model,
                    "model_available": model_ready,
                    "available_models": models,
                }
            return {
                "status": "error",
                "ollama_reachable": True,
                "error": f"HTTP {resp.status_code}",
            }
    except Exception as e:
        return {
            "status": "unreachable",
            "ollama_reachable": False,
            "error": str(e),
        }
