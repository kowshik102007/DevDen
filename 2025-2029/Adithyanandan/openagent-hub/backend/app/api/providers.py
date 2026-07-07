from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.provider import ProviderCreate, ProviderUpdate, ProviderResponse, ProviderTestResult
from app.services.auth_service import get_current_user
from app.services.catalog_service import sync_provider_models
from app.services.provider_service import (
    list_providers,
    create_provider,
    update_provider,
    delete_provider,
    test_provider,
    fetch_provider_models,
    get_provider,
)

from app.services.provider_presets import preset_dicts

router = APIRouter(prefix="/providers", tags=["providers"])
security = HTTPBearer()


@router.get("/presets")
def get_presets():
    """Known provider quick-add presets (base URL, free-tier notes). Public —
    no secrets, used to populate the Add Provider form."""
    return preset_dicts()


def _current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    return get_current_user(db, credentials.credentials)


@router.get("", response_model=list[ProviderResponse])
def get_providers(user=Depends(_current_user), db: Session = Depends(get_db)):
    return list_providers(db, user.id)


@router.post("", response_model=ProviderResponse, status_code=201)
def add_provider(data: ProviderCreate, user=Depends(_current_user), db: Session = Depends(get_db)):
    return create_provider(db, user.id, data)


@router.put("/{provider_id}", response_model=ProviderResponse)
def edit_provider(
    provider_id: UUID,
    data: ProviderUpdate,
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    try:
        return update_provider(db, user.id, provider_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{provider_id}", status_code=204)
def remove_provider(
    provider_id: UUID,
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    try:
        delete_provider(db, user.id, provider_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{provider_id}/test", response_model=ProviderTestResult)
async def test_provider_route(
    provider_id: UUID,
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    try:
        result = await test_provider(db, user.id, provider_id)
        # Auto-sync models into catalog on successful test
        if result.status == "healthy" and result.models:
            provider = get_provider(db, user.id, provider_id)
            sync_provider_models(db, user.id, provider, result.models)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{provider_id}/models")
async def get_provider_models(
    provider_id: UUID,
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    try:
        models = await fetch_provider_models(db, user.id, provider_id)
        return {"models": models}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        # Upstream slow/down: fall back to the last-synced catalog for this
        # provider so the model picker degrades gracefully instead of erroring.
        from app.models.model_catalog import ModelCatalog
        cached = (
            db.query(ModelCatalog)
            .filter(ModelCatalog.user_id == user.id, ModelCatalog.provider_id == provider_id, ModelCatalog.is_free == True)
            .all()
        )
        if cached:
            return {"models": [c.model_id for c in cached], "stale": True}
        raise HTTPException(status_code=502, detail=f"Failed to fetch models: {e}")
