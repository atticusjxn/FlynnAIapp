/**
 * App-level encryption for integration credentials at rest.
 *
 * user_integrations.credentials_encrypted historically stored plaintext
 * { email, password } JSONB despite the column name. This wraps real
 * AES-256-GCM so a DB leak doesn't expose users' supplier / iCloud logins.
 *
 * Stored shape after encryption: { v: 1, enc: "<base64(iv|tag|ciphertext)>" }.
 * Reads are backward-compatible: a legacy plaintext { email, password } object
 * (no `enc` key) is returned as-is, so existing rows keep working and get
 * re-encrypted on their next write.
 *
 * Key: CREDENTIALS_ENCRYPTION_KEY — base64-encoded 32 bytes (openssl rand -base64 32).
 * If the key is absent/invalid we degrade to plaintext with a loud warning
 * rather than break the app, but production MUST set it.
 */

const crypto = require('crypto');

function getKey() {
  const b64 = (process.env.CREDENTIALS_ENCRYPTION_KEY || '').trim();
  if (!b64) return null;
  try {
    const key = Buffer.from(b64, 'base64');
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

function isEncrypted(stored) {
  return Boolean(stored && typeof stored === 'object' && typeof stored.enc === 'string');
}

/**
 * Encrypt a credentials object for storage. Returns { v, enc } when a key is
 * configured, otherwise the original object (with a warning).
 */
function encryptCredentials(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const key = getKey();
  if (!key) {
    console.warn('[credentialCrypto] CREDENTIALS_ENCRYPTION_KEY not set/invalid — storing credentials UNENCRYPTED');
    return obj;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const pt = Buffer.from(JSON.stringify(obj), 'utf8');
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { v: 1, enc: Buffer.concat([iv, tag, ct]).toString('base64') };
}

/**
 * Decrypt a stored credentials value back to its object. Legacy plaintext
 * objects (no `enc`) pass through unchanged. Returns {} on failure.
 */
function decryptCredentials(stored) {
  if (!stored || typeof stored !== 'object') return {};
  if (!isEncrypted(stored)) return stored; // legacy plaintext
  const key = getKey();
  if (!key) {
    console.warn('[credentialCrypto] encrypted credentials present but no key to decrypt');
    return {};
  }
  try {
    const raw = Buffer.from(stored.enc, 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(pt.toString('utf8'));
  } catch (err) {
    console.error('[credentialCrypto] decrypt failed:', err?.message);
    return {};
  }
}

module.exports = { encryptCredentials, decryptCredentials, isEncrypted };
