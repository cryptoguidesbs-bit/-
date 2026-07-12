# CryptoGuide

AI 기반 크립토 마켓 정보 플랫폼 — 실시간 시세, AI 뉴스 요약, 데일리 브리핑,
온체인 데이터, 패턴 분석, 프리미엄 리서치, 교육 콘텐츠, 알림, 리퍼럴, API
센터, 결제 지도를 하나의 구독 서비스로 제공합니다.

> **컴플라이언스**: 정보 제공·교육 목적 서비스이며 투자 자문을 제공하지
> 않습니다. 단정 예측·행동 지시·수익 보장 표현은 AI 출력 필터가 발행 전에
> 차단하고, 모든 AI 생성물에는 모델 라벨이 붙습니다.

## 기술 스택

- **Next.js 14** (App Router) · **TypeScript** · **Tailwind CSS** · **shadcn/ui**
- **next-intl** (다국어: `ko` 기본, `en`) · **React Query** (서버 상태)
- **Prisma** (PostgreSQL) · **Clerk** (인증) · **Stripe** (결제)
- **Anthropic Claude** (AI — 키가 없으면 결정적 mock으로 전체 파이프라인 동작)
- **Leaflet + OpenStreetMap** (결제 지도) · **Sentry** (에러 모니터링)

## 시작하기

```bash
npm install                  # postinstall에서 prisma generate 자동 실행
cp .env.example .env.local   # 환경 변수 설정 (개발은 대부분 빈 값으로 동작)
npm run db:start             # 내장 PostgreSQL 시작 (Windows 로컬 개발용)
npx prisma migrate deploy    # 마이그레이션 적용
npm run dev                  # http://localhost:3000
```

| 스크립트 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행 |
| `npm run db:start\|db:stop\|db:status` | 내장 PostgreSQL 제어 |
| `npm run stripe:seed` | Stripe 상품·가격 생성 (price ID → `.env`, 멱등) |
| `npm run lint` / `npm run format` | ESLint / Prettier |

## 테스트

DB와 dev 서버를 켠 상태에서 스위트별로 실행합니다. 각 스위트는 자체
시드·정리를 수행하며 반복 실행이 가능합니다.

```bash
node scripts/test-<suite>.mjs
# suites: billing, entitlements, market-resilience, news-pipeline, brief,
#         dashboard, portfolio-tools, onchain, patterns, reports, education,
#         alerts, referral, api-center, admin, security, subscription-policy,
#         legal, map, i18n
```

## 문서

| 문서 | 내용 |
| --- | --- |
| [PROGRESS.md](PROGRESS.md) | 단계별 구현 내역 · 테스트 수 · 배포 전 과제 |
| [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md) | 배포 전 운영자가 직접 해야 할 일 |
| [docs/legal-review.md](docs/legal-review.md) | 출시 전 법률 검토 패키지 (로펌 전달용) |
| [docs/region-matrix.md](docs/region-matrix.md) | 지역별 기능 On/Off 후보안 |
| [docs/security-checklist.md](docs/security-checklist.md) | 보안 체크리스트 (21단계) |
| [docs/perf-report-stage20.md](docs/perf-report-stage20.md) | 성능 최적화 리포트 (20단계) |
| [CRYPTO_MAP_PLAN.md](CRYPTO_MAP_PLAN.md) | 결제 지도 설계 문서 |

## 컨벤션

- **타임존**: DB/API는 항상 **UTC**(ISO 8601 `Z`), 화면 표시만 사용자 로컬
  시간대로 변환 — [src/lib/datetime.ts](src/lib/datetime.ts) 참고.
- **다크모드**: 기본값 다크 (`next-themes`, class 전략).
- **감사 로그**: `ConsentLog`(동의 이력)·`ContentAuditLog`(발행 감사)·
  `SecurityEvent`(민감 작업)는 append-only.
- **지역 정책**: 기능별 국가 화이트리스트는 관리자 콘솔의 지역 스위치로 배포
  없이 즉시 조정 가능.
- **Sentry**: DSN이 비어 있으면 로컬에서 자동 비활성화.
