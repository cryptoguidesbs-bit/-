# 배포 전 체크리스트 — 운영자가 직접 해야 할 일

> 코드 구현(1~22단계 + 추가 기능)은 완료된 상태입니다. 아래는 **사람만 할 수
> 있는 일**(계정 개설·키 발급·법률 검토·플랫폼 설정)을 순서대로 정리한
> 목록입니다. 각 키/값은 배포 플랫폼의 환경 변수로 넣습니다
> (전체 목록·설명: [.env.example](.env.example)).

## 1. 출시 차단 항목 (반드시 완료해야 오픈 가능)

- [ ] **로펌 법률 검토** — 4개 법적 문서(약관·개인정보·면책·환불, ko/en)
      + AI 콘텐츠 샘플(브리핑/패턴) + 지역 기능 매트릭스를 일괄 검토받고,
      검토 완료본을 반영. 지역별 기능 On/Off 최종 확정 후 관리자 콘솔
      지역 스위치 또는 `src/config/features.ts`에 반영.
      → 전달 패키지 정리본: [docs/legal-review.md](docs/legal-review.md),
        [docs/region-matrix.md](docs/region-matrix.md)
- [ ] **프로덕션 DB 준비** — 호스팅 PostgreSQL(Neon/Supabase/RDS 등) 생성 →
      `DATABASE_URL` 설정 → `npx prisma migrate deploy`로 스키마 적용.
      (개발용 내장 PostgreSQL은 프로덕션에 사용 불가)
- [ ] **Clerk 프로덕션 인스턴스** — dashboard.clerk.com에서 프로덕션 인스턴스
      생성(도메인 연결) → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`/`CLERK_SECRET_KEY`
      교체 → **웹훅 엔드포인트 등록**: `https://<도메인>/api/webhooks/clerk`
      (이벤트: user.deleted, user.updated) → 발급된 서명 시크릿을
      `CLERK_WEBHOOK_SECRET`에 설정. Google 소셜 로그인용 자체 OAuth 자격증명
      등록, X(Twitter) 로그인은 X 개발자 앱 생성 후 활성화.
- [ ] **Stripe 라이브 전환** — 계정 활성화(사업자 정보) → 라이브 키로
      `STRIPE_SECRET_KEY` 교체 → 라이브 모드에서 `npm run stripe:seed` 실행해
      상품·가격 생성(새 price ID 8개를 환경 변수에) → **웹훅 엔드포인트 등록**:
      `https://<도메인>/api/billing/webhook`
      (이벤트: checkout.session.completed, customer.subscription.*,
      invoice.upcoming) → 서명 시크릿을 `STRIPE_WEBHOOK_SECRET`에 설정.
- [ ] **`CRON_SECRET`을 강한 무작위 값으로 교체** (현재 로컬 개발용 값)
- [ ] **`NEXT_PUBLIC_APP_URL`을 실제 도메인으로 설정**

## 2. 배포 플랫폼 설정 (Vercel 기준)

- [ ] 리포지토리 연결 → 환경 변수 전체 입력([.env.example](.env.example) 참조)
- [ ] **Cron 연결** — 아래 엔드포인트를 `x-cron-secret: <CRON_SECRET>` 헤더로
      주기 호출 (Vercel Cron 또는 외부 스케줄러):
      | 주기 | 엔드포인트 |
      |---|---|
      | 15~30분 | `POST /api/news/ingest` → `POST /api/news/summarize` |
      | 일 1회 | `POST /api/brief/generate` |
      | 주/월/분기 | `POST /api/reports/generate` (`{"cadence":"WEEKLY"\|"MONTHLY"\|"QUARTERLY"}`) |
      | 1~5분 | `POST /api/alerts/run` |
      | 일 1회 | `POST /api/referral/qualify` |
      | 10~30분 | `POST /api/admin/monitor/run` (운영 자동순환) |
      | 시간~일 1회 | `POST /api/map/sync` (결제 지도 데이터) |
- [ ] 지도 타일: 트래픽이 커지면 OSM 공개 타일 → MapTiler/Stadia 등 제공자
      키 발급 후 전환 (CRYPTO_MAP_PLAN.md §15)

## 3. 선택 항목 (미설정 시 안전한 대체 동작)

- [ ] **`ANTHROPIC_API_KEY`** — 미설정 시 AI가 mock으로 동작. 실제 Claude
      요약/브리핑/리포트를 원하면 키 발급(platform.claude.com) 후 입력만 하면
      자동 전환. `AI_DAILY_CALL_LIMIT`으로 일일 비용 상한.
- [ ] **알림 라이브 채널** — `TELEGRAM_BOT_TOKEN`(BotFather로 봇 생성),
      `RESEND_API_KEY`+`ALERT_EMAIL_FROM`(이메일·갱신 안내), VAPID 키쌍
      (`npx web-push generate-vapid-keys`). 미설정 채널은 기록만 남는
      dev transport로 동작.
- [ ] **Sentry** — DSN + `SENTRY_ORG/PROJECT/AUTH_TOKEN` 설정 시 에러 수집과
      관리자 콘솔 에러 카드가 활성화.
- [ ] **리퍼럴 보상 지급 수단·세무 처리 확정** — 현재 커미션은 원장 기록만,
      지급은 수동 (legal-review S5와 연계).

## 4. 배포 직후 검증 (10분)

- [ ] `https://<도메인>/api/health` 200 확인
- [ ] 가입 → 동의 → 로그인 플로우 1회 (Google 포함)
- [ ] 테스트 카드로 체크아웃 → `/billing`에 구독 반영 확인 → 즉시 해지
- [ ] Stripe/Clerk 대시보드에서 웹훅 delivery 성공 확인
- [ ] 관리자 계정으로 `/admin` 접속 → "모니터 실행" 1회 → 파이프라인 수동
      트리거(뉴스 수집·브리핑) 동작 확인
- [ ] `POST /api/map/sync` 최초 전체 동기화 1회 실행(BTCMap 데이터 적재)
- [ ] Lighthouse 측정: `npx lighthouse https://<도메인>/en` — 20단계 리포트의
      목표(95+) 대비 확인 (로컬에선 측정 불가였음)
- [ ] 중첩 404가 HTTP 200으로 나오는 이슈(프레임워크 제약)는 인지 상태로 유지
      — 필요 시 엣지에서 상태 재기록 (docs/perf-report-stage20.md §5)

## 5. 운영 루틴 (오픈 후)

- 운영 모니터가 결제 실패 급증·파이프라인 정체를 자동 감지해 관리자에게
  인앱 알림 → `/admin`에서 해결 처리. 나머지는 자동 순환.
- 규제 변화 시: `/admin` 지역 스위치로 해당 기능 즉시 차단/화이트리스트 교체
  (배포 불필요).
- 법적 문서 개정 시: `messages/{ko,en}.json`의 `legal.*` 수정 + "최종 개정일"
  갱신.
