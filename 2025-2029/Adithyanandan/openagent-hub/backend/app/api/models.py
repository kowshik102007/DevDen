from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core import crypto
from app.core.provider import fetch_models
from app.services.auth_service import get_current_user
from app.services.llm_service import get_provider_config, update_provider_config
from app.schemas.chat import ProviderConfigRequest, ProviderConfigResponse

router = APIRouter(prefix="/provider", tags=["provider"])
security = HTTPBearer()


def _current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    return get_current_user(db, credentials.credentials)


@router.get("/config", response_model=ProviderConfigResponse)
def get_config(user=Depends(_current_user), db: Session = Depends(get_db)):
    return get_provider_config(db, user.id)


@router.put("/config", response_model=ProviderConfigResponse)
def set_config(data: ProviderConfigRequest, user=Depends(_current_user), db: Session = Depends(get_db)):
    return update_provider_config(db, user.id, data.base_url, data.api_key, data.model, data.name or "Default")


@router.get("/models")
async def list_models(user=Depends(_current_user), db: Session = Depends(get_db)):
    provider = get_provider_config(db, user.id)
    # Router-mode users often have no usable single-provider config (they manage
    # models per-provider instead). A missing/unreachable single config is an
    # expected state, not an error — return an empty list so the UI stays quiet
    # and falls back to the multi-provider model lists.
    if not provider or not provider.base_url:
        return {"models": []}
    try:
        models = await fetch_models(provider.base_url, crypto.decrypt(provider.api_key))
        return {"models": models}
    except Exception:
        return {"models": []}
