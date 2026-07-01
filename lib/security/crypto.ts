/**
 * Application-Layer Encryption Module
 * Extended to support E2EE, Digital Signatures, and Integrity Hashes.
 */

// Legacy Global Secret for fallback/compatibility
const SECRET = process.env.NEXT_PUBLIC_APP_SECRET || 'fallback_default_secret_do_not_use_in_prod';

// --- UTILS ---
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  return typeof window !== 'undefined' ? window.btoa(binary) : Buffer.from(bytes).toString('base64');
}

export function base64ToBuffer(base64: string): Uint8Array {
  if (typeof window !== 'undefined') {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } else {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
}

// --- LEGACY SYMMETRIC CRYPTO ---
async function getLegacyCryptoKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('chitra_salt_123'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(payload: any, specificKey?: CryptoKey): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return JSON.stringify(payload);
  }
  try {
    const key = specificKey || await getLegacyCryptoKey();
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

export async function decryptData(encryptedText: string, specificKey?: CryptoKey): Promise<any> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    try { return JSON.parse(encryptedText); } catch { return null; }
  }
  if (!encryptedText.includes(':')) {
    try { return JSON.parse(encryptedText); } catch { return encryptedText; }
  }
  try {
    const [ivHex, cipherHex] = encryptedText.split(':');
    const key = specificKey || await getLegacyCryptoKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: hexToBuffer(ivHex) as any },
      key,
      hexToBuffer(cipherHex) as any
    );
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (err) {
    console.error('Decryption failed:', err);
    return null;
  }
}

// --- E2EE: ROOM KEYS (AES-GCM) ---
export async function generateRoomKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable so we can wrap it
    ['encrypt', 'decrypt']
  );
}

// --- E2EE: USER KEYS (RSA-OAEP for Key Wrapping) ---
export async function generateUserExchangeKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, // extractable so we can save to indexedDB
    ['wrapKey', 'unwrapKey']
  );
}

export async function wrapRoomKey(roomKey: CryptoKey, userPublicKey: CryptoKey): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey(
    'raw',
    roomKey,
    userPublicKey,
    { name: 'RSA-OAEP' }
  );
  return bufferToBase64(wrapped);
}

export async function unwrapRoomKey(wrappedKeyBase64: string, userPrivateKey: CryptoKey): Promise<CryptoKey> {
  const wrappedBuffer = base64ToBuffer(wrappedKeyBase64);
  return crypto.subtle.unwrapKey(
    'raw',
    wrappedBuffer as any,
    userPrivateKey,
    { name: 'RSA-OAEP' },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// --- DIGITAL SIGNATURES (ECDSA) ---
export async function generateSigningKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
}

export async function signData(data: string, privateKey: CryptoKey): Promise<string> {
  const enc = new TextEncoder();
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    enc.encode(data)
  );
  return bufferToBase64(signature);
}

export async function verifySignature(data: string, signatureBase64: string, publicKey: CryptoKey): Promise<boolean> {
  const enc = new TextEncoder();
  const signatureBuffer = base64ToBuffer(signatureBase64);
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    publicKey,
    signatureBuffer as any,
    enc.encode(data)
  );
}

// --- EXPORT & STORAGE ---
export async function exportKeyAsJWK(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key);
}

export async function importJWK(jwk: JsonWebKey, algorithm: RsaHashedImportParams | EcKeyImportParams | AesKeyAlgorithm | AlgorithmIdentifier, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, algorithm, true, usages);
}

// --- INTEGRITY HASHING ---
export async function computeSHA256Hash(data: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return 'unsupported_environment';
  }
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(data));
  return bufferToHex(hashBuffer);
}
