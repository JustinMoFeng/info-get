import json
import os
from pydantic import BaseModel
from typing import Optional

CONFIG_FILE = "config.json"

class AppSettings(BaseModel):
    openai_api_key: Optional[str] = None
    openai_base_url: Optional[str] = None
    openai_model: str = "gpt-3.5-turbo"
    embedding_model: str = "text-embedding-ada-002"
    chunk_size: int = 1000
    chunk_overlap: int = 200

class ConfigManager:
    _instance = None
    _settings: AppSettings = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = ConfigManager()
        return cls._instance

    def __init__(self):
        self._settings = self._load_config()

    def _load_config(self) -> AppSettings:
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r") as f:
                    data = json.load(f)
                    return AppSettings(**data)
            except Exception as e:
                print(f"Error loading config: {e}")
                return AppSettings()
        
        # Fallback to env vars
        return AppSettings(
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            openai_base_url=os.getenv("OPENAI_BASE_URL"),
            openai_model=os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
        )

    def save_config(self, settings: AppSettings):
        self._settings = settings
        with open(CONFIG_FILE, "w") as f:
            f.write(settings.model_dump_json(indent=2))

    def get_settings(self) -> AppSettings:
        return self._settings

def get_settings() -> AppSettings:
    return ConfigManager.get_instance().get_settings()

def save_settings(settings: AppSettings):
    ConfigManager.get_instance().save_config(settings)
