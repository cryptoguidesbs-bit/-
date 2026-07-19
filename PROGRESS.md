# CryptoGuide 빌드 진행 상황

> 최종 업데이트: 2026-07-08

## 완료된 단계 (1~21)

| 단계 | 내용 | 자동 테스트 | 핵심 구현 |
|---|---|---|---|
| 1 | 초기 세팅 | — | Next.js 14 · TypeScript · Tailwind/shadcn · Prisma · next-intl(ko/en) · Sentry |
| 2 | 공통 레이아웃 | 수동 검증 | Header/Footer/Sidebar/모바일 내비, 다크 전용 테마, SEO(sitemap/robots/hreflang), 지역별 로케일 감지(geo 헤더), 푸터 면책 문구 |
| 3 | 메인 랜딩 | 수동 검증 | Hero/애니메이션 배경, Binance WebSocket 라이브 티커, AI 브리핑 프리뷰, RSS 뉴스, 마켓 대시보드, A-3 요금제(USD), FAQ, Framer Motion. 성과·수익률 표현 전수 검사 |
| 4 | Clerk 인증 | 플로우 전체 통과 | 가입/로그인/재설정/프로필, 가입 동의 체크박스 + ConsentLog(IP·UA 증빙), 내장 PostgreSQL 셋업(`npm run db:start`) |
| 5 | Stripe 결제 | 8/8 | PaymentProvider 추상화, 체크아웃/웹훅(서명 검증)/해지, /billing 구독 관리, 요금제 월·연 토글, 상품·가격 seed(멱등) |
| 5b | 구독·환불 정책 | 30/30 | 요금제 카드 주기 표시(/월·/년)+연간 "2개월 무료·17%" 배지, 7일 무료 체험(trial_period_days, 체험 중 해지=무청구), 갱신 3일 전 안내(invoice.upcoming 웹훅→알림), 업그레이드 즉시+일할 차액(proration), 다운그레이드 기간 말 적용(pending→갱신 시 전환), 해지 cancelAtPeriodEnd(월·연), **연간 14일 내+미사용 전액 환불(AccessLog 기반 판별)** — 전부 Stripe 테스트 모드 실검증 |
| 5c | 환불 정책 페이지 | 렌더 검증 | `/legal/refund` 다국어(ko/en) 정식 게시 — 전자상거래법 톤 7개 섹션(자동갱신·무료체험·월/연 환불·플랜변경·디지털콘텐츠 청약철회 제한·USDC 지갑 환불), 이용약관에서 참조 링크, 푸터·사이트맵 자동 반영, 구독 관리 CTA |
| + | 요금 병행 표기·할인 검증 | 23/23 | 요금제 카드가 두 주기를 항상 병행 표기 — 월간 보기: 연간 가격+2개월 무료 힌트, 연간 보기: 월 환산가(연간/12)+할인 배지. Stripe 시드 가격 8종이 설정값(연간=월간×10, 17%)과 일치함을 실 API로 검증, 체크아웃 세션 line item이 주기별 정확한 금액($199/$1,990/$4,990) 청구 확인 (scripts/test-pricing.mjs) |
| + | 언어 자동 감지 보완 | 24/24 | 첫 방문 시 브라우저 언어(Accept-Language 최우선 q값 태그) 기반: 한국어→/ko, **그 외 모든 언어→/en**(기존엔 fr/ja 등이 defaultLocale ko로 떨어짐), geo는 Accept-Language 없을 때만 폴백, 수동 언어 선택은 NEXT_LOCALE 쿠키(1년)로 저장돼 감지보다 우선(무효 쿠키는 무시), 딥링크 경로 보존, 스위처 전 페이지(헤더+모바일) testid, hreflang ko/en/x-default+canonical 검증 (scripts/test-i18n.mjs) |
| + | Crypto Map (결제 지도) | 18/18 | 로그인 전용(전 플랜 무료)·미들웨어 리다이렉트, Leaflet+OSM 지도(ssr:false 동적로드), BTCMap→`MapPlace` 서버 동기화(resilientFetch·증분) + **최초 전체 적재 완료(28,821곳, scripts/map-sync-initial.mjs)**, viewport(bbox) API + 필터(코인/카테고리/검색)+상한/too-wide 가드, 온라인 서비스(config JSON), 국가 규제(`CountryRegulation` seed→DB, 참고용), 상세 카드·길찾기·범례, **"내 주변" 위치권한 거부 시 국가중심/로케일기본 폴백(/api/map/locate) + 빈 결과 안내**(위치 미저장), 상시 면책. **마커 클러스터링(react-leaflet-cluster)·최소줌5·상한1500·호버 툴팁·선택 하이라이트·핀 색상 범례·로딩 표시 업그레이드.** 설계문서 CRYPTO_MAP_PLAN.md. 저줌 국가 오버레이·admin편집은 후속 |
| 6 | 구독 권한 관리 | 97/97 | 기능 매트릭스 14키 × 5플랜, 지역 화이트리스트 엔진, 프리미엄 페이지 게이트, /api/me/entitlements, ADMIN 우회 |
| 7 | 시장 데이터 | 13/13 | 복원력 페처(타임아웃·재시도·429쿨다운·최종값 캐시), 크립토(CryptoCompare→Binance 폴백)·지수 6종(Yahoo 미러)·F&G, API 차단 시에도 서비스 유지 검증 |
| 8 | 뉴스 시스템 | 14/14 | 지역균형 RSS 6종(미/유/아), AI 요약 파이프라인(수집→요약→발행), sanity check + 컴플라이언스 필터(위반 시 보류), 뉴스톤 심리지수, 검색/카테고리 |
| 9 | AI Market Brief | 21/21 | BTC/ETH/알트/매크로/오늘의 브리핑 자동 생성, Standard 기본/Professional 상세 2티어, 표현 가이드라인(단정 예측·행동 지시 금지) 강제, LLM 일일 비용 한도, ContentAuditLog, 면책 상시 |
| 10 | 회원 대시보드 | 31/31 | Watchlist/Portfolio/저장 기사·리포트/알림 CRUD, 실시간 시세 enrich, 소유권 격리, /dashboard 위젯 |
| 11 | Portfolio 도구 | 19/19 | P&L·배분·HHI 분산지표(정확값 검증), SVG 도넛/바 차트, AI 교육 해설(A-2-7: 권고형 차단, 개인정보 최소화), docs/legal-review.md 법률 검토 목록 |
| 12 | Whale & On-chain | 17/17 | 웨일 트래커(Blockchair→멤풀 폴백), 거래소 플로우 추정(공개 지갑 목록), 네트워크 지표 4종+스파크라인, 스테이블코인 시총, Institutional 게이트+지역 정책 |
| 13 | AI Pattern | 19/19 | 피벗 기반 7종 패턴 감지(삼각형/깃발/컵/이중천장·바닥/H&S/지지저항), Confidence=형태 일치 명시, 매매 지시(진입·목표·손절가) 금지 자동 검사, Professional 게이트 |
| 14 | Premium Research | 23/23 | 주간/월간/분기 × ETF/매크로/온체인 리포트, 생성→자동 검수→발행 파이프라인(위반 시 IN_REVIEW 보류), REVIEW+PUBLISH 감사 로그, Institutional 게이트 |
| 15 | Education | 21/21 | 4트랙(Trading/TA/Risk/Psychology) × 3레벨 = 12레슨(한/영 실콘텐츠), 전환 퍼널(입문 무료→중급 회원→고급 Standard+), 전 플랜 커리큘럼 노출 |
| 16 | 알림 시스템 | 34/34 | Price/Whale/Pattern/Macro 규칙 × INAPP/Telegram/Email/Push 채널, 규칙·채널 CRUD API, 알림 엔진(규칙당 시간당 1회 쿨다운, 발송 시점 플랜 재확인), "이벤트 발생 통지" 전용 — 지시형 문구 필터가 발송 전 차단(위반 시 SKIPPED 기록), 자격증명 없는 채널은 dev transport로 기록만, /alerts 알림 센터(Professional+ 게이트), 발송 이력 로그 |

| 17 | Referral | 32/32 | 추천 코드/링크(/r/[code], 30일 first-touch 쿠키), 가입 시 attribution + 어뷰징 방지 5종(본인 추천·본인 IP·중복 IP·기존 계정·24h 속도 제한 — 거절도 REJECTED로 감사 기록), 유료 전환 시 QUALIFIED + 커미션(첫 플랜 월 요금 10%, 결제 sync 연동 + cron 스윕), 금전 보상은 추천인 국가 기준 지역 화이트리스트로만 발생(비허용 지역은 랭킹만), 익명화 랭킹, /referral 페이지, legal-review.md S5·개인정보 7번 등재 |

| 18 | API Center | 32/32 | Legendary 전용 REST API v1 3종(시세/공포탐욕/최신 브리핑 — 모든 응답 meta에 면책+재배포 금지 조건), API 키(발급 시 1회 노출, sha256 해시만 저장, 최대 5개, 폐기), 사용량 일별 집계 대시보드, 키당 분당 레이트리밋(429+Retry-After, 21단계 연계), 호출 시점 플랜·지역 재확인, HMAC 서명 웹훅(brief/report 발행 이벤트 + 테스트 발송), /api-center 문서 페이지 |

| 19 | 관리자(Admin) | 43/43 | /admin 운영 콘솔(ADMIN 전용): 회원 검색·플랜/역할 수동 관리(자기 강등 차단), Stripe 매출 자동 집계(카드/USDC 통합 USD + DB MRR 추정·연간 플랜 월할), 파이프라인 상태·트리거, 전체 공지 발송, **지역별 서비스 스위치(FeatureSwitch — 배포 없이 즉시 반영, 전 지역 OFF/화이트리스트 교체, v1 API에도 즉시 적용)**, ContentAuditLog/ConsentLog 조회, Sentry 에러 리포트(미설정 시 dev 폴백), **자동 운영 순환(ops 모니터): PAST_DUE 유예 초과 자동 만료 → 이상 징후 감지(결제 실패 급증·파이프라인 정체) → 관리자 자동 알림 → 미해결 중복 억제 → 해결 후 재경보** |

| 20 | 성능 최적화 | 회귀 118 | 랜딩 클라이언트 JS −73%(52.7→14.4 kB), framer-motion 앱 전체 제거(CSS/IntersectionObserver 대체), **루트 레이아웃 추가로 프로덕션 빌드 정상화**(이전 빌드 불가), Hero/AiBrief/Why 서버 컴포넌트 전환(초기 HTML에 카피 포함), next.config(avif/webp·optimizePackageImports·removeConsole·소스맵 off·보안 헤더 4종), 라우트 loading.tsx 스트리밍, CDN 리전 점검 스크립트(perf-latency-check.mjs), 리포트 docs/perf-report-stage20.md |

| 21 | 보안 | 32/32 | Clerk 웹훅 svix 서명검증(user.deleted 캐스케이드), CSRF same-origin 검증(쿠키 뮤테이션, Bearer·cron 면제), 범용 레이트리밋(consent·checkout·export·delete·admin), 보안 헤더 확장(HSTS·Permissions-Policy·CSP), SecurityEvent 감사 로그, **GDPR: 삭제권(/api/me/account)·데이터 이전(/api/me/export)·최소 수집**, 프로필 개인정보 셀프서비스 UI, 체크리스트 docs/security-checklist.md |
| 22 | 법적 문서 | 35/35 | 4개 문서 다국어(ko/en) 초안 게시 — 이용약관/개인정보/면책/환불(`/legal/*`, LegalDocument 통합 렌더러). **지역별 조항 US(투자자문업자 미등록·SEC)·EU(GDPR·MiCA)·KR(자본시장법·개인정보보호법)**, 전역 5줄 고지(footer 전 페이지 노출), 약관↔환불 상호참조, docs/region-matrix.md(지역 기능 매트릭스 후보안). **⚠ 변호사 검토·서명은 사람 단계 — 미반영(출시 전 필수)** |

**누적 자동 테스트: 521건 + 20단계 회귀 118건 전부 통과** (각 `scripts/test-*.mjs`로 재실행 가능)

## 프로젝트 상태

**계획된 1~22단계 + 추가 기능(구독정책·환불페이지·결제지도·i18n 보완) 구현
완료.** 최종 전수 점검(2026-07-09): 프로덕션 빌드 정상 + **테스트 스위트 20종
560건 전부 통과** + 카피 톤 통일(해요체→합니다체)·자리 페이지(insights) 내비
제외·README/.env.example 최신화. 프로덕션 출시 전 남은 것은 코드 작업이
아니라 사람·운영 단계이며, **[DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md)**에
운영자가 직접 할 일을 순서대로 정리했다.

### 출시 전 필수 (사람 단계)
- [ ] **법적 문서·지역 매트릭스 로펌 검토·서명** — 4개 문서 + AI 콘텐츠 샘플 + `docs/region-matrix.md` 일괄 검토 후 지역별 On/Off 확정 (docs/legal-review.md)

## 배포 전 처리 목록 (단계 외 누적 과제)

- [ ] ANTHROPIC_API_KEY 발급 → AI 기능(뉴스 요약·브리핑·리포트·포트폴리오 해설)을 mock에서 실제 Claude로 전환 (`.env.local`에 키만 입력하면 자동 전환)
- [ ] 파이프라인 자동 실행 cron 연결 (뉴스 수집/요약, 브리핑 일간, 리포트 주간·월간·분기, 알림 엔진 `/api/alerts/run`, 리퍼럴 정산 `/api/referral/qualify`, 운영 모니터 `/api/admin/monitor/run`, 결제 지도 동기화 `/api/map/sync` — 현재 `x-cron-secret` 헤더로 수동 트리거)
- [ ] 결제 지도: 프로덕션 타일 제공자 전환(OSM 공개 타일 → MapTiler/Stadia 등), BTCMap 최초 전체 동기화 1회 실행
- [ ] Sentry 에러 리포트 연동: `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` 설정 (관리자 콘솔 에러 카드가 자동 활성화)
- [ ] 알림 라이브 채널 자격증명: `TELEGRAM_BOT_TOKEN`(봇 생성), `RESEND_API_KEY`+`ALERT_EMAIL_FROM`(이메일), `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`(브라우저 푸시, `npx web-push generate-vapid-keys`) — 미설정 시 dev transport로 기록만 됨
- [ ] Stripe 라이브 전환: 계정 활성화, 라이브 키 교체, 실제 웹훅 엔드포인트 등록
- [ ] Clerk 프로덕션 인스턴스 전환 + X(Twitter) 소셜 로그인 활성화(개발자 앱 자격증명 필요)
- [x] `next build` 프로덕션 빌드 검증 — 20단계에서 루트 레이아웃 추가로 정상 완료 확인
- [ ] 중첩 notFound() 200 이슈: 프로덕션 빌드에서도 재현(Next 14 + next-intl 제약). not-found UI는 정상 렌더 — 배포 레이어에서 상태 재기록 또는 noindex로 완화 (docs/perf-report-stage20.md §5)
- [ ] 내장 PostgreSQL(개발용) → 프로덕션 DB(호스팅 Postgres) 마이그레이션
- [ ] docs/legal-review.md 법률 검토 항목 처리 (22단계 연계 — 리퍼럴 금전 보상 국가별 규제 S5 포함)
- [ ] 리퍼럴 보상 지급 수단·세무 처리 확정 (현재 원장 기록만, 지급은 수동)
- [ ] API 레이트리밋 저장소를 인메모리 → 공유 스토어(Redis 등)로 전환 (다중 인스턴스 배포 시, 21단계 연계)
- [ ] CLERK_WEBHOOK_SECRET 실제 값 설정 + Clerk 대시보드에 웹훅 엔드포인트(/api/webhooks/clerk) 등록 (user.deleted/updated 동기화)
- [ ] CSP script-src 강화 (현재는 frame-ancestors/base-uri/form-action만 — Clerk/Next 인라인 부트스트랩 검증 후 배포 시 강화)

## 개발 환경 메모

- DB: `npm run db:start` (내장 PostgreSQL 18.4, 데이터 위치 `~\.cryptoguide\pgdata` — 한글 경로 이슈로 프로젝트 밖에 있음). 간헐적으로 꺼지니 테스트 전 확인
- 테스트: dev 서버(`npm run dev`) + DB 켠 상태에서 `node scripts/test-*.mjs`
- 테스트 계정: Clerk 테스트 이메일 `flowtest+clerk_test@example.com` (인증코드 424242)
- AI: `ANTHROPIC_API_KEY` 미설정 시 mock-v1 프로바이더로 전체 파이프라인 동작
