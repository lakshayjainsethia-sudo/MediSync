"""
Post-audit routing accuracy test.
Validates intent_router after all audit fixes.
"""
import sys
sys.path.insert(0, '.')

from app.agent.intent_router import route_intent

cases = [
    # Core tools should still work
    ("Show me my current prescriptions", "get_prescriptions"),
    ("What medications am I on?", "get_prescriptions"),
    ("What is my medical history?", "get_medical_history"),
    ("My allergies and blood type", "get_patient_profile"),
    ("Past consultations with my doctor", "get_consultation_history"),
    ("Give me a health summary", "get_patient_summary"),
    ("My overall medical summary", "get_patient_summary"),
    # Appointment queries must route to general_qa (removed from scope)
    ("When is my next appointment?", "general_qa"),
    ("Upcoming appointment details", "general_qa"),
    ("Schedule an appointment", "general_qa"),
    # False-positive checks: disease name in 3rd-person context
    ("My friend has cancer, what should he eat?", "general_qa"),
    ("What causes diabetes in general?", "general_qa"),
    # Bare "summary" of non-medical thing
    ("Give me a summary of the news today", "general_qa"),
    # General health education
    ("What is hypertension?", "general_qa"),
    ("What is the capital of France?", "general_qa"),
    # First-person condition inquiry still routes correctly
    ("Do I have any chronic conditions?", "get_medical_history"),
]

passed = 0
failed = 0
for query, expected in cases:
    got = route_intent(query)
    ok = got == expected
    if ok:
        passed += 1
        print(f"[PASS] {repr(query)}")
        print(f"       -> {got}")
    else:
        failed += 1
        print(f"[FAIL] {repr(query)}")
        print(f"       expected={expected}, got={got}")

print(f"\nScore: {passed}/{len(cases)} passed, {failed} failed")
sys.exit(0 if failed == 0 else 1)
