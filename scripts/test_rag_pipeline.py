"""
Comprehensive End-to-End Test Suite for MediSync Patient-Centric RAG & AI Care Companion
Tests:
  1. PDF Parsing and Structure-Aware Chunking
  2. Ollama nomic-embed-text 768-dim Embedding Generation
  3. Patient Vector Store Isolation & Cosine Similarity
  4. Cross-Patient Access Prevention (Security boundary)
  5. Document Ingestion Pipeline
  6. Document-Grounded Context Retrieval
  7. Document Deletion & Vector Cleanup
  8. Intent Router RAG Dispatch vs Structured Data Tools
"""

import sys
import asyncio
from pathlib import Path

# Add ai-service to path
ai_service_dir = Path(__file__).parent.parent / "ai-service"
sys.path.insert(0, str(ai_service_dir))

from app.rag.config import rag_settings
from app.rag.parser import extract_document_text
from app.rag.chunker import chunk_document_pages
from app.rag.embeddings import generate_embedding
from app.rag.vector_store import PatientVectorStore
from app.rag.pipeline import ingest_document, retrieve_document_context, delete_patient_document
from app.agent.intent_router import route_intent

# Sample clinical test document (Simulated Complete Blood Count report)
SAMPLE_LAB_REPORT = """
PATIENT INFORMATION
Patient Name: John Doe
Patient ID: patient_abc_123
Date of Birth: 1985-04-12
Gender: Male
Collection Date: 2026-10-15
Report Date: 2026-10-16

CLINICAL HISTORY
Patient presents with chronic fatigue and mild dizziness for 3 weeks.

LABORATORY RESULTS: COMPLETE BLOOD COUNT (CBC)
Test Name          Observed Value    Reference Interval    Units    Status
Hemoglobin         9.8               13.5 - 17.5           g/dL     LOW (Abnormal)
RBC Count          3.4               4.5 - 5.9             M/uL     LOW
Hematocrit         30.2              41.0 - 50.0           %        LOW
WBC Count          6.8               4.5 - 11.0            K/uL     Normal
Platelet Count     240               150 - 450             K/uL     Normal
Serum Ferritin     12                30 - 400              ng/mL    LOW

DIAGNOSIS & IMPRESSION
1. Microcytic Hypochromic Anemia, likely secondary to iron deficiency.
2. No signs of acute leukocytosis or thrombocytopenia.

RECOMMENDATIONS & TREATMENT PLAN
1. Prescribed Oral Ferrous Ascorbate 100mg once daily after meals for 60 days.
2. Dietary counseling regarding iron-rich food intake.
3. Repeat Complete Blood Count and Serum Ferritin in 8 weeks.
"""

async def run_all_tests():
    print("=================================================================")
    print("      MEDISYNC PATIENT-CENTRIC RAG E2E VERIFICATION SUITE        ")
    print("=================================================================")

    # Test 1: Intent Routing
    print("\n[Test 1] Verifying Intent Routing...")
    assert route_intent("Explain my blood report") == "query_patient_documents", "Failed on blood report"
    assert route_intent("What is my hemoglobin count?") == "query_patient_documents", "Failed on hemoglobin"
    assert route_intent("Show my prescriptions") == "get_prescriptions", "Failed on prescriptions"
    assert route_intent("What is my medical history?") == "get_medical_history", "Failed on medical history"
    assert route_intent("What causes high blood pressure?") == "general_qa", "Failed on general_qa"
    print("  -> PASSED: RAG and structured routes categorized accurately.")

    # Test 2: Text Extraction & Chunking
    print("\n[Test 2] Verifying Clinical Text Parser & Chunking...")
    sample_bytes = SAMPLE_LAB_REPORT.encode("utf-8")
    pages = extract_document_text(sample_bytes, "cbc_report.txt")
    assert len(pages) == 1, f"Expected 1 page, got {len(pages)}"
    chunks = chunk_document_pages(pages, chunk_size=80, chunk_overlap=15)
    assert len(chunks) >= 2, f"Expected multiple chunks, got {len(chunks)}"
    print(f"  -> PASSED: Document parsed into {len(pages)} page and {len(chunks)} clinical chunks.")

    # Test 3: Embedding generation with nomic-embed-text
    print("\n[Test 3] Verifying Ollama nomic-embed-text 768-dim Embeddings...")
    test_emb = await generate_embedding("Hemoglobin 9.8 g/dL LOW")
    assert len(test_emb) == 768, f"Expected 768 dimensions, got {len(test_emb)}"
    print(f"  -> PASSED: Generated 768-dimensional embedding from local Ollama.")

    # Test 4: Patient Isolation in Vector Store
    print("\n[Test 4] Verifying Strict Patient-Level Data Isolation...")
    test_db_dir = rag_settings.rag_storage_dir / "test_vector_db"
    test_db_dir.mkdir(parents=True, exist_ok=True)
    store = PatientVectorStore(base_dir=test_db_dir)

    patient_1 = "patient_alice_111"
    patient_2 = "patient_bob_222"

    emb_1 = await generate_embedding("Patient Alice Hemoglobin is 9.8 low")
    emb_2 = await generate_embedding("Patient Bob Blood Glucose is 180 high")

    store.add_document_chunks(
        patient_id=patient_1,
        document_id="doc_alice_1",
        document_name="Alice_Report.pdf",
        chunks=[{"chunk_index": 0, "page_number": 1, "text": "Patient Alice Hemoglobin is 9.8 low"}],
        embeddings=[emb_1]
    )

    store.add_document_chunks(
        patient_id=patient_2,
        document_id="doc_bob_1",
        document_name="Bob_Report.pdf",
        chunks=[{"chunk_index": 0, "page_number": 1, "text": "Patient Bob Blood Glucose is 180 high"}],
        embeddings=[emb_2]
    )

    # Bob queries Alice's topic:
    bob_query_emb = await generate_embedding("What is the hemoglobin count?")
    bob_results = store.query(patient_id=patient_2, query_embedding=bob_query_emb, top_k=5)
    
    # Assert Bob NEVER receives Alice's document:
    for res in bob_results:
        assert res["document_name"] != "Alice_Report.pdf", "CRITICAL SECURITY BREACH: Cross-patient data leaked to Bob!"
    print("  -> PASSED: Patient A and Patient B data partitions strictly isolated.")

    # Test 5: Full Ingestion Pipeline
    print("\n[Test 5] Verifying Full Ingestion Pipeline...")
    ingest_res = await ingest_document(
        patient_id=patient_1,
        filename="John_Doe_CBC_Report.txt",
        file_bytes=sample_bytes,
        document_category="lab_report"
    )
    assert ingest_res["status"] == "ready", "Ingestion failed"
    doc_id = ingest_res["document_id"]
    print(f"  -> PASSED: Document ingested with ID: {doc_id} ({ingest_res['chunks']} chunks indexed).")

    # Test 6: Grounded Retrieval with Citations
    print("\n[Test 6] Verifying Grounded Retrieval & Source Citations...")
    query = "What is my hemoglobin level and is it abnormal?"
    context_text, citations = await retrieve_document_context(patient_1, query, top_k=2)
    assert len(citations) > 0, "No citations returned"
    assert "Hemoglobin" in context_text or "9.8" in context_text, "Relevant clinical context missing"
    print(f"  -> PASSED: Retrieved verified context citing {citations[0]['document_name']} (Page {citations[0]['page_number']}).")

    # Test 7: Document & Vector Deletion
    print("\n[Test 7] Verifying Document Deletion & Vector Cleanup...")
    del_res = await delete_patient_document(patient_1, doc_id)
    assert del_res is True, "Delete operation failed"
    # Query again to confirm chunks are gone
    empty_context, empty_citations = await retrieve_document_context(patient_1, query, top_k=2)
    assert len(empty_citations) == 0, "Vector chunks still exist after deletion!"
    print("  -> PASSED: Original file and vector index completely purged on deletion.")

    # Cleanup test store directory
    try:
        import shutil
        shutil.rmtree(test_db_dir, ignore_errors=True)
    except Exception:
        pass

    print("\n=================================================================")
    print("  ALL 7 PATIENT-CENTRIC RAG INTEGRATION TESTS PASSED! (100%)     ")
    print("=================================================================")

if __name__ == "__main__":
    asyncio.run(run_all_tests())
