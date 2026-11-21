"""
app/rag/parser.py
Extracts text and metadata from uploaded clinical documents (PDF, TXT).
Preserves page numbers and identifies key medical document sections.
"""

import io
from pathlib import Path
from typing import List, Dict, Any
from pypdf import PdfReader

def extract_document_text(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    """
    Extracts pages with page numbers and text.
    Returns:
      [
        {"page_number": 1, "text": "extracted text..."},
        ...
      ]
    """
    pages_data = []
    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        reader = PdfReader(io.BytesIO(file_bytes))
        for page_idx, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            # Basic cleanup
            cleaned_text = "\n".join(
                line.strip() for line in text.splitlines() if line.strip()
            )
            if cleaned_text:
                pages_data.append({
                    "page_number": page_idx + 1,
                    "text": cleaned_text
                })
    elif ext == ".txt":
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1", errors="ignore")
        
        cleaned_text = "\n".join(
            line.strip() for line in text.splitlines() if line.strip()
        )
        if cleaned_text:
            pages_data.append({
                "page_number": 1,
                "text": cleaned_text
            })
    else:
        raise ValueError(f"Unsupported file format: {ext}")

    return pages_data
