"""
Ollama LLM provider using /api/generate endpoint with crisp response prompting and streaming support.
"""

import json
import httpx
from typing import AsyncGenerator
from app.config import settings


SYSTEM_PROMPT = """You are MediSync AI Care Companion, an intelligent healthcare assistant.

COMMUNICATION STYLE (CRITICAL):
- Be CRISP, CONCISE, and DIRECT. 
- Cover ONLY the essential, high-value clinical points. Avoid filler phrases, conversational fluff, or repetitive intros/outros.
- Use clear bullet points with bold keywords for readability.
- Keep responses to 2 to 4 key bullet points whenever possible.

CAPABILITIES:
1. Patient Records: Explain prescriptions (dosage, frequency, duration), medical records, previous doctor visits, allergies, and diagnostic reports concisely.
2. General Health Queries: Provide direct, evidence-based wellness, nutrition, lifestyle, or medication education.

SAFETY BOUNDARIES:
- Never make a definitive new diagnosis. If symptoms are ambiguous or concerning, recommend doctor review in one brief bullet.
- In emergencies (e.g. chest pain, severe shortness of breath), immediately advise emergency services.
"""


async def stream_response(prompt: str, context_data: str = "") -> AsyncGenerator[str, None]:
    """
    Stream tokens from Ollama /api/generate as an async generator.
    Yields text chunks as they arrive.
    """
    if context_data:
        full_prompt = (
            f"[PATIENT MEDICAL CONTEXT]\n{context_data}\n[END PATIENT MEDICAL CONTEXT]\n\n"
            f"Patient Query: {prompt}\n\n"
            "Instructions: Provide a crisp, bulleted, and direct answer covering only key points."
        )
    else:
        full_prompt = (
            f"Patient Query: {prompt}\n\n"
            "Instructions: Provide a crisp, bulleted, and direct answer covering only key points."
        )

    payload = {
        "model": settings.ollama_model,
        "prompt": full_prompt,
        "system": SYSTEM_PROMPT,
        "stream": True,
        "options": {
            "temperature": settings.ollama_temperature,
            "num_predict": settings.ollama_num_predict,
            "num_ctx": settings.ollama_num_ctx,
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", f"{settings.ollama_url}/api/generate", json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    chunk = data.get("response", "")
                    if chunk:
                        yield chunk
                except Exception:
                    continue


async def generate_response(prompt: str, context_data: str = "") -> str:
    """
    Non-streaming fallback for /api/generate.
    """
    if context_data:
        full_prompt = (
            f"[PATIENT MEDICAL CONTEXT]\n{context_data}\n[END PATIENT MEDICAL CONTEXT]\n\n"
            f"Patient Query: {prompt}\n\n"
            "Instructions: Provide a crisp, bulleted, and direct answer covering only key points."
        )
    else:
        full_prompt = (
            f"Patient Query: {prompt}\n\n"
            "Instructions: Provide a crisp, bulleted, and direct answer covering only key points."
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
