"""Tests TDD para funciones críticas de seguridad."""
import pytest

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    needs_rehash,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_is_not_plain(self):
        hashed = hash_password("secret123")
        assert hashed != "secret123"

    def test_verify_correct_password(self):
        hashed = hash_password("correct_password")
        assert verify_password("correct_password", hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("correct_password")
        assert verify_password("wrong_password", hashed) is False

    def test_needs_rehash_returns_bool(self):
        hashed = hash_password("test")
        assert isinstance(needs_rehash(hashed), bool)


class TestJWT:
    def test_create_and_decode_token(self):
        token = create_access_token(subject="user-123", role="admin")
        payload = decode_access_token(token)
        assert payload["sub"] == "user-123"
        assert payload["role"] == "admin"
        assert payload["type"] == "access"

    def test_invalid_token_raises(self):
        with pytest.raises(ValueError, match="Invalid or expired token"):
            decode_access_token("not.a.valid.token")

    def test_tampered_token_raises(self):
        token = create_access_token(subject="user-123", role="diner")
        tampered = token[:-5] + "XXXXX"
        with pytest.raises(ValueError):
            decode_access_token(tampered)
