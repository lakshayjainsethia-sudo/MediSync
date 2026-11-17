"""
Tool Executor

Fetches real patient data from the Node.js API Gateway by forwarding
the patient's JWT. This ensures all data access goes through the
existing auth middleware — the AI service never bypasses security.

Supported tools and their Node.js API endpoints:
  get_patient_profile       -> GET /api/v1/patients/me
  get_prescriptions         -> GET /api/v1/prescriptions/me
  get_medical_history       -> GET /api/v1/medical-records/me
  get_consultation_history  -> GET /api/v1/patients/me/appointments/past
  get_patient_summary       -> calls profile + prescriptions + medical_history (no appointments)
  general_qa                -> no data fetch (LLM answers from system prompt only)

Out of scope (intentionally omitted):
  Upcoming appointment retrieval — appointment management is outside the
  AI Care Companion scope. Patients should use the main dashboard for that.
"""

import httpx
from app.config import settings


async def _get(path: str, token: str) -> dict:
    """Make an authenticated GET request to the Node.js API."""
    url = f"{settings.node_api_base}{path}"
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        return resp.json()


def _safe_extract(response: dict) -> dict:
    """Node.js API returns {success: true, data: {...}}. Extract data."""
    if isinstance(response, dict):
        return response.get("data", response)
    return response


async def execute_tool(tool_name: str, token: str) -> tuple[str, dict]:
    """
    Execute the given tool and return (formatted_context_string, raw_data).

    Returns:
        context: Human-readable string injected into LLM prompt
        raw:     Raw API response dict (for logging/debugging)
    """
    try:
        if tool_name == "get_patient_profile":
            raw = await _get("/patients/me", token)
            data = _safe_extract(raw)
            context = _format_profile(data)

        elif tool_name == "get_prescriptions":
            raw = await _get("/prescriptions/me", token)
            data = _safe_extract(raw)
            context = _format_prescriptions(data)

        elif tool_name == "get_medical_history":
            raw = await _get("/medical-records/me", token)
            data = _safe_extract(raw)
            context = _format_medical_records(data)

        elif tool_name == "get_consultation_history":
            raw = await _get("/patients/me/appointments/past", token)
            data = _safe_extract(raw)
            context = _format_appointments(data, label="Past Consultations")

        elif tool_name == "get_patient_summary":
            # Fetch core medical context — no upcoming appointments (out of scope)
            profile_raw = await _get("/patients/me", token)
            rx_raw = await _get("/prescriptions/me", token)
            records_raw = await _get("/medical-records/me", token)

            profile = _format_profile(_safe_extract(profile_raw))
            rx = _format_prescriptions(_safe_extract(rx_raw))
            records = _format_medical_records(_safe_extract(records_raw))

            context = "\n\n".join(filter(None, [profile, rx, records]))
            raw = {"summary": True}

        else:  # general_qa and any unrecognised tool
            return "", {}

        return context, raw if isinstance(raw, dict) else {}

    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        if status == 401:
            return "ERROR:UNAUTHORIZED", {}
        elif status == 404:
            return "No records found.", {}
        else:
            return f"ERROR:HTTP_{status}", {}
    except Exception as e:
        return f"ERROR:FETCH_FAILED:{str(e)[:60]}", {}



# ── Formatters ─────────────────────────────────────────────────────────────

def _format_profile(data) -> str:
    if not data:
        return "No profile data available."
    lines = ["Patient Profile:"]
    # User-level fields
    if name := data.get("name"):
        lines.append(f"  Name: {name}")
    if email := data.get("email"):
        lines.append(f"  Email: {email}")
    if phone := data.get("phone"):
        lines.append(f"  Phone: {phone}")
    # Patient-model fields (may come from patientProfile virtual or merged object)
    profile = data.get("patientProfile", data)
    if dob := profile.get("dateOfBirth"):
        lines.append(f"  Date of Birth: {dob[:10] if isinstance(dob,str) else dob}")
    if gender := profile.get("gender"):
        lines.append(f"  Gender: {gender}")
    if bg := profile.get("bloodGroup"):
        lines.append(f"  Blood Group: {bg}")
    if allergies := profile.get("allergies"):
        if isinstance(allergies, list):
            lines.append(f"  Allergies: {', '.join(allergies) if allergies else 'None reported'}")
    if conditions := profile.get("medicalConditions"):
        if isinstance(conditions, list) and conditions:
            cond_strs = [c.get("condition", str(c)) if isinstance(c, dict) else str(c) for c in conditions]
            lines.append(f"  Medical Conditions: {', '.join(cond_strs)}")
    return "\n".join(lines)


def _format_prescriptions(data) -> str:
    if not data:
        return "No prescription records found."
    if isinstance(data, list):
        prescriptions = data
    elif isinstance(data, dict):
        prescriptions = data.get("prescriptions", [data])
    else:
        return "No prescription records found."

    if not prescriptions:
        return "No prescriptions found."

    lines = [f"Prescriptions ({len(prescriptions)} record(s)):"]
    for i, rx in enumerate(prescriptions[:5], 1):  # limit to 5 most recent
        lines.append(f"\n  Prescription #{i}:")
        if doctor := rx.get("doctor"):
            doc_name = doctor.get("name", "Unknown") if isinstance(doctor, dict) else str(doctor)
            lines.append(f"    Prescribed by: Dr. {doc_name}")
        if date := rx.get("createdAt") or rx.get("prescribedDate"):
            lines.append(f"    Date: {str(date)[:10]}")
        if status := rx.get("status"):
            lines.append(f"    Status: {status}")
        medications = rx.get("medications", [])
        if medications:
            lines.append("    Medications:")
            for med in medications:
                name = med.get("name", "Unknown")
                dosage = med.get("dosage", "")
                freq = med.get("frequency", "")
                duration = med.get("duration", "")
                instructions = med.get("instructions", "")
                timing = "Before meal" if med.get("beforeMeal") else ("After meal" if med.get("afterMeal") else "")
                med_line = f"      - {name}"
                if dosage:
                    med_line += f" {dosage}"
                if freq:
                    med_line += f", {freq}"
                if duration:
                    med_line += f", for {duration}"
                if timing:
                    med_line += f" ({timing})"
                if instructions:
                    med_line += f". Note: {instructions}"
                lines.append(med_line)
    return "\n".join(lines)


def _format_medical_records(data) -> str:
    if not data:
        return "No medical records found."
    if isinstance(data, list):
        records = data
    elif isinstance(data, dict):
        records = data.get("records", [data])
    else:
        return "No medical records found."

    if not records:
        return "No medical records found."

    lines = [f"Medical Records ({len(records)} record(s)):"]
    for i, rec in enumerate(records[:5], 1):
        lines.append(f"\n  Record #{i}:")
        if date := rec.get("visitDate") or rec.get("createdAt"):
            lines.append(f"    Visit Date: {str(date)[:10]}")
        if doc := rec.get("doctor"):
            doc_name = doc.get("name", "Unknown") if isinstance(doc, dict) else str(doc)
            lines.append(f"    Doctor: Dr. {doc_name}")
        diagnosis = rec.get("diagnosis", {})
        if isinstance(diagnosis, dict):
            if primary := diagnosis.get("primary"):
                lines.append(f"    Primary Diagnosis: {primary}")
            if secondary := diagnosis.get("secondary"):
                if isinstance(secondary, list):
                    lines.append(f"    Secondary: {', '.join(secondary)}")
            if icd := diagnosis.get("icd10Code"):
                lines.append(f"    ICD-10: {icd}")
        if chief := rec.get("chiefComplaint"):
            lines.append(f"    Chief Complaint: {chief}")
        if treatment := rec.get("treatmentPlan"):
            lines.append(f"    Treatment Plan: {str(treatment)[:120]}")
        if follow_up := rec.get("followUp", {}):
            if isinstance(follow_up, dict):
                if needed := follow_up.get("required"):
                    lines.append(f"    Follow-up Required: {needed}")
                if fdate := follow_up.get("date"):
                    lines.append(f"    Follow-up Date: {str(fdate)[:10]}")
    return "\n".join(lines)


def _format_appointments(data, label: str = "Appointments") -> str:
    if not data:
        return f"No {label.lower()} found."
    if isinstance(data, list):
        appointments = data
    elif isinstance(data, dict):
        appointments = data.get("appointments", [data])
    else:
        return f"No {label.lower()} found."

    if not appointments:
        return f"No {label.lower()} found."

    lines = [f"{label} ({len(appointments)} record(s)):"]
    for i, appt in enumerate(appointments[:5], 1):
        lines.append(f"\n  Appointment #{i}:")
        if date := appt.get("appointmentDate") or appt.get("date"):
            lines.append(f"    Date: {str(date)[:16]}")
        if doc := appt.get("doctor"):
            doc_name = doc.get("name", "Unknown") if isinstance(doc, dict) else str(doc)
            lines.append(f"    Doctor: Dr. {doc_name}")
        if dept := appt.get("department"):
            dept_name = dept.get("name", str(dept)) if isinstance(dept, dict) else str(dept)
            lines.append(f"    Department: {dept_name}")
        if status := appt.get("status"):
            lines.append(f"    Status: {status}")
        if reason := appt.get("reason") or appt.get("triage_reason"):
            lines.append(f"    Reason: {str(reason)[:100]}")
        if notes := appt.get("nurseNotes"):
            lines.append(f"    Nurse Notes: {str(notes)[:100]}")
    return "\n".join(lines)
