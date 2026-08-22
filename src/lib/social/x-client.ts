import 'server-only'

import crypto from 'node:crypto'

// ---------------------------------------------------------------------------
// Minimal X (Twitter) API v2 client for posting from the site's own account.
//
// Auth: OAuth 1.0a user context — the four keys X shows under
// "Keys & Tokens" for the app (consumer key/secret + the account's access
// token/secret). The app must have READ AND WRITE permission and the access
// token must have been (re)generated AFTER that permission was set;
// read-only tokens get 403 from POST /2/tweets.
//
// No dependency: the signature is ~30 lines of RFC 5849 (HMAC-SHA1). The JSON
// request body is NOT part of the signature base string — only the oauth_*
// parameters are (there are no query/form params on this endpoint).
// ---------------------------------------------------------------------------

export const X_TWEETS_URL = 'https://api.x.com/2/tweets'

export type XCredentials = {
  apiKey: string
  apiSecret: string
  accessToken: string
  accessTokenSecret: string
}

export function xCredentialsFromEnv(): XCredentials | null {
  const apiKey = process.env.X_API_KEY
  const apiSecret = process.env.X_API_SECRET
  const accessToken = process.env.X_ACCESS_TOKEN
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) return null
  return { apiKey, apiSecret, accessToken, accessTokenSecret }
}

/** RFC 3986 percent-encoding (stricter than encodeURIComponent). */
export function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

/**
 * Build the OAuth 1.0a Authorization header for a request. Exported so the
 * signature can be checked against known vectors; `nonce`/`timestamp` are
 * injectable for that reason only — callers normally omit them.
 */
export function oauth1Header(
  creds: XCredentials,
  method: string,
  url: string,
  opts: { nonce?: string; timestamp?: string; extraParams?: Record<string, string> } = {},
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: opts.nonce ?? crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: opts.timestamp ?? Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  }

  // Parameter string: all oauth_* + any query/form params, key-sorted, encoded.
  const all = { ...oauthParams, ...(opts.extraParams ?? {}) }
  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(all[k])}`)
    .join('&')

  const baseString = [method.toUpperCase(), rfc3986(url), rfc3986(paramString)].join('&')
  const signingKey = `${rfc3986(creds.apiSecret)}&${rfc3986(creds.accessTokenSecret)}`
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64')

  const header: Record<string, string> = { ...oauthParams, oauth_signature: signature }
  return (
    'OAuth ' +
    Object.keys(header)
      .sort()
      .map((k) => `${rfc3986(k)}="${rfc3986(header[k])}"`)
      .join(', ')
  )
}

export type XPostResult =
  | { ok: true; id: string }
  | { ok: false; status: number | null; error: string }

/** POST /2/tweets with the given text. Never throws. */
export async function postTweet(creds: XCredentials, text: string): Promise<XPostResult> {
  try {
    const res = await fetch(X_TWEETS_URL, {
      method: 'POST',
      headers: {
        authorization: oauth1Header(creds, 'POST', X_TWEETS_URL),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(10_000),
    })
    const body = (await res.json().catch(() => ({}))) as {
      data?: { id?: string }
      detail?: string
      title?: string
      errors?: { message?: string }[]
    }
    if (!res.ok || !body.data?.id) {
      const error =
        body.detail ?? body.title ?? body.errors?.[0]?.message ?? `x responded ${res.status}`
      return { ok: false, status: res.status, error: String(error).slice(0, 200) }
    }
    return { ok: true, id: body.data.id }
  } catch (err) {
    return { ok: false, status: null, error: String((err as Error).message ?? err).slice(0, 200) }
  }
}
