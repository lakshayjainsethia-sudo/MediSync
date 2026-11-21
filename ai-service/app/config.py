from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Ollama
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:1.5b"
    ollama_num_ctx: int = 1536
    ollama_num_predict: int = 400
    ollama_temperature: float = 0.3

    # MongoDB
    mongo_uri: str = "mongodb://localhost:27017/medisync"

    # Node.js API Gateway
    node_api_base: str = "http://localhost:5000/api/v1"

    # FastAPI
    fastapi_port: int = 8000
    fastapi_host: str = "0.0.0.0"

    # Conversation
    max_conversation_messages: int = 20
    max_context_chars: int = 3500

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
