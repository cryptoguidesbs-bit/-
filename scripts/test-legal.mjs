// Stage 22 — legal documents test. Verifies all four documents render in
// ko/en, carry the required jurisdiction-specific clauses (US/EU/KR), the
// site-wide 5-line disclaimer, cross-references, and sitemap/footer wiring.
import fs from 'node:fs'

const APP = 'http://localhost:3000'
let pass = 0
let fail = 0
const ok = (name, cond, detail = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
}
const get = async (path) => {
  const res = await fetch(`${APP}${path}`)
  return { status: res.status, html: await res.text() }
}

// --- 1. all four documents render (ko + en) -----------------------------------
console.log('--- documents render ---')
for (const slug of ['terms', 'privacy', 'disclaimer', 'refund']) {
  for (const locale of ['ko', 'en']) {
    const p = await get(`/${locale}/legal/${slug}`)
    const sections = p.html.split('data-testid="legal-section"').length - 1
    ok(`${locale}/${slug} renders with sections`,
      p.status === 200 && p.html.includes(`data-testid="legal-${slug}"`) && sections >= 5,
      `sections=${sections}`)
  }
}

// --- 2. jurisdiction-specific clauses (US / EU / KR) ---------------------------
console.log('--- region clauses ---')
const discKo = (await get('/ko/legal/disclaimer')).html
ok('disclaimer has US/EU/KR region blocks',
  discKo.includes('data-testid="legal-region-us"') &&
    discKo.includes('data-testid="legal-region-eu"') &&
    discKo.includes('data-testid="legal-region-kr"'))
ok('US: not an investment adviser + SEC', discKo.includes('투자자문업자') && discKo.includes('SEC'))
ok('EU: MiCA', discKo.includes('MiCA'))
ok('KR: 자본시장법', discKo.includes('자본시장'))

const discEn = (await get('/en/legal/disclaimer')).html
ok('EN US: investment adviser + Advisers Act', discEn.includes('investment adviser') && discEn.includes('Advisers Act'))
ok('EN EU: MiCA + CASP', discEn.includes('MiCA') && discEn.includes('CASP'))
ok('EN KR: Capital Markets Act', discEn.includes('Capital Markets Act'))

const privKo = (await get('/ko/legal/privacy')).html
ok('privacy has GDPR (EU) clause', privKo.includes('GDPR'))
ok('privacy has PIPA/개인정보보호법 (KR) clause', privKo.includes('개인정보 보호법') || privKo.includes('개인정보보호법'))
ok('privacy exposes data rights (export/delete)', privKo.includes('데이터 이동') || privKo.includes('이동권'))

// --- 3. refund policy content (USDC + 14-day) ---------------------------------
console.log('--- refund policy ---')
const refundKo = (await get('/ko/legal/refund')).html
ok('refund: USDC wallet clause', refundKo.includes('USDC') && refundKo.includes('지갑'))
ok('refund: 14-day unused clause', refundKo.includes('14일'))
ok('refund: 전자상거래법 (e-commerce law) reference', refundKo.includes('전자상거래'))
ok('refund: manage CTA → /billing', refundKo.includes('/ko/billing'))

// --- 4. site-wide 5-line disclaimer -------------------------------------------
console.log('--- global disclaimer ---')
const landingEn = (await get('/en')).html
ok('footer has global disclaimer block', landingEn.includes('data-testid="global-disclaimer"'))
for (const line of [
  'AI-powered market analysis and educational content only',
  'constitutes financial, investment, tax, or legal advice',
  'involves substantial risk',
  'Past performance does not guarantee future results',
  'not registered as an investment adviser in any jurisdiction',
]) {
  ok(`global disclaimer line present: "${line.slice(0, 32)}…"`, landingEn.includes(line))
}
const landingKo = (await get('/ko')).html
ok('KO footer global disclaimer', landingKo.includes('투자자문업자로 등록되어 있지 않습니다'))

// --- 5. cross-references + discovery ------------------------------------------
console.log('--- references + discovery ---')
const termsKo = (await get('/ko/legal/terms')).html
ok('terms → related refund reference + link', termsKo.includes('data-testid="legal-related"') && termsKo.includes('/ko/legal/refund'))
const footer = landingKo
for (const slug of ['terms', 'privacy', 'disclaimer', 'refund']) {
  ok(`footer links /legal/${slug}`, footer.includes(`/ko/legal/${slug}`))
}
const sitemap = (await get('/sitemap.xml')).html
ok('sitemap includes all 4 legal docs',
  ['terms', 'privacy', 'disclaimer', 'refund'].every((s) => sitemap.includes(`/legal/${s}`)))

// (Real-content rendering is already proven above: every legal page renders
// its legal-<slug> article with 5+ substantive sections, so no page is a
// placeholder. A raw "coming soon" text check is unreliable because
// next-intl serializes the full message catalog into every page's HTML.)

console.log(`\nSUMMARY: ${pass} passed, ${fail} failed — ${fail === 0 ? 'ALL PASS' : 'SOME FAILED'}`)
process.exit(fail === 0 ? 0 : 1)
