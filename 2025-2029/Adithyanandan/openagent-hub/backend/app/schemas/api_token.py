from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ApiTokenCreate(BaseModel):
    name: str = "token"


class ApiTokenResponse(BaseModel):
    """Metadata about a token. Never contains the secret."""

    id: UUID
    name: str
    prefix: str
    revoked: bool
    last_used_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ApiTokenCreated(ApiTokenResponse):
    """Returned exactly once on creation — includes the plaintext token."""

    token: str
