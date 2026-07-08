from sqlalchemy.orm import Session
from app.models.provider_config import ProviderConfig
from app.core import crypto
from uuid import UUID
from fastapi import HTTPException


def get_provider_config(db: Session, user_id: UUID) -> ProviderConfig:
    config = db.query(ProviderConfig).filter(
        ProviderConfig.user_id == user_id,
        ProviderConfig.is_default == True,
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="No provider configured")
    return config


def update_provider_config(
    db: Session, user_id: UUID, base_url: str, api_key: str, model: str, name: str = "Default"
) -> ProviderConfig:
    config = db.query(ProviderConfig).filter(
        ProviderConfig.user_id == user_id,
        ProviderConfig.is_default == True,
    ).first()
    if not config:
        config = ProviderConfig(user_id=user_id, is_default=True)
        db.add(config)

    config.name = name
    config.base_url = base_url
    # A masked key echoed back from the UI must not overwrite the real secret.
    if "…" not in api_key:
        config.api_key = crypto.encrypt(api_key)
    config.model = model
    db.commit()
    db.refresh(config)
    return config
