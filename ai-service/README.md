# MediSync AI Care Companion

> Locally-hosted patient AI assistant integrated into the MediSync healthcare platform.

## Overview

The AI Care Companion is a patient-facing conversational assistant built with:

- **LLM**: [Qwen2.5:1.5b](https://ollama.com/library/qwen2.5) via [Ollama](https://ollama.com) (runs 100% locally, no cloud API)
- **Backend**: Python + FastAPI (`ai-service/`)
- **Architecture**: Deterministic intent routing + LLM response generation
- **Storage**: MongoDB `ai_conversations` collection (shared with existing MediSync DB)
- **Security**: All patient data fetched through existing Node.js auth middleware using the patient's JWT — no auth bypass

## Features

| Capability | What it does |
|---|---|
| Prescription Intelligence | Retrieves & explains current prescriptions |
| Medical Record Intelligence | Summarizes past medical records & diagnoses |
| Consultation History | Recalls past doctor visits |
| Upcoming Appointments | Shows scheduled appointments |
| Patient Profile | Blood group, allergies, emergency contacts |
| Full Health Summary | All of the above in one response |
| General Q&A | General healthcare questions (with safety guardrails) |

## Safety Guardrails

- **Never diagnoses** — always redirects to a doctor
- **Never prescribes** — explains existing prescriptions only
- **Only uses your own data** — cross-patient isolation enforced at API level
- **Emergency redirect** — directs to emergency services (112) for urgent symptoms
- **100% local** — no patient data leaves your network

## Quick Start (Development)

### Prerequisites

```powershell
# Install Ollama: https://ollama.com/download
# Pull the model (one-time):
ollama pull qwen2.5:1.5b

# Install Python dependencies:
cd ai-service
pip install -r requirements.txt
```

### Run

```powershell
# Option A: Use the helper script
.\start-ai-dev.ps1

# Option B: Manual
Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
cd ai-service
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Then start the main stack:
```powershell
docker-compose up
```

Open `http://localhost:5173`, log in as a **Patient**, and click **AI Care Companion** in the sidebar.

## Full Docker Stack (Production)

```powershell
# Ollama must run on the host (Docker can't run GPU models inside containers easily)
Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden

# Everything else in Docker
docker-compose up --build
```

The `ai-service` container communicates with Ollama on the host via `host.docker.internal:11434`.

## API Endpoints

All routes proxied through Node.js at `/api/v1/intelligence/*`:

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/intelligence/chat` | Send a message, get AI response |
| `POST` | `/api/v1/intelligence/conversations` | Start new conversation |
| `GET` | `/api/v1/intelligence/conversations` | List patient's conversations |
| `GET` | `/api/v1/intelligence/conversations/:id/messages` | Get conversation messages |
| `DELETE` | `/api/v1/intelligence/conversations/:id` | Delete a conversation |
| `GET` | `/api/v1/intelligence/health` | Service health check |
| `GET` | `/api/v1/intelligence/debug/route?q=...` | Debug intent routing |

## Architecture

```
Patient
  ↓ Authorization: Bearer <JWT>
POST /api/v1/intelligence/chat
  ↓ (Node.js proxy strips prefix)
FastAPI :8000/chat
  ↓
intent_router.py      ← deterministic keyword match
  ↓ tool_name
tool_executor.py      ← GET /api/v1/patients/me (with JWT)
  ↓ formatted patient data
ollama_provider.py    ← /api/generate, num_ctx=512
  ↓ natural language response
conversation/manager  ← persist to MongoDB
  ↓
{response, conversation_id, tool_used}
```

## Configuration

Copy `ai-service/.env.example` to `ai-service/.env` and set:

```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:1.5b
OLLAMA_NUM_CTX=512        # Keep at 512 — higher causes OOM on <4GB free RAM
MONGO_URI=mongodb://localhost:27017/medisync
NODE_API_BASE=http://localhost:5000/api/v1
```
