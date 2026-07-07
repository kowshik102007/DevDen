from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.api_token import ApiTokenCreate, ApiTokenResponse, ApiTokenCreated
from app.services.auth_service import get_current_user
from app.services.api_token_service import (
    list_tokens,
    create_token,
    revoke_token,
)

router = APIRouter(prefix="/tokens", tags=["tokens"])
security = HTTPBearer()


def _current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    return get_current_user(db, credentials.credentials)


@router.get("", response_model=list[ApiTokenResponse])
def get_tokens(user=Depends(_current_user), db: Session = Depends(get_db)):
    return list_tokens(db, user.id)


@router.post("", response_model=ApiTokenCreated, status_code=201)
def add_token(data: ApiTokenCreate, user=Depends(_current_user), db: Session = Depends(get_db)):
    row, plaintext = create_token(db, user.id, data.name)
    return ApiTokenCreated(
        id=row.id,
        name=row.name,
        prefix=row.prefix,
        revoked=row.revoked,
        last_used_at=row.last_used_at,
        created_at=row.created_at,
        token=plaintext,
    )


@router.delete("/{token_id}", status_code=204)
def remove_token(token_id: UUID, user=Depends(_current_user), db: Session = Depends(get_db)):
    try:
        revoke_token(db, user.id, token_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
