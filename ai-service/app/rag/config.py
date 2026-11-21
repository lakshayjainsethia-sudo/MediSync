"""
app/rag/config.py
Configuration settings for the MediSync RAG subsystem.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings

class RAGSettings(BaseSettings):
    # Base storage directory in LocalAppData (bypassing OneDrive sync locks)
    rag_storage_dir: Path = Path(os.environ.get(
        "MEDISYNC_RAG_DIR", 
        Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local"))) / "MediSync" / "rag_storage"
    ))
    
    # Embedding settings
    embedding_model: str = "nomic-embed-text"
    ollama_url: str = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
    embedding_dim: int = 768
    
    # Chunking parameters (Structure-aware for medical reports)
    chunk_size: int = 450      # Characters/words target
    chunk_overlap: int = 60    # Overlap to prevent boundary loss
    
    # Retrieval parameters
    top_k: int = 4
    min_similarity_score: float = 0.40  # Cosine similarity threshold
    
    # Upload constraints
    max_file_size_bytes: int = 15 * 1024 * 1024  # 15 MB limit
    allowed_extensions: list[str] = [".pdf", ".txt"]
    allowed_mime_types: list[str] = [
        "application/pdf", 
        "text/plain", 
        "application/octet-stream"  # Some browsers send octet-stream for pdf
    ]

rag_settings = RAGSettings()
rag_settings.rag_storage_dir.mkdir(parents=True, exist_ok=True)
(rag_settings.rag_storage_dir / "documents").mkdir(parents=True, exist_ok=True)
(rag_settings.rag_storage_dir / "vector_db").mkdir(parents=True, exist_ok=True)
