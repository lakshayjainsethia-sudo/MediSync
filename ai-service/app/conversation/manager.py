"""
Conversation Manager

Persists patient conversations to the ai_conversations MongoDB collection.
Each document represents one conversation session per patient.

Schema:
{
  _id: ObjectId,
  patient_id: string,          -- MongoDB ObjectId of the patient user
  messages: [
    { role: "user"|"assistant", content: string, timestamp: datetime }
  ],
  created_at: datetime,
  updated_at: datetime         -- TTL index on this field (90 days)
}

The conversation_id returned to the frontend is the MongoDB _id as a string.
"""

from datetime import datetime, timezone
from bson import ObjectId
from app.db.mongo import get_db
from app.config import settings


def _now():
    return datetime.now(timezone.utc)


async def get_or_create_conversation(patient_id: str, conversation_id: str = None) -> dict:
    """
    Load an existing conversation or create a new one.
    Returns the full conversation document.
    """
    db = get_db()

    if conversation_id:
        try:
            doc = await db.ai_conversations.find_one({
                "_id": ObjectId(conversation_id),
                "patient_id": patient_id,  # Security: ensure patient owns this convo
            })
            if doc:
                return doc
        except Exception:
            pass  # Invalid ObjectId — fall through to create new

    # Create new conversation
    doc = {
        "patient_id": patient_id,
        "messages": [],
        "created_at": _now(),
        "updated_at": _now(),
    }
    result = await db.ai_conversations.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def append_message(conversation_id: str, patient_id: str, role: str, content: str) -> bool:
    """Append a message to the conversation. Returns True on success."""
    db = get_db()
    message = {
        "role": role,
        "content": content,
        "timestamp": _now(),
    }
    result = await db.ai_conversations.update_one(
        {
            "_id": ObjectId(conversation_id),
            "patient_id": patient_id,
        },
        {
            "$push": {"messages": message},
            "$set": {"updated_at": _now()},
        },
    )
    return result.modified_count > 0


async def get_recent_messages(conversation_id: str, patient_id: str, limit: int = None) -> list:
    """Return the most recent N messages for prompt context."""
    if limit is None:
        limit = settings.max_conversation_messages

    db = get_db()
    doc = await db.ai_conversations.find_one(
        {"_id": ObjectId(conversation_id), "patient_id": patient_id},
        {"messages": {"$slice": -limit}},
    )
    if not doc:
        return []
    return doc.get("messages", [])


async def list_conversations(patient_id: str, limit: int = 10) -> list:
    """List recent conversations for a patient (for sidebar history)."""
    db = get_db()
    cursor = db.ai_conversations.find(
        {"patient_id": patient_id},
        {"messages": {"$slice": -1}, "created_at": 1, "updated_at": 1},
    ).sort("updated_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [_serialize(d) for d in docs]


async def delete_conversation(conversation_id: str, patient_id: str) -> bool:
    """Hard-delete a conversation (patient-initiated)."""
    db = get_db()
    result = await db.ai_conversations.delete_one(
        {"_id": ObjectId(conversation_id), "patient_id": patient_id}
    )
    return result.deleted_count > 0


def _serialize(doc: dict) -> dict:
    """Convert ObjectId fields to strings for JSON serialization."""
    doc["_id"] = str(doc["_id"])
    for msg in doc.get("messages", []):
        if "timestamp" in msg and isinstance(msg["timestamp"], datetime):
            msg["timestamp"] = msg["timestamp"].isoformat()
    if "created_at" in doc and isinstance(doc["created_at"], datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    if "updated_at" in doc and isinstance(doc["updated_at"], datetime):
        doc["updated_at"] = doc["updated_at"].isoformat()
    return doc
