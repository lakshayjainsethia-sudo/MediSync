import sys
sys.path.insert(0, r'c:\Users\jainm\OneDrive\Desktop\Medisync\ai-service')
from app.main import app
from app.api.routes import _resolve_patient_id
from app.llm.ollama_provider import SYSTEM_PROMPT, generate_response
from app.agent.orchestrator import process_message

# Verify system prompt contains corrected text
assert "112" not in SYSTEM_PROMPT, "Emergency number 112 still in SYSTEM_PROMPT"
assert "local emergency services" in SYSTEM_PROMPT, "Emergency wording not updated"
assert "NEW diagnoses" in SYSTEM_PROMPT or "new diagnoses" in SYSTEM_PROMPT.lower(), "Rule 2 not updated"

# Verify orchestrator has separate llm_error variable
import inspect
src = inspect.getsource(process_message)
assert "llm_error" in src, "llm_error variable not present in orchestrator"
assert "fetch_error or llm_error" in src, "fetch_error/llm_error merge missing"

print("[PASS] FastAPI app imports OK")
print("[PASS] _resolve_patient_id importable")
print("[PASS] SYSTEM_PROMPT: no hardcoded 112, correct emergency wording")
print("[PASS] SYSTEM_PROMPT Rule 2 updated (documented vs new diagnosis)")
print("[PASS] orchestrator.py: separate fetch_error and llm_error variables")
