"""
app/rag/chunker.py
Structure-aware clinical text chunker.
Splits medical documents along logical section headers (Test results, Impressions,
Findings, Clinical History, Prescriptions) while enforcing token/character bounds.
"""

import re
from typing import List, Dict, Any
from app.rag.config import rag_settings

# Clinical boundary headers frequently seen in hospital & lab reports
CLINICAL_HEADERS = [
    r"PATIENT\s+INFORMATION",
    r"CLINICAL\s+HISTORY",
    r"CHIEF\s+COMPLAINT",
    r"DIAGNOSIS",
    r"IMPRESSION",
    r"FINDINGS",
    r"LABORATORY\s+RESULTS",
    r"TEST\s+NAME",
    r"REFERENCE\s+INTERVAL",
    r"REFERENCE\s+RANGE",
    r"RECOMMENDATIONS",
    r"MEDICATIONS",
    r"DISCHARGE\s+SUMMARY",
    r"TREATMENT\s+PLAN",
]

HEADER_REGEX = re.compile(
    r"(?i)(^|\n)(" + "|".join(CLINICAL_HEADERS) + r")[:\n\r]"
)

def chunk_document_pages(
    pages_data: List[Dict[str, Any]], 
    chunk_size: int = rag_settings.chunk_size, 
    chunk_overlap: int = rag_settings.chunk_overlap
) -> List[Dict[str, Any]]:
    """
    Creates structured chunks preserving page numbers and section continuity.
    Returns:
      [
        {
          "chunk_index": 0,
          "page_number": 1,
          "text": "..."
        },
        ...
      ]
    """
    chunks = []
    chunk_index = 0

    for page_item in pages_data:
        page_num = page_item["page_number"]
        page_text = page_item["text"]

        # 1. First split page into clinical sections if present
        sections = []
        last_pos = 0
        for match in HEADER_REGEX.finditer(page_text):
            start = match.start()
            if start > last_pos:
                section_text = page_text[last_pos:start].strip()
                if section_text:
                    sections.append(section_text)
            last_pos = start
        if last_pos < len(page_text):
            remaining = page_text[last_pos:].strip()
            if remaining:
                sections.append(remaining)

        if not sections:
            sections = [page_text]

        # 2. Window each section into chunk_size limits
        for sec in sections:
            words = sec.split()
            if not words:
                continue

            if len(words) <= chunk_size:
                chunks.append({
                    "chunk_index": chunk_index,
                    "page_number": page_num,
                    "text": " ".join(words)
                })
                chunk_index += 1
            else:
                # Sliding window with overlap
                start_idx = 0
                while start_idx < len(words):
                    end_idx = min(start_idx + chunk_size, len(words))
                    chunk_words = words[start_idx:end_idx]
                    chunks.append({
                        "chunk_index": chunk_index,
                        "page_number": page_num,
                        "text": " ".join(chunk_words)
                    })
                    chunk_index += 1
                    if end_idx >= len(words):
                        break
                    start_idx += (chunk_size - chunk_overlap)

    return chunks
