from fastapi import APIRouter, HTTPException, Depends
from backend.app.core.config import AppSettings, get_settings, save_settings
from backend.app.api.deps import ServiceContainer, get_services, reset_services

router = APIRouter()

@router.get("")
def read_settings():
    try:
        return get_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
def update_settings(settings: AppSettings):
    try:
        save_settings(settings)
        # Reset services to force reload with new settings
        reset_services()
        return {"message": "Settings updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
