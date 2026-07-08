"""
AES-256-GCM encryption for secrets at rest (provider API keys).

Ciphertext format: ``v1:<base64url(nonce(12) | ciphertext | tag(16))>``.
The ``v1:`` prefix lets us detect already-encrypted values (so we never
double-encrypt) and leaves room for future key rotation / algorithm changes.

The key comes from ``settings.ENCRYPTION_KEY`` (32 raw bytes, base64-encoded).
When unset, it is derived deterministically from ``SECRET_KEY`` via HKDF-SHA256
so existing single-secret deployments keep working without extra config — while
still giving a distinct key from the JWT signer.
"""
from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.core.config import settings

_PREFIX = "v1:"
_NONCE_LEN = 12


def _load_key() -> bytes:
    """Return the 32-byte AES key."""
    if settings.ENCRYPTION_KEY:
        raw = base64.b64decode(settings.ENCRYPTION_KEY)
        if len(raw) != 32:
            raise ValueError("ENCRYPTION_KEY must decode to exactly 32 bytes.")
        return raw
    # Derive from SECRET_KEY so deploys without an explicit key still encrypt.
    return HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"openagent-hub:provider-key-encryption:v1",
        info=b"aesgcm",
    ).derive(settings.SECRET_KEY.encode("utf-8"))


_KEY = _load_key()
_AESGCM = AESGCM(_KEY)


def is_encrypted(value: str | None) -> bool:
    return bool(value) and value.startswith(_PREFIX)


def encrypt(plaintext: str | None) -> str:
    """Encrypt a string. Empty/None → "" (keyless providers stay keyless).

    Idempotent: an already-encrypted value is returned unchanged."""
    if not plaintext:
        return ""
    if is_encrypted(plaintext):
        return plaintext
    nonce = os.urandom(_NONCE_LEN)
    ct = _AESGCM.encrypt(nonce, plaintext.encode("utf-8"), None)
    blob = base64.urlsafe_b64encode(nonce + ct).decode("ascii")
    return f"{_PREFIX}{blob}"


def decrypt(token: str | None) -> str:
    """Decrypt a value produced by :func:`encrypt`.

    A plaintext (non-prefixed) value is returned as-is, so reads keep working
    during/after the backfill migration and for any legacy rows."""
    if not token:
        return ""
    if not is_encrypted(token):
        return token  # legacy plaintext or empty
    blob = base64.urlsafe_b64decode(token[len(_PREFIX):].encode("ascii"))
    nonce, ct = blob[:_NONCE_LEN], blob[_NONCE_LEN:]
    return _AESGCM.decrypt(nonce, ct, None).decode("utf-8")


def mask(secret: str | None) -> str:
    """Human-safe masked form for API responses, e.g. 'sk-or…e480'."""
    if not secret:
        return ""
    plain = decrypt(secret) if is_encrypted(secret) else secret
    if len(plain) <= 8:
        return "••••"
    return f"{plain[:4]}…{plain[-4:]}"
