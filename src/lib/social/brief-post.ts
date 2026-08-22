import 'server-only'

import type { Prisma } from '@prisma/client'

import type { BriefSections } from '@/lib/brief/guidelines'
import { prisma } from '@/lib/prisma'
import { siteUrl } from '@/lib/site'

import { postTweet, xCredentialsFromEnv } from './x-client'

// ---------------------------------------------------------------------------
// Daily-brief social announcements (distribution loop).
//
// After the STANDARD brief publishes, post a short teaser to the site's X
// account and/or a Telegram channel with a link back to /brief. Everything
// here is best-effort: missing credentials → channel skipped, failures are
// recorded as an open OpsEvent (shows in the admin console) and never
// propagate to the cron response.
//
// Env:
//   X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET
//   TELEGRAM_BOT_TOKEN + TELEGRAM_BRIEF_CHAT_ID  (channel @name or -100… id)
//   SOCIAL_BRIEF_LOCALES   comma list, default "ko" (e.g. "ko,en")
//   SOCIAL_DRY_RUN         "1" → compose + log only, no network calls
// ---------------------------------------------------------------------------

export type BriefLang = 'ko' | 'en'

// X counts most CJK / Hangul / emoji code points as 2 "weighted" characters
// and any URL as 23, with a 280 budget. We stay a little under.
const X_BUDGET = 275
const URL_WEIGHT = 23

export function weightedLength(text: string): number {
  let total = 0
  // URLs are t.co-wrapped → fixed 23 regardless of length.
  const withoutUrls = text.replace(/https?:\/\/\S+/g, () => {
    total += URL_WEIGHT
    return ''
  })
  for (const ch of withoutUrls) {
    const cp = ch.codePointAt(0) ?? 0
    const wide =
      (cp >= 0x1100 && cp <= 0x11ff) || // Hangul Jamo
      (cp >= 0x2e80 && cp <= 0x9fff) || // CJK radicals … unified ideographs
      (cp >= 0xac00 && cp <= 0xd7af) || // Hangul syllables
      (cp >= 0xf900 && cp <= 0xfaff) || // CJK compatibility
      (cp >= 0xfe30 && cp <= 0xfe4f) ||
      (cp >= 0xff00 && cp <= 0xffef) || // full-width forms
      (cp >= 0x1f000 && cp <= 0x1ffff) || // emoji & symbols
      (cp >= 0x2600 && cp <= 0x27bf) // misc symbols / dingbats
    total += wide ? 2 : 1
  }
  return total
}

/** First sentence of a paragraph — decimals ("77,307.5") are not boundaries. */
export function firstSentence(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  const m = trimmed.match(/^(.*?[.!?。])(?=\s|$)/)
  return (m ? m[1] : trimmed).trim()
}

/** Trim to a weighted budget, ending with an ellipsis when cut. */
export function truncateWeighted(text: string, budget: number): string {
  if (weightedLength(text) <= budget) return text
  let out = ''
  for (const ch of text) {
    if (weightedLength(out + ch) > budget - 1) break
    out += ch
  }
  return out.replace(/[\s,;:·]+$/, '') + '…'
}

function dateLabel(lang: BriefLang, now: Date): string {
  return lang === 'ko'
    ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(now)
    : new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' }).format(now)
}

export function briefUrl(lang: BriefLang): string {
  return `${siteUrl}/${lang}/brief`
}

/**
 * X post: header + two one-line takeaways (BTC, today's watch point) + link,
 * always inside the weighted 280 budget. Sentences share whatever budget is
 * left after the fixed parts, so nothing is ever cut mid-URL.
 */
export function composeXPost(sections: BriefSections, lang: BriefLang, now = new Date()): string {
  const header =
    lang === 'ko'
      ? `📊 ${dateLabel(lang, now)} 크립토 데일리 브리핑`
      : `📊 Crypto Daily Brief · ${dateLabel(lang, now)}`
  const footer = lang === 'ko' ? `👉 ${briefUrl(lang)}\n※ 정보 제공 목적 · 투자 조언 아님` : `👉 ${briefUrl(lang)}\nNot financial advice.`

  const lines = [
    { icon: '₿', text: firstSentence(sections.btc[lang]) },
    { icon: '🔭', text: firstSentence(sections.today[lang]) },
  ]

  const fixed = weightedLength(`${header}\n\n${lines.map((l) => `${l.icon} `).join('\n')}\n\n${footer}`)
  const perLine = Math.max(24, Math.floor((X_BUDGET - fixed) / lines.length))

  const body = lines.map((l) => `${l.icon} ${truncateWeighted(l.text, perLine)}`).join('\n')
  let post = `${header}\n\n${body}\n\n${footer}`
  // Safety: if rounding still overshoots, shave the last body line further.
  let guard = 0
  while (weightedLength(post) > 280 && guard++ < 10) {
    const shorter = lines.map((l, i) =>
      i === lines.length - 1
        ? `${l.icon} ${truncateWeighted(l.text, perLine - 8 * guard)}`
        : `${l.icon} ${truncateWeighted(l.text, perLine)}`,
    )
    post = `${header}\n\n${shorter.join('\n')}\n\n${footer}`
  }
  return post
}

/** Telegram post: longer (4096 limit) — every section, first ~2 sentences. */
export function composeTelegramPost(sections: BriefSections, lang: BriefLang, now = new Date()): string {
  const labels: Record<keyof BriefSections, Record<BriefLang, string>> = {
    btc: { ko: '비트코인', en: 'Bitcoin' },
    eth: { ko: '이더리움', en: 'Ethereum' },
    altcoin: { ko: '알트코인', en: 'Altcoins' },
    macro: { ko: '매크로', en: 'Macro' },
    today: { ko: '오늘의 포인트', en: "Today's watch" },
  }
  const title =
    lang === 'ko'
      ? `📊 <b>${dateLabel(lang, now)} 크립토 데일리 브리핑</b>`
      : `📊 <b>Crypto Daily Brief · ${dateLabel(lang, now)}</b>`
  const parts = (Object.keys(labels) as (keyof BriefSections)[]).map((key) => {
    const text = (sections[key]?.[lang] ?? '').replace(/\s+/g, ' ').trim()
    // Sentence = up to a terminator that is followed by whitespace/end, so
    // decimals ("6.3%", "77,307.5") never split. Fallback: whole paragraph.
    const sentences = (text.match(/.*?[.!?。](?=\s|$)/g) ?? [text]).map((s) => s.trim())
    const excerpt = sentences.slice(0, 2).join(' ').trim()
    return `<b>${labels[key][lang]}</b>\n${escapeHtml(excerpt)}`
  })
  const footer =
    lang === 'ko'
      ? `전체 브리핑 👉 ${briefUrl(lang)}\n※ 정보 제공 목적이며 투자 조언이 아닙니다.`
      : `Full brief 👉 ${briefUrl(lang)}\nInformational only — not financial advice.`
  return [title, ...parts, footer].join('\n\n').slice(0, 4000)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

export type ChannelOutcome = {
  channel: 'x' | 'telegram'
  lang: BriefLang
  status: 'sent' | 'skipped' | 'failed' | 'dry-run'
  detail?: string
}

export type AnnounceReport = {
  briefDate: string
  locales: BriefLang[]
  outcomes: ChannelOutcome[]
}

function configuredLocales(): BriefLang[] {
  const raw = (process.env.SOCIAL_BRIEF_LOCALES ?? 'ko').split(',').map((s) => s.trim().toLowerCase())
  const langs = raw.filter((l): l is BriefLang => l === 'ko' || l === 'en')
  return langs.length ? Array.from(new Set(langs)) : ['ko']
}

async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_BRIEF_CHAT_ID
  if (!token || !chatId) return { ok: false, error: 'not configured' }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { description?: string }
      return { ok: false, error: body.description ?? `telegram ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String((err as Error).message ?? err) }
  }
}

/**
 * Post the brief to every configured channel/locale. Never throws. Records
 * one OpsEvent: closed "social.brief_posted" on full success, open
 * "social.brief_post_failed" (warning) when any channel failed, nothing
 * when no channel is configured at all.
 */
export async function announceBrief(input: {
  briefDate: string
  sections: BriefSections
  dryRun?: boolean
}): Promise<AnnounceReport> {
  const dryRun = input.dryRun ?? process.env.SOCIAL_DRY_RUN === '1'
  const locales = configuredLocales()
  const xCreds = xCredentialsFromEnv()
  const telegramOn = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BRIEF_CHAT_ID)
  const outcomes: ChannelOutcome[] = []
  const now = new Date()

  for (const lang of locales) {
    // Dry run always shows the composed text — even before credentials exist —
    // so the post can be previewed while wiring things up.
    const xText = composeXPost(input.sections, lang, now)
    if (dryRun) outcomes.push({ channel: 'x', lang, status: 'dry-run', detail: xText })
    else if (!xCreds) outcomes.push({ channel: 'x', lang, status: 'skipped', detail: 'no credentials' })
    else {
      const r = await postTweet(xCreds, xText)
      outcomes.push(
        r.ok
          ? { channel: 'x', lang, status: 'sent', detail: r.id }
          : { channel: 'x', lang, status: 'failed', detail: `${r.status ?? 'net'}: ${r.error}` },
      )
    }

    const tgText = composeTelegramPost(input.sections, lang, now)
    if (dryRun) outcomes.push({ channel: 'telegram', lang, status: 'dry-run', detail: tgText })
    else if (!telegramOn) outcomes.push({ channel: 'telegram', lang, status: 'skipped', detail: 'not configured' })
    else {
      const r = await sendTelegram(tgText)
      outcomes.push(
        r.ok
          ? { channel: 'telegram', lang, status: 'sent' }
          : { channel: 'telegram', lang, status: 'failed', detail: r.error },
      )
    }
  }

  const report: AnnounceReport = { briefDate: input.briefDate, locales, outcomes }
  // Previews and "nothing configured" leave no trace; only real sends log.
  const attempted = outcomes.filter((o) => o.status === 'sent' || o.status === 'failed')
  if (attempted.length === 0) return report

  const failed = outcomes.filter((o) => o.status === 'failed')
  await prisma.opsEvent
    .create({
      data: failed.length
        ? {
            kind: 'social.brief_post_failed',
            severity: 'warning',
            message: `브리핑 소셜 포스팅 실패 ${failed.length}건 (${failed.map((f) => `${f.channel}/${f.lang}`).join(', ')})`,
            data: report as unknown as Prisma.InputJsonValue,
          }
        : {
            kind: 'social.brief_posted',
            severity: 'info',
            message: `브리핑 소셜 포스팅 완료 (${attempted.map((o) => `${o.channel}/${o.lang}`).join(', ')})`,
            data: report as unknown as Prisma.InputJsonValue,
            resolvedAt: now,
          },
    })
    .catch(() => {})

  return report
}
