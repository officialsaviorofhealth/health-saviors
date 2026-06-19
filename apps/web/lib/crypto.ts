// AES-256-GCM symmetric encryption for sensitive secrets (per-user bot tokens, etc).
// Uses ENCRYPTION_SECRET env var; the secret is hashed to a 32-byte key so any length works.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error('ENCRYPTION_SECRET is not set');
  // Hash to 32 bytes — accepts any input length
  return createHash('sha256').update(secret).digest();
}

// Encrypts plaintext → "v1:<iv>:<authTag>:<ciphertext>" all base64.
// The "v1:" prefix lets us rotate algorithms later without losing old data.
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decrypt(blob: string): string {
  if (!blob) return '';
  const parts = blob.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid encrypted blob format');
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

// Generate a URL-safe random ID for webhook paths
export function randomWebhookId(): string {
  return randomBytes(24).toString('base64url');
}
