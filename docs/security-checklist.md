# 21단계 — 보안 체크리스트

> 작성: 2026-07-08 · 검증: `scripts/test-security.mjs` (32/32 통과) + 회귀
> (billing/admin/alerts/api-center/referral/dashboard)

각 항목은 구현 위치와 자동 검증 방식을 함께 기록한다. `[x]`는 테스트로
검증됨, `[~]`는 구현됐으나 배포 환경에서 최종 확인이 필요한 항목.

## 인증 · 웹훅 검증

- [x] **Clerk 세션 인증** — 모든 보호 라우트가 `auth()`/`getDbUser()`로 검증,
  미들웨어가 `/profile·/billing·/dashboard` 미인증 접근을 로그인으로 리다이렉트
- [x] **Stripe 웹훅 서명 검증** — `parseWebhook`가 서명 검증, 미서명/위조 → 400
  (`src/app/api/billing/webhook`)
- [x] **Clerk 웹훅 svix 서명 검증** — `svix` `Webhook.verify`, 위조 → 400,
  유효 서명 시 `user.deleted` 캐스케이드 삭제·`user.updated` 동기화
  (`src/app/api/webhooks/clerk`). `CLERK_WEBHOOK_SECRET` 필수(미설정 시 전량 거부)

## RBAC (권한)

- [x] **플랜 기반 기능 게이트** — `checkFeature`(FREE→WHALE 랭크), 플랜 미달 403
- [x] **역할 기반 관리자 게이트** — `requireAdmin`, 비관리자 관리 API 403
- [x] **API 키 인증** — 무효/폐기/플랜 미달 키 401·403 (`src/lib/api/auth.ts`)
- [x] **지역 정책** — 요청 국가 화이트리스트, 런타임 스위치로 즉시 차단 가능

## 레이트 리미팅

- [x] **공개 API v1** — 키당 분당 60회, 초과 429 + Retry-After (18단계)
- [x] **민감 뮤테이션** — consent·checkout·data-export·account-delete·admin에
  IP/식별자 기반 제한 (`src/lib/security/rate-limit.ts`), 초과 429
- [~] **다중 인스턴스 (알려진 한계)** — 레이트리밋 저장소는 인메모리 고정창이라
  Vercel 인스턴스마다 따로 센다(실효 한도 = 설정값 × 활성 인스턴스 수). 현재
  트래픽에서는 비용·복잡도 대비 실익이 없어 의도적으로 유지. 유료 트래픽이
  붙으면 Redis/Upstash로 교체 (호출 형태 동일, `src/lib/security/rate-limit.ts`)
- [x] **뮤테이션 추가 제한** — 알림 채널 설정(20/분), 포트폴리오 AI 해설(6/분),
  웹훅 테스트(6/분, Whale 게이트), 뉴스 목록(120/분·page≤200), 추천 랜딩(30/분),
  퍼널 이벤트(60/분)

## XSS · CSRF · 입력 검증

- [x] **XSS** — `dangerouslySetInnerHTML` 미사용(전 코드베이스 0건). 리포트 렌더러는
  React 엘리먼트로 구성돼 자동 이스케이프. 심볼 등 입력에 정규식 화이트리스트
- [x] **CSRF** — 쿠키 인증 뮤테이션(`/api/me·/api/admin·consent·checkout·cancel`)에
  same-origin 검증(미들웨어). 교차 출처/Origin 부재 → 403. Bearer·cron-secret은
  면제(앰비언트 자격증명이 아님)
- [x] **입력 검증** — zod 스키마로 전 엔드포인트 파싱, 무효 심볼/enum/범위 → 400

## 보안 헤더

- [x] `X-Content-Type-Options: nosniff`
- [x] `X-Frame-Options: SAMEORIGIN` + CSP `frame-ancestors 'self'`
- [x] `Referrer-Policy: strict-origin-when-cross-origin`
- [x] `Strict-Transport-Security` (HSTS, 2년, includeSubDomains, preload)
- [x] `Permissions-Policy` (camera/mic/FLoC 차단, geolocation은 자체 문서만 `self` — 지도 "내 위치")
- [x] `Content-Security-Policy` — **프로덕션 전면 정책** (`next.config.mjs`
  `buildCsp()`): default-src 'self'; script-src self + Clerk FAPI(발행키에서
  도출) + challenges.cloudflare.com; img-src self/data/blob + img.clerk.com +
  *.tile.openstreetmap.org; connect-src self + Clerk + *.protect.clerk.com +
  wss://stream.binance.com:9443 + Sentry ingest(DSN에서 도출); frame-src Clerk/
  Turnstile; worker-src self blob; object-src none; upgrade-insecure-requests.
  개발 모드는 frame-ancestors·base-uri·form-action·object-src만(HMR eval 필요).
  `next build && next start`로 홈(지도 타일·티커 WS)·로그인(Clerk 폼·OAuth 버튼)
  콘솔 CSP 위반 0건 확인. Vercel preview에서는 vercel.live 자동 허용
- [x] `X-Powered-By` 제거
- [x] **인증 JSON 캐시 금지** — `/api/me/*`, `/api/admin/*`, `/api/v1/*`에
  `Cache-Control: private, no-store`
- [x] **세션 쿠키 위생** — 손상된 3분절 `__session`(JWT 아님)은 무시·삭제
  (기존: clerkMiddleware 예외로 전 페이지 500). Clerk 진단 헤더
  `x-clerk-auth-*` 응답에서 제거. CSRF 동일출처 검사는 스킴+호스트 비교
- [x] **SSRF** — 웹훅 URL: 리다이렉트 미추종(`redirect: 'manual'`, 3xx는 실패),
  `net.BlockList` 기반 사설/예약 대역(IPv4-mapped IPv6 포함) 차단, 푸시 엔드포인트는
  알려진 푸시 서비스 호스트만 허용
- [x] **알림 목적지 소유 검증** — 이메일은 계정 주소만, 텔레그램은 개인 chat id
  (양수)만·운영 채널 id 거부

## 감사 로그

- [x] **콘텐츠 감사** — 브리핑/리포트 발행 `ContentAuditLog` (9·14단계)
- [x] **동의 감사** — `ConsentLog`(IP·UA·버전, 법적 증빙) (4단계)
- [x] **보안 감사** — `SecurityEvent`(계정 삭제·데이터 이전·관리자 회원/지역 변경),
  actorEmail 인라인 보관으로 계정 삭제 후에도 추적 유지 (`src/lib/security/audit.ts`)
- [x] **운영 이상 징후** — `OpsEvent` + 관리자 자동 알림 (19단계)

## GDPR

- [x] **삭제권(erasure)** — `DELETE /api/me/account` (확인 토큰 필수), DB 캐스케이드
  삭제 + Clerk 신원 삭제. Clerk 측 삭제도 웹훅으로 동기화. 삭제 전 감사 기록
  (userId는 SetNull, actorEmail 보존)
- [x] **데이터 이전(portability)** — `GET /api/me/export`, 계정 전체를 JSON 번들로
  다운로드. 프로필 페이지 셀프서비스 UI(`PrivacyControls`)
- [x] **데이터 최소 수집** — export/내부 처리 어디에도 키 해시·웹훅 시크릿 미포함;
  API 키는 prefix만; 리퍼럴 IP는 sha256+salt 해시만; 포트폴리오 AI 해설은 비중(%)만
  모델 전송(11단계). 동의 IP는 법적 증빙 목적 한정
- [~] **최종 법률 검토** — 국가별 규제·보관 기간·DPA는 22단계에서 확정
  (`docs/legal-review.md`)

## 검증 실행

```
npm run db:start            # DB 확인
npm run dev                 # 서버 기동
node scripts/test-security.mjs   # 32/32
```

배포 후 추가 확인: `npx lighthouse`(SEO/Best-Practices), 레이트리밋 공유 스토어
전환(유료 트래픽 시), `CLERK_WEBHOOK_SECRET`(Clerk 대시보드 → Webhooks →
`https://cryptoguide.live/api/webhooks/clerk`, user.* 이벤트) / `SENTRY_*` 실제 값 설정,
`DIRECT_URL`(빌드 시 `prisma migrate deploy`가 사용) 존재 확인.
