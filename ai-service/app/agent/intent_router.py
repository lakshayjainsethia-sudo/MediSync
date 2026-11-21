"""
Deterministic Intent Router (Enhanced with Patient Document RAG)

Maps patient questions to structured tool names or patient document RAG retrieval.
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
            "overview of my health", "everything about me", "tell me everything", "tell me about myself",
            "full report", "all my info", "complete health", "all my records", "all records", "my data",
            "what do you know about me", "who am i", "patient record", "patient records"
        ],
    ),
    (
        "get_prescriptions",
        [
            "prescription", "prescriptions", "medicine", "medicines", "medication", "medications",
            "drug", "drugs", "tablet", "tablets", "capsule", "capsules", "dose", "dosage",
            "pill", "pills", "syrup", "prescribed", "what am i taking", "what should i take",
            "when should i take", "dolo", "metrocil", "how to take", "take my", "refill", "pharmacy"
        ],
    ),
    (
        "get_medical_history",
        [
            "medical history", "health history", "past diagnosis", "diagnosed with",
            "medical condition", "medical conditions", "medical record", "medical records",
            "health record", "health records", "past record", "past records", "diagnoses",
            "do i have", "am i diagnosed", "have i been diagnosed", "what condition",
            "my condition", "my disease", "my illness", "my chronic", "my diagnosis",
            "clinical record", "clinical note"
        ],
    ),
    (
        "get_consultation_history",
        [
            "consultation", "consultations", "previous visit", "previous visits", "last visit",
            "past visit", "past visits", "doctor visit", "doctor visits", "appointment history",
            "past appointment", "past appointments", "met doctor", "last appointment",
            "dr ", "doctor consultation", "my appointments"
        ],
    ),
    (
        "get_patient_profile",
        [
            "my profile", "my details", "blood group", "blood type", "allerg", "allergy", "allergies",
            "emergency contact", "date of birth", "my age", "how old am i", "my weight", "my height",
            "insurance", "gender", "phone number", "contact details"
        ],
    ),
]

GENERAL_QA_TOOL = "general_qa"

def route_intent(query: str) -> str:
    """
    Returns the tool name that best matches the query.
    Falls back to 'general_qa' if no specific category matched.
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
