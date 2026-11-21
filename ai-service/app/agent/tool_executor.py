"""
Tool Executor

Fetches real patient data from the Node.js API Gateway by forwarding
the patient's JWT. This ensures all data access goes through the
existing auth middleware — the AI service never bypasses security.
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
            # Fetch complete 360-degree patient chart
            profile_raw = await _get("/patients/me", token)
            rx_raw = await _get("/prescriptions/me", token)
            records_raw = await _get("/medical-records/me", token)
            appt_raw = await _get("/patients/me/appointments/past", token)

            profile = _format_profile(_safe_extract(profile_raw))
            rx = _format_prescriptions(_safe_extract(rx_raw))
            records = _format_medical_records(_safe_extract(records_raw))
            appts = _format_appointments(_safe_extract(appt_raw), label="Past Consultations")

            context = "\n\n".join(filter(None, [profile, rx, records, appts]))
            raw = {"summary": True}

        else:
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
    if name := data.get("name"):
        lines.append(f"  Name: {name}")
    if email := data.get("email"):
        lines.append(f"  Email: {email}")
    if phone := data.get("phone"):
        lines.append(f"  Phone: {phone}")
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
    for i, rx in enumerate(prescriptions[:6], 1):
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
                dosage = med.get("dosage", "N/A")
                freq = med.get("frequency", "N/A")
                dur = med.get("duration", "N/A")
                inst = med.get("instructions", "")
                med_str = f"      - {name} | Dosage: {dosage} | Frequency: {freq} | Duration: {dur}"
                if inst:
                    med_str += f" | Notes: {inst}"
                lines.append(med_str)
    return "\n".join(lines)


def _format_medical_records(data) -> str:
    if not data:
        return "No medical history records found."
    if isinstance(data, list):
        records = data
    elif isinstance(data, dict):
        records = data.get("records", [data])
    else:
        return "No medical history records found."

    if not records:
        return "No medical history records found."

    lines = [f"Medical Records & Clinical Diagnoses ({len(records)} record(s)):"]
    for i, rec in enumerate(records[:6], 1):
        lines.append(f"\n  Record #{i}:")
        if diagnosis := rec.get("diagnosis"):
            lines.append(f"    Diagnosis: {diagnosis}")
        if date := rec.get("date") or rec.get("createdAt"):
            lines.append(f"    Date: {str(date)[:10]}")
        if doctor := rec.get("doctor"):
            doc_name = doctor.get("name", "Unknown") if isinstance(doctor, dict) else str(doctor)
            lines.append(f"    Physician: Dr. {doc_name}")
        if symptoms := rec.get("symptoms"):
            s_str = ", ".join(symptoms) if isinstance(symptoms, list) else str(symptoms)
            lines.append(f"    Symptoms: {s_str}")
        if treatment := rec.get("treatment"):
            lines.append(f"    Treatment/Plan: {treatment}")
        if notes := rec.get("notes"):
            lines.append(f"    Clinical Notes: {notes}")
    return "\n".join(lines)


def _format_appointments(data, label="Appointments") -> str:
    if not data:
        return f"No {label.lower()} found."
    if isinstance(data, list):
        appts = data
    elif isinstance(data, dict):
        appts = data.get("appointments", [data])
    else:
        return f"No {label.lower()} found."

    if not appts:
        return f"No {label.lower()} found."

    lines = [f"{label} ({len(appts)} record(s)):"]
    for i, a in enumerate(appts[:6], 1):
        lines.append(f"\n  Visit #{i}:")
        if doctor := a.get("doctor"):
            doc_name = doctor.get("name", "Unknown") if isinstance(doctor, dict) else str(doctor)
            lines.append(f"    Doctor: Dr. {doc_name}")
        if date := a.get("appointmentDate") or a.get("date"):
            lines.append(f"    Date: {str(date)[:16]}")
        if reason := a.get("reason"):
            lines.append(f"    Reason for Visit: {reason}")
        if status := a.get("status"):
            lines.append(f"    Status: {status}")
        if notes := a.get("notes"):
            lines.append(f"    Consultation Notes: {notes}")
    return "\n".join(lines)
