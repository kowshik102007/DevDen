from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core import crypto
from app.core.database import get_db
from app.models.provider import Provider
from app.models.provider_key import ProviderKey
from app.schemas.provider_key import ProviderKeyCreate, ProviderKeyUpdate, ProviderKeyResponse
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/providers/{provider_id}/keys", tags=["provider-keys"])
security = HTTPBearer()


def _current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    return get_current_user(db, credentials.credentials)


def _get_provider(db: Session, user_id: UUID, provider_id: UUID) -> Provider:
    p = db.query(Provider).filter(
        Provider.id == provider_id, Provider.user_id == user_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    return p


@router.get("", response_model=list[ProviderKeyResponse])
def list_keys(
    provider_id: UUID,
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    _get_provider(db, user.id, provider_id)
    return (
        db.query(ProviderKey)
        .filter(ProviderKey.provider_id == provider_id)
        .order_by(ProviderKey.created_at)
        .all()
    )


@router.post("", response_model=ProviderKeyResponse, status_code=201)
def add_key(
    provider_id: UUID,
    data: ProviderKeyCreate,
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    _get_provider(db, user.id, provider_id)
    pk = ProviderKey(
        provider_id=provider_id,
        label=data.label,
        api_key=crypto.encrypt(data.api_key),
    )
    db.add(pk)
    db.commit()
    db.refresh(pk)
    return pk


@router.patch("/{key_id}", response_model=ProviderKeyResponse)
def update_key(
    provider_id: UUID,
    key_id: UUID,
    data: ProviderKeyUpdate,
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    _get_provider(db, user.id, provider_id)
    pk = db.query(ProviderKey).filter(
        ProviderKey.id == key_id, ProviderKey.provider_id == provider_id
    ).first()
    if not pk:
        raise HTTPException(status_code=404, detail="Key not found")
    updates = data.model_dump(exclude_none=True)
    for field, value in updates.items():
        if field == "api_key":
            if "…" in value:
                continue
            value = crypto.encrypt(value)
        setattr(pk, field, value)
    db.commit()
    db.refresh(pk)
    return pk


@router.delete("/{key_id}", status_code=204)
def delete_key(
    provider_id: UUID,
    key_id: UUID,
    user=Depends(_current_user),
    db: Session = Depends(get_db),
):
    _get_provider(db, user.id, provider_id)
    pk = db.query(ProviderKey).filter(
        ProviderKey.id == key_id, ProviderKey.provider_id == provider_id
    ).first()
    if not pk:
        raise HTTPException(status_code=404, detail="Key not found")
    db.delete(pk)
    db.commit()
