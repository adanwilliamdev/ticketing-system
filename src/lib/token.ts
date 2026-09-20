import { randomBytes } from 'node:crypto';

/**
 * Equivalente a ReservationTokenGenerator: 32 bytes aleatórios criptograficamente seguros em
 * Base64 URL-safe sem padding → 43 caracteres [A-Za-z0-9_-].
 */
export function generateReservationToken(): string {
  return randomBytes(32).toString('base64url');
}
