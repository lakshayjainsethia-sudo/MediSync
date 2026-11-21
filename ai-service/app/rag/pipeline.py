"""
app/rag/pipeline.py
Core Ingestion and Retrieval pipeline for MediSync Patient-Centric RAG.
Coordinates PDF parsing, chunking, Ollama nomic-embed-text embeddings,
persistent vector storage, and grounded context synthesis.
"""

import uuid
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from app.rag.config import rag_settings
from app.rag.parser import extract_document_text
from app.rag.chunker import chunk_document_pages
from app.rag.embeddings import generate_embedding, batch_generate_embeddings
from app.rag.vector_store import vector_store
from app.db.mongo import get_db

async def ingest_document(
    patient_id: str,
    filename: str,
    file_bytes: bytes,
    document_category: str = "general_report",
) -> Dict[str, Any]:
    """
    Full ingestion pipeline:
      1. Validate file format and size
      2. Save raw file to disk in %LOCALAPPDATA%/MediSync/rag_storage/documents/
      3. Extract text per page
      4. Chunk into clinical sections
      5. Generate embeddings via Ollama nomic-embed-text
      6. Index in patient-isolated vector store
      7. Register metadata in MongoDB patient_documents collection
    """
    if len(file_bytes) > rag_settings.max_file_size_bytes:
        raise ValueError(f"File size exceeds maximum allowed ({rag_settings.max_file_size_bytes // (1024*1024)} MB)")

    ext = Path(filename).suffix.lower()
    if ext not in rag_settings.allowed_extensions:
        raise ValueError(f"Unsupported file type '{ext}'. Allowed: {rag_settings.allowed_extensions}")

    document_id = str(uuid.uuid4())
    stored_filename = f"{patient_id}_{document_id}_{filename}"
    file_save_path = rag_settings.rag_storage_dir / "documents" / stored_filename

    # Save original file safely
    with open(file_save_path, "wb") as f:
        f.write(file_bytes)

    db = get_db()
    doc_meta = {
        "document_id": document_id,
        "patient_id": patient_id,
        "filename": filename,
        "stored_filename": stored_filename,
        "category": document_category,
        "size_bytes": len(file_bytes),
        "status": "processing",
        "created_at": datetime.utcnow().isoformat(),
        "total_pages": 0,
        "total_chunks": 0,
        "error": None
    }

    if db is not None:
        await db.patient_documents.insert_one(doc_meta)

    try:
        # Step 3: Extract text
        pages_data = extract_document_text(file_bytes, filename)
        if not pages_data:
            raise ValueError("No extractable text found in the document")

        # Step 4: Chunk text
        chunks = chunk_document_pages(pages_data)
        if not chunks:
            raise ValueError("Could not generate valid text chunks from document")

        # Step 5: Embed chunks
        chunk_texts = [c["text"] for c in chunks]
        embeddings = await batch_generate_embeddings(chunk_texts)

        # Step 6: Store in patient-isolated vector store
        vector_store.add_document_chunks(
            patient_id=patient_id,
            document_id=document_id,
            document_name=filename,
            chunks=chunks,
            embeddings=embeddings
        )

        # Step 7: Update metadata in MongoDB
        if db is not None:
            await db.patient_documents.update_one(
                {"document_id": document_id},
                {
                    "$set": {
                        "status": "ready",
                        "total_pages": len(pages_data),
                        "total_chunks": len(chunks),
                        "updated_at": datetime.utcnow().isoformat()
                    }
                }
            )

        return {
            "document_id": document_id,
            "filename": filename,
            "status": "ready",
            "pages": len(pages_data),
            "chunks": len(chunks),
        }

    except Exception as e:
        if db is not None:
            await db.patient_documents.update_one(
                {"document_id": document_id},
                {
                    "$set": {
                        "status": "failed",
                        "error": str(e),
                        "updated_at": datetime.utcnow().isoformat()
                    }
                }
            )
        raise e

async def delete_patient_document(patient_id: str, document_id: str) -> bool:
    """
    Deletes original file, vector chunks, and MongoDB record.
    """
    db = get_db()
    if db is not None:
        doc = await db.patient_documents.find_one({"document_id": document_id, "patient_id": patient_id})
        if not doc:
            return False

        # Delete disk file
        stored_path = rag_settings.rag_storage_dir / "documents" / doc.get("stored_filename", "")
        if stored_path.exists():
            try:
                stored_path.unlink()
            except Exception:
                pass

        # Delete vector records
        vector_store.delete_document(patient_id, document_id)

        # Delete Mongo record
        await db.patient_documents.delete_one({"document_id": document_id, "patient_id": patient_id})
        return True
    else:
        # Fallback to vector store deletion
        return vector_store.delete_document(patient_id, document_id)

async def list_patient_documents(patient_id: str) -> List[Dict[str, Any]]:
    """
    List all uploaded documents belonging to the authenticated patient.
    """
    db = get_db()
    if db is not None:
        cursor = db.patient_documents.find(
            {"patient_id": patient_id}, 
            {"_id": 0}
        ).sort("created_at", -1)
        return await cursor.to_list(length=100)
    return []

async def retrieve_document_context(
    patient_id: str,
    query: str,
    top_k: int = rag_settings.top_k
) -> tuple[str, List[Dict[str, Any]]]:
    """
    Generates query embedding, retrieves top-k chunks, and returns
    formatted grounded context along with citations list.
    """
    query_emb = await generate_embedding(query)
    chunks = vector_store.query(patient_id, query_emb, top_k=top_k)
    if not chunks:
        return "", []

    context_lines = ["--- PATIENT UPLOADED MEDICAL DOCUMENTS (VERIFIED CONTEXT) ---"]
    citations = []

    for c in chunks:
        doc_name = c["document_name"]
        page_num = c["page_number"]
        sim = c["similarity"]
        text = c["text"]

        context_lines.append(f"[Source: {doc_name} | Page: {page_num} | Relevance: {sim*100:.1f}%]")
        context_lines.append(text)
        context_lines.append("")

        citations.append({
            "document_id": c["document_id"],
            "document_name": doc_name,
            "page_number": page_num,
            "similarity": sim
        })

    context_lines.append("--- END OF UPLOADED MEDICAL DOCUMENTS ---")
    return "\n".join(context_lines), citations
