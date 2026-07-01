/**
 * Application-Layer Encryption Module
 * 
 * DESIGN DECISION: Encrypts data at the application layer before sending
 * to PocketBase to ensure sensitive data (strokes, messages) is encrypted
 * at rest, even if the database file is compromised.
 * 
 * Uses standard Web Crypto API (AES-GCM).
 */

const SECRET = process.env.NEXT_PUBLIC_APP_SECRET || 'fallback_default_secret_do_not_use_in_prod';

// Derives a cryptographic key from the secret string
async function getCryptoKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('chitra_salt_123'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Convert ArrayBuffer to Hex String
function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert Hex String to ArrayBuffer
function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Encrypts a JSON-serializable payload.
 * Returns a hex string in the format: iv:ciphertext
 */
export async function encryptData(payload: any): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    console.warn('Web Crypto API not available. Returning unencrypted data.');
    return JSON.stringify(payload);
  }

  try {
    const key = await getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(JSON.stringify(payload))
    );

    return `${bufferToHex(iv)}:${bufferToHex(ciphertext)}`;
  } catch (err) {
    console.error('Encryption failed:', err);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts a payload that was encrypted by encryptData.
 */
export async function decryptData(encryptedText: string): Promise<any> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    try {
      return JSON.parse(encryptedText); // Fallback if it wasn't actually encrypted
    } catch {
      return null;
    }
  }

  // If it's not encrypted (e.g. old data or fallback), just parse it
  if (!encryptedText.includes(':')) {
    try {
      return JSON.parse(encryptedText);
    } catch {
      return encryptedText;
    }
  }

  try {
    const [ivHex, cipherHex] = encryptedText.split(':');
    const key = await getCryptoKey();
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: hexToBuffer(ivHex) as any },
      key,
      hexToBuffer(cipherHex) as any
    );

    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (err) {
    console.error('Decryption failed:', err);
    // Return a fallback or null to prevent app crash on bad data
    return null;
  }
}
