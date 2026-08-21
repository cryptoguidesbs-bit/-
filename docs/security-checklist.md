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
- [~] **다중 인스턴스** — 현재 인메모리 고정창(단일 인스턴스). 프로덕션 수평
  확장 시 Redis/Upstash로 교체 (호출 형태 동일). PROGRESS.md 배포 목록 등재

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
- [x] `Permissions-Policy` (camera/mic/geolocation/FLoC 차단)
- [x] `Content-Security-Policy` — frame-ancestors·base-uri·form-action·object-src
- [x] `X-Powered-By` 제거
- [~] **CSP script-src 강화** — 현재 CSP는 클릭재킹·base-tag·form-hijack 방어에
  집중(스크립트 소스 미제한). 전면 script-src 정책은 Clerk/Next 인라인 부트스트랩
  검증이 필요한 배포 시 강화 항목(프리뷰 브라우저 불능으로 이번에 미검증)

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

배포 후 추가 확인: `npx lighthouse`(SEO/Best-Practices), CSP script-src 강화,
레이트리밋 공유 스토어 전환, `CLERK_WEBHOOK_SECRET`/`SENTRY_*` 실제 값 설정.
