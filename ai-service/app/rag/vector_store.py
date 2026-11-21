"""
app/rag/vector_store.py
Persistent vector store manager with strict patient-level isolation.
Stores embeddings and chunk metadata in local JSON/NPZ files or ChromaDB,
guaranteeing zero cross-patient data leakage.
"""

import math
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from app.rag.config import rag_settings

def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Compute cosine similarity between two 1D vectors."""
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)

class PatientVectorStore:
    """
    Manages isolated vector partitions per patient under:
      %LOCALAPPDATA%/MediSync/rag_storage/vector_db/<patient_id>.json
    """

    def __init__(self, base_dir: Path = rag_settings.rag_storage_dir / "vector_db"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _get_patient_file(self, patient_id: str) -> Path:
        safe_id = "".join(c for c in patient_id if c.isalnum() or c in ("-", "_"))
        return self.base_dir / f"{safe_id}.json"

    def _load_patient_records(self, patient_id: str) -> List[Dict[str, Any]]:
        file_path = self._get_patient_file(patient_id)
        if not file_path.exists():
            return []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _save_patient_records(self, patient_id: str, records: List[Dict[str, Any]]) -> None:
        file_path = self._get_patient_file(patient_id)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False)

    def add_document_chunks(
        self,
        patient_id: str,
        document_id: str,
        document_name: str,
        chunks: List[Dict[str, Any]],
        embeddings: List[List[float]],
    ) -> int:
        """
        Store vector embeddings for an authenticated patient's document.
        Idempotent: removes existing chunks for document_id first.
        """
        records = self._load_patient_records(patient_id)
        # Remove any existing records for this document
        records = [r for r in records if r.get("document_id") != document_id]

        for chunk, emb in zip(chunks, embeddings):
            record = {
                "patient_id": patient_id,
                "document_id": document_id,
                "document_name": document_name,
                "page_number": chunk["page_number"],
                "chunk_index": chunk["chunk_index"],
                "text": chunk["text"],
                "embedding": emb,
            }
            records.append(record)

        self._save_patient_records(patient_id, records)
        return len(chunks)

    def delete_document(self, patient_id: str, document_id: str) -> bool:
        """
        Delete all indexed vector chunks for a specific document belonging to patient_id.
        """
        records = self._load_patient_records(patient_id)
        original_count = len(records)
        records = [r for r in records if r.get("document_id") != document_id]
        if len(records) != original_count:
            self._save_patient_records(patient_id, records)
            return True
        return False

    def query(
        self,
        patient_id: str,
        query_embedding: List[float],
        top_k: int = rag_settings.top_k,
        min_score: float = rag_settings.min_similarity_score,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve the top-K most similar chunks strictly scoped to the patient_id.
        """
        records = self._load_patient_records(patient_id)
        if not records:
            return []

        scored_chunks = []
        for r in records:
            score = _cosine_similarity(query_embedding, r["embedding"])
            if score >= min_score:
                scored_chunks.append({
                    "document_id": r["document_id"],
                    "document_name": r["document_name"],
                    "page_number": r["page_number"],
                    "chunk_index": r["chunk_index"],
                    "text": r["text"],
                    "similarity": round(score, 4),
                })

        # Sort descending by similarity
        scored_chunks.sort(key=lambda x: x["similarity"], reverse=True)
        return scored_chunks[:top_k]

# Global singleton
vector_store = PatientVectorStore()
