/**
 * Python Fernet-compatible token encryption.
 *
 * Fernet spec v0x80:
 *   token = base64url( version(1) | timestamp(8 BE) | IV(16) | ciphertext(AES-128-CBC, PKCS7) | HMAC-SHA256(32) )
 *
 * Key: 32 bytes derived via PBKDF2-HMAC-SHA256(password=JWT_SECRET_KEY, salt, 100000, 32).
 * First 16 bytes = HMAC signing key, last 16 bytes = AES encryption key.
 *
 * Salt and iterations are hardcoded to match the Python RedStat implementation
 * (`app/services/kaspi_crypto_service.py`).
 */
import { createCipheriv, createDecipheriv, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const VERSION = 0x80;
const SALT = Buffer.from("kaspi-token-encryption-salt-v1", "utf-8");
const ITERATIONS = 100_000;
const KEY_LENGTH = 32;

let cachedKey: Buffer | null = null;

function getFernetKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.JWT_SECRET_KEY;
  if (!secret) throw new Error("JWT_SECRET_KEY env var is required for Fernet encryption");
  cachedKey = pbkdf2Sync(secret, SALT, ITERATIONS, KEY_LENGTH, "sha256");
  return cachedKey;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

export function encryptToken(plainToken: string): string {
  const key = getFernetKey();
  const signingKey = key.subarray(0, 16);
  const encryptionKey = key.subarray(16, 32);

  const iv = randomBytes(16);
  const timestamp = Math.floor(Date.now() / 1000);
  const timestampBuf = Buffer.alloc(8);
  timestampBuf.writeBigInt64BE(BigInt(timestamp), 0);

  const cipher = createCipheriv("aes-128-cbc", encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plainToken, "utf-8")), cipher.final()]);

  const versionBuf = Buffer.from([VERSION]);
  const payload = Buffer.concat([versionBuf, timestampBuf, iv, ciphertext]);
  const hmac = createHmac("sha256", signingKey).update(payload).digest();

  return b64urlEncode(Buffer.concat([payload, hmac]));
}

export function decryptToken(encryptedToken: string): string {
  const key = getFernetKey();
  const signingKey = key.subarray(0, 16);
  const encryptionKey = key.subarray(16, 32);

  const data = b64urlDecode(encryptedToken);
  if (data.length < 1 + 8 + 16 + 32) throw new Error("Fernet token too short");
  if (data[0] !== VERSION) throw new Error(`Fernet: unsupported version 0x${data[0].toString(16)}`);

  const payload = data.subarray(0, data.length - 32);
  const mac = data.subarray(data.length - 32);
  const expectedMac = createHmac("sha256", signingKey).update(payload).digest();
  if (!timingSafeEqual(mac, expectedMac)) throw new Error("Fernet: HMAC verification failed");

  const iv = payload.subarray(9, 25);
  const ciphertext = payload.subarray(25);

  const decipher = createDecipheriv("aes-128-cbc", encryptionKey, iv);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf-8");
}

/**
 * Self-check: round-trip encrypt/decrypt a sample string.
 * Used at startup to fail fast if JWT_SECRET_KEY is broken.
 */
export function fernetSelfTest(): boolean {
  try {
    const sample = "kaspi-token-roundtrip-check";
    const encrypted = encryptToken(sample);
    const decrypted = decryptToken(encrypted);
    return decrypted === sample;
  } catch {
    return false;
  }
}
