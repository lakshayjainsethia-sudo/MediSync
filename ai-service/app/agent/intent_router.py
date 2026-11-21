"""
Deterministic Intent Router (Enhanced with Patient Document RAG)

Maps patient questions to structured tool names or patient document RAG retrieval.
This is the PRIMARY dispatch mechanism — it does NOT rely on the LLM
for routing decisions, which makes it 100% reliable regardless of
model quality or context window constraints.
"""

from typing import Optional

# Each entry: (tool_name, [keyword_patterns])
ROUTING_TABLE = [
    (
        "query_patient_documents",
        [
            "my report", "my lab", "blood report", "test report", "blood test",
            "laboratory report", "radiology", "scan report", "mri", "x-ray", "ct scan",
            "ultrasound", "biopsy", "pathology", "hemoglobin", "wbc", "rbc",
            "platelet", "cholesterol", "lipid", "creatinine", "glucose",
            "hba1c", "thyroid", "tsh", "abnormal value", "uploaded document",
            "uploaded file", "my document", "my pdf", "discharge summary",
            "what does my report say", "explain my report", "explain my test",
            "in my report", "in my test", "latest report", "previous report"
        ],
    ),
    (
        "get_patient_summary",
        [
            "health summary", "medical summary", "my summary", "summary of my health", "summary of health",
            "overview of my health", "everything about me",
            "full report", "all my info", "complete health",
        ],
    ),
    (
        "get_prescriptions",
        [
            "prescription", "medicine", "medication", "drug", "tablet",
            "capsule", "dose", "dosage", "pill", "syrup", "prescribed",
            "what am i taking", "what should i take", "when should i take",
            "dolo", "metrocil", "how to take", "take my",
        ],
    ),
    (
        "get_medical_history",
        [
            "medical history", "health history", "past diagnosis",
            "diagnosed with", "medical condition", "medical record",
            "health record", "past record",
            "do i have", "am i diagnosed", "have i been diagnosed",
            "what condition", "my condition", "my disease", "my illness",
            "my chronic", "my diagnosis",
        ],
    ),
    (
        "get_consultation_history",
        [
            "consultation", "previous visit", "last visit", "past visit",
            "doctor visit", "appointment history", "past appointment",
            "met doctor", "last appointment",
        ],
    ),
    (
        "get_patient_profile",
        [
            "my profile", "my details", "blood group", "blood type",
            "allerg", "emergency contact", "date of birth", "my age",
            "my weight", "my height", "insurance", "gender",
        ],
    ),
]

GENERAL_QA_TOOL = "general_qa"

def route_intent(query: str) -> str:
    """
    Returns the tool name that best matches the query.
    Falls back to 'general_qa' if no pattern matches.
    """
    q = query.lower()
    for tool_name, patterns in ROUTING_TABLE:
        if any(pattern in q for pattern in patterns):
            return tool_name
    return GENERAL_QA_TOOL

def explain_route(query: str) -> dict:
    """Debug helper — returns tool name and which pattern matched."""
    q = query.lower()
    for tool_name, patterns in ROUTING_TABLE:
        for pattern in patterns:
            if pattern in q:
                return {"tool": tool_name, "matched_pattern": pattern}
    return {"tool": GENERAL_QA_TOOL, "matched_pattern": None}
