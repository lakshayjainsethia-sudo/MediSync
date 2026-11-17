"""
Deterministic Intent Router

Maps patient questions to tool names using keyword pattern matching.
This is the PRIMARY dispatch mechanism — it does NOT rely on the LLM
for routing decisions, which makes it 100% reliable regardless of
model quality or context window constraints.

Architecture rationale:
  qwen2.5:1.5b cannot use /api/chat (OOM on this machine's RAM config),
  so native LLM tool calling is not available. The deterministic router
  provides the same routing behavior with zero latency and zero LLM errors.

Scope:
  Appointment management (upcoming/scheduling) is explicitly OUT OF SCOPE
  for the AI Care Companion. Only past consultation history is supported
  because it is part of the medical record context.
"""

from typing import Optional

# Each entry: (tool_name, [keyword_patterns])
# Patterns are matched case-insensitively as substrings of the user query.
# Order matters — more specific patterns should come first.
ROUTING_TABLE = [
    (
        "get_patient_summary",
        [
            # Require "my" or "health" to avoid matching generic uses of "summary"
            "health summary", "medical summary", "my summary",
            "overview of my health", "everything about me",
            "full report", "all my info", "complete health",
        ],
    ),
    (
        "get_prescriptions",
        [
            "prescription", "medicine", "medication", "drug", "tablet",
            "capsule", "dose", "dosage", "pill", "syrup", "prescribed",
            "what am i taking", "what should i take",
        ],
    ),
    (
        "get_medical_history",
        [
            "medical history", "health history", "past diagnosis",
            "diagnosed with", "medical condition", "medical record",
            "health record", "past record",
            # First-person condition-inquiry patterns only
            # (avoid bare disease names to prevent false positives on third-party queries)
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
    # NOTE: get_upcoming_appointments intentionally omitted.
    # Appointment management is outside the AI Care Companion scope.
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

