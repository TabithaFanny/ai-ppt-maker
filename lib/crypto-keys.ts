/**
 * API Key 加密存储（Web Crypto AES-256-GCM）
 *
 * 防止 localStorage 中 API Key 的明文泄露。
 * 防君子不防小人：同源 XSS 仍可通过调用解密函数获取密钥，
 * 但普通的 localStorage 检查/导出不再泄露明文。
 *
 * 密钥派生：PBKDF2(app-seed + static-salt) → AES-256-GCM key
 * 存储格式：{ v:1, d:"<base64url-ciphertext>", iv:"<base64url-iv>" }
 */

const STORAGE_KEY = 'ai-ppt-keys';
const SEED = 'ai-ppt-generator-key-vault-2026';
const SALT = new Uint8Array([
  0x7f, 0x9c, 0x3a, 0x2e, 0x11, 0x5b, 0x8d, 0x4f,
  0x6e, 0x1a, 0x33, 0x9e, 0x2c, 0x7b, 0x5d, 0x8a,
]);

interface EncryptedPayload {
  v: number; // version
  d: string; // base64url-encoded ciphertext
  iv: string; // base64url-encoded IV
}

interface ApiKeys {
  minimax: string;
  deepseek: string;
  openai: string;
}

async function deriveKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(SEED),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptApiKeys(keys: ApiKeys): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(keys))
  );
  const payload: EncryptedPayload = {
    v: 1,
    d: btoaUrl(Array.from(new Uint8Array(ciphertext))),
    iv: btoaUrl(Array.from(iv)),
  };
  return JSON.stringify(payload);
}

export async function decryptApiKeys(encrypted: string): Promise<ApiKeys | null> {
  try {
    const payload: EncryptedPayload = JSON.parse(encrypted);
    if (payload.v !== 1) return null;

    const key = await deriveKey();
    const ciphertext = new Uint8Array(atobUrl(payload.d));
    const iv = new Uint8Array(atobUrl(payload.iv));

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    return null;
  }
}

/**
 * 检测 localStorage 中的 keys 是否已加密
 */
export function isEncrypted(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.v === 'number';
  } catch {
    return false;
  }
}

/**
 * 迁移明文 keys → 加密 keys（仅在客户端调用）
 */
export async function migratePlaintextKeys(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || isEncrypted(raw)) return;

    // 明文格式：{"minimax":"...","deepseek":"...","openai":"..."}
    const plainKeys: ApiKeys = JSON.parse(raw);
    const encrypted = await encryptApiKeys(plainKeys);
    localStorage.setItem(STORAGE_KEY, encrypted);
  } catch {
    // 迁移失败不影响功能，下次保存时自然加密
  }
}

/**
 * 从 localStorage 获取解密后的 API Keys
 */
export async function getEncryptedApiKeys(): Promise<ApiKeys> {
  if (typeof window === 'undefined') return { minimax: '', deepseek: '', openai: '' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { minimax: '', deepseek: '', openai: '' };

    if (isEncrypted(raw)) {
      const decrypted = await decryptApiKeys(raw);
      if (decrypted) return decrypted;
    }

    // 明文回退（兼容旧数据，或解密失败时）
    return JSON.parse(raw);
  } catch {
    return { minimax: '', deepseek: '', openai: '' };
  }
}

/**
 * 加密并保存 API Keys 到 localStorage
 */
export async function setEncryptedApiKeys(
  keys: { minimax?: string; deepseek?: string; openai?: string }
): Promise<void> {
  if (typeof window === 'undefined') return;
  const current = await getEncryptedApiKeys();
  const merged = { ...current, ...keys };
  const encrypted = await encryptApiKeys(merged);
  localStorage.setItem(STORAGE_KEY, encrypted);
}

// ====== base64url helpers ======

function btoaUrl(bytes: number[]): string {
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function atobUrl(base64url: string): number[] {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(base64);
  return Array.from(bin, (c) => c.charCodeAt(0));
}
