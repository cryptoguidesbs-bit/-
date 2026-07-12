// Language auto-detection test: browser-language (Accept-Language) first-visit
// detection (ko → /ko, EVERY other language → /en), geo fallback only without
// Accept-Language, NEXT_LOCALE cookie priority over detection, deep-link path
// preservation, locale switcher present on all pages, and hreflang tags.
const APP = 'http://localhost:3000'

let pass = 0
let fail = 0
const ok = (name, cond, detail = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
}

// Bare request with manual redirects; returns status + Location pathname.
async function visit(path, headers = {}) {
  const res = await fetch(`${APP}${path}`, { headers, redirect: 'manual' })
  const loc = res.headers.get('location')
  let locPath = null
  if (loc) {
    try {
      locPath = new URL(loc, APP).pathname
    } catch {
      locPath = loc
    }
  }
  return { status: res.status, location: locPath }
}
const isRedirectTo = (r, path) => r.status >= 300 && r.status < 400 && r.location === path

// --- 1. first-visit detection (Accept-Language) --------------------------------
console.log('--- browser-language detection (first visit) ---')
let r = await visit('/', { 'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8' })
ok('Korean browser → /ko', isRedirectTo(r, '/ko'), `→ ${r.status} ${r.location}`)

r = await visit('/', { 'accept-language': 'en-US,en;q=0.9' })
ok('English browser → /en', isRedirectTo(r, '/en'), `→ ${r.status} ${r.location}`)

r = await visit('/', { 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.5' })
ok('French browser → /en (all non-Korean → en)', isRedirectTo(r, '/en'), `→ ${r.status} ${r.location}`)

r = await visit('/', { 'accept-language': 'ja' })
ok('Japanese browser → /en', isRedirectTo(r, '/en'), `→ ${r.status} ${r.location}`)

r = await visit('/', { 'accept-language': 'de-DE,de;q=0.9,ko;q=0.5' })
ok('German-primary (ko secondary) → /en (primary tag decides)',
  isRedirectTo(r, '/en'), `→ ${r.status} ${r.location}`)

r = await visit('/', { 'accept-language': 'en;q=0.5,ko;q=0.9' })
ok('quality ordering respected (ko q=0.9 wins) → /ko',
  isRedirectTo(r, '/ko'), `→ ${r.status} ${r.location}`)

// --- 2. geo fallback (only when no Accept-Language) ----------------------------
console.log('--- geo fallback (no Accept-Language) ---')
r = await visit('/', { 'x-vercel-ip-country': 'KR' })
ok('no AL + geo KR → /ko', isRedirectTo(r, '/ko'), `→ ${r.status} ${r.location}`)

r = await visit('/', { 'x-vercel-ip-country': 'US' })
ok('no AL + geo US → /en', isRedirectTo(r, '/en'), `→ ${r.status} ${r.location}`)

r = await visit('/', {})
ok('no signal at all → defaultLocale /ko', isRedirectTo(r, '/ko'), `→ ${r.status} ${r.location}`)

// Browser language must outrank geo when both are present.
r = await visit('/', { 'accept-language': 'en-US,en;q=0.9', 'x-vercel-ip-country': 'KR' })
ok('AL en + geo KR → /en (browser language wins)', isRedirectTo(r, '/en'), `→ ${r.status} ${r.location}`)

// --- 3. deep links keep their path ---------------------------------------------
console.log('--- deep links ---')
r = await visit('/news', { 'accept-language': 'fr-FR,fr;q=0.9' })
ok('/news + French browser → /en/news', isRedirectTo(r, '/en/news'), `→ ${r.status} ${r.location}`)

r = await visit('/education', { 'accept-language': 'ko' })
ok('/education + Korean browser → /ko/education',
  isRedirectTo(r, '/ko/education'), `→ ${r.status} ${r.location}`)

// --- 4. manual choice (cookie) outranks detection --------------------------------
console.log('--- cookie priority ---')
r = await visit('/', { 'accept-language': 'ko-KR,ko;q=0.9', cookie: 'NEXT_LOCALE=en' })
ok('cookie en + Korean browser → /en (choice wins)', isRedirectTo(r, '/en'), `→ ${r.status} ${r.location}`)

r = await visit('/', { 'accept-language': 'en-US,en;q=0.9', cookie: 'NEXT_LOCALE=ko' })
ok('cookie ko + English browser → /ko (choice wins)', isRedirectTo(r, '/ko'), `→ ${r.status} ${r.location}`)

r = await visit('/', { 'accept-language': 'ja', cookie: 'NEXT_LOCALE=fr' })
ok('garbage cookie ignored → detection still runs (/en)',
  isRedirectTo(r, '/en'), `→ ${r.status} ${r.location}`)

// Explicit locale in the URL is never overridden.
r = await visit('/ko', { 'accept-language': 'en-US,en;q=0.9' })
ok('/ko + English browser → stays /ko (no redirect)', r.status === 200, `status=${r.status}`)

// --- 5. locale switcher present on every page -------------------------------------
console.log('--- locale switcher UI ---')
for (const path of ['/ko', '/ko/news', '/en/legal/refund', '/en/education']) {
  const res = await fetch(`${APP}${path}`)
  const html = await res.text()
  ok(`switcher on ${path}`,
    res.status === 200 &&
      html.includes('data-testid="locale-switcher"') &&
      html.includes('data-testid="locale-switch-ko"') &&
      html.includes('data-testid="locale-switch-en"'))
}

// --- 6. hreflang (SEO ko/en linking) ------------------------------------------------
console.log('--- hreflang ---')
for (const path of ['/ko', '/en', '/ko/news', '/en/legal/refund']) {
  const res = await fetch(`${APP}${path}`)
  const html = await res.text()
  const hasKo = /hreflang="ko"/i.test(html)
  const hasEn = /hreflang="en"/i.test(html)
  const hasDefault = /hreflang="x-default"/i.test(html)
  const hasCanonical = /rel="canonical"/i.test(html)
  ok(`hreflang ko/en/x-default + canonical on ${path}`,
    res.status === 200 && hasKo && hasEn && hasDefault && hasCanonical,
    `ko=${hasKo} en=${hasEn} xd=${hasDefault} canon=${hasCanonical}`)
}

console.log(`\nSUMMARY: ${pass} passed, ${fail} failed — ${fail === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(fail === 0 ? 0 : 1)
