"""
app/rag/embeddings.py
Generates document and query embeddings using Ollama nomic-embed-text.
"""

import httpx
from typing import List
from app.rag.config import rag_settings

async def generate_embedding(text: str) -> List[float]:
    """
    Generate a 768-dimensional embedding vector for input text via Ollama.
    """
    if not text or not text.strip():
        return [0.0] * rag_settings.embedding_dim

    cleaned_text = text.strip()[:2000] # Cap input chunk to prevent compute overload
    payload = {
        "model": rag_settings.embedding_model,
        "prompt": cleaned_text
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f"{rag_settings.ollama_url}/api/embeddings", json=payload)
        resp.raise_for_status()
        data = resp.json()
        embedding = data.get("embedding", [])
        if not embedding or len(embedding) != rag_settings.embedding_dim:
            raise ValueError(f"Expected {rag_settings.embedding_dim} dim embedding, got {len(embedding)}")
        return embedding

async def batch_generate_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings sequentially/batch to avoid overloading the local Ollama instance on 8GB RAM.
    """
    results = []
    for text in texts:
        emb = await generate_embedding(text)
        results.append(emb)
    return results
