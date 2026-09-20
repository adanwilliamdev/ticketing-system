"""Equivalente a ReservationTokenGenerator: 32 bytes aleatórios criptograficamente seguros em
Base64 URL-safe sem padding -> 43 caracteres [A-Za-z0-9_-]."""
import secrets


def generate_reservation_token() -> str:
    return secrets.token_urlsafe(32)
