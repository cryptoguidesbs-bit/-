// Shared helpers for scripts/test-*.mjs. New scripts import from here;
// older ones keep their local copies until they are next touched.
export const APP = process.env.TEST_APP_URL ?? 'http://localhost:3000'

let passCount = 0
let failCount = 0

export function ok(name, pass, detail = '') {
  if (pass) passCount++
  else failCount++
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
}

/** Print the summary line and exit non-zero on any failure. */
export function summary() {
  console.log(
    `\nSUMMARY: ${passCount} passed, ${failCount} failed — ${failCount === 0 ? 'ALL PASS' : 'FAILURES'}`
  )
  process.exit(failCount === 0 ? 0 : 1)
}

export async function get(path, headers = {}) {
  const res = await fetch(`${APP}${path}`, { headers })
  return { status: res.status, json: await res.json().catch(() => null) }
}

export async function getText(path, headers = {}) {
  const res = await fetch(`${APP}${path}`, { headers })
  return { status: res.status, text: await res.text() }
}

export async function post(path, body, headers = {}) {
  const res = await fetch(`${APP}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body ?? {}),
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}
