// Version of the "not investment advice / informational & educational
// purposes" consent text. Bump the date whenever the wording changes —
// users are asked to re-consent and a new ConsentLog row is recorded.
export const CONSENT_VERSION = '2026-07-04'

// Short-lived cookie set when the user ticks the consent box during
// sign-up, so the consent can be recorded right after the account exists.
export const CONSENT_COOKIE = 'cg_consent_ack'
