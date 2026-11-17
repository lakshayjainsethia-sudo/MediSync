"""
MediSync AI Care Companion — FastAPI Entry Point

Startup sequence:
  1. Connect to MongoDB
  2. Register API routes
  3. Start Uvicorn server

CORS: only allows requests from the Node.js proxy (localhost:5000),
not directly from the browser. The browser talks to Node.js which
proxies to this service — so CORS here is locked down to server-to-server.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.db.mongo import connect_db, close_db
from app.api.routes import router
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Connect to DB on startup, disconnect on shutdown."""
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="MediSync AI Care Companion",
    description="Locally-hosted patient AI assistant using Qwen2.5:1.5b via Ollama",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — only allow the Node.js API gateway (server-to-server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://api-gateway:5000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Mount all routes at root (Node.js proxy strips /api/v1/intelligence prefix)
app.include_router(router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.fastapi_host,
        port=settings.fastapi_port,
        reload=True,
    )
