"""
MongoDB connection using Motor (async driver).
The ai-service connects to the same MongoDB instance as the Node.js server
but only writes to its own `ai_conversations` collection.
"""

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

_client: AsyncIOMotorClient = None
_db = None


async def connect_db():
    global _client, _db
    _client = AsyncIOMotorClient(settings.mongo_uri, serverSelectionTimeoutMS=5000)
    _db = _client.get_default_database()
    try:
        # Ensure TTL index on conversations (auto-delete after 90 days)
        await _db.ai_conversations.create_index(
            "updated_at", expireAfterSeconds=60 * 60 * 24 * 90
        )
        print(f"[DB] Connected to MongoDB: {settings.mongo_uri}")
    except Exception as e:
        print(f"[DB] Warning: Could not create TTL index: {e}")
        print(f"[DB] Service will still start; index will be created on first write.")


async def close_db():
    global _client
    if _client:
        _client.close()
        print("[DB] MongoDB connection closed")


def get_db():
    return _db
