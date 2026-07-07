import 'server-only'

import crypto from 'node:crypto'

// API key material. The full key is returned exactly once at creation;
// only the sha256 hash and a display prefix are persisted.

export const API_KEY_PREFIX = 'cg_live_'

export function generateApiKey(): { key: string; prefix: string; keyHash: string } {
  const key = `${API_KEY_PREFIX}${crypto.randomBytes(24).toString('hex')}`
  return { key, prefix: `${key.slice(0, 15)}…`, keyHash: hashApiKey(key) }
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}
