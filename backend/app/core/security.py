"""Security utilities: password hashing, AES-256-GCM encryption, GSTIN validation."""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
from base64 import b64decode, b64encode

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from passlib.context import CryptContext

from app.config import get_settings

# ── Password hashing ─────────────────────────────────────────────────────────
# bcrypt cost=12 as per spec
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


# ── Invite token generation / verification ───────────────────────────────────
# 32-byte random hex, stored as SHA-256 hash; 48-hour TTL enforced at DB level

def generate_invite_token() -> tuple[str, str]:
    """Returns (raw_token, sha256_hash). Store only the hash in DB."""
    raw = secrets.token_hex(32)
    h = hashlib.sha256(raw.encode()).hexdigest()
    return raw, h


def hash_invite_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def compare_invite_tokens(raw: str, stored_hash: str) -> bool:
    """Constant-time comparison to prevent timing attacks."""
    expected = hashlib.sha256(raw.encode()).hexdigest()
    return hmac.compare_digest(expected, stored_hash)


# ── AES-256-GCM encryption ───────────────────────────────────────────────────
# Used for SMTP passwords and OAuth tokens.
# Ciphertext format (base64): <12-byte nonce> + <ciphertext+tag>

def _get_encryption_key() -> bytes:
    hex_key = get_settings().ENCRYPTION_KEY
    if not hex_key or len(hex_key) < 64:
        raise ValueError(
            "ENCRYPTION_KEY must be a 32-byte (64 hex-char) string. "
            "Generate with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )
    return bytes.fromhex(hex_key[:64])


def encrypt_secret(plaintext: str) -> str:
    """Encrypt a secret string. Returns base64-encoded ciphertext."""
    key = _get_encryption_key()
    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    ct = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return b64encode(nonce + ct).decode()


def decrypt_secret(ciphertext_b64: str) -> str:
    """Decrypt a base64-encoded AES-256-GCM ciphertext."""
    key = _get_encryption_key()
    raw = b64decode(ciphertext_b64)
    nonce, ct = raw[:12], raw[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ct, None).decode()


# ── GSTIN validation ─────────────────────────────────────────────────────────
# Indian GSTIN: 15-character alphanumeric
# Format: 2 digits + 10-char PAN + 1 entity code + 1 'Z' + 1 checksum
_GSTIN_RE = re.compile(
    r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
)
_GSTIN_CHECKSUM_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def validate_gstin(gstin: str) -> bool:
    """Validate GSTIN format and checksum as per Indian GST rules."""
    if not gstin or len(gstin) != 15:
        return False
    g = gstin.upper()
    if not _GSTIN_RE.match(g):
        return False

    # Checksum: Luhn-style mod-36 algorithm
    factor = 2
    total = 0
    for i in range(14):
        code_point = _GSTIN_CHECKSUM_CHARS.index(g[i])
        addend = factor * code_point
        factor = 1 if factor == 2 else 2
        addend = (addend // 36) + (addend % 36)
        total += addend

    remainder = total % 36
    check_digit = (36 - remainder) % 36
    expected = _GSTIN_CHECKSUM_CHARS[check_digit]
    return g[14] == expected
