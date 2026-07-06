# CryptoGuide 빌드 진행 상황

> 최종 업데이트: 2026-07-06

## 완료된 단계 (1~15)

| 단계 | 내용 | 자동 테스트 | 핵심 구현 |
|---|---|---|---|
| 1 | 초기 세팅 | — | Next.js 14 · TypeScript · Tailwind/shadcn · Prisma · next-intl(ko/en) · Sentry |
| 2 | 공통 레이아웃 | 수동 검증 | Header/Footer/Sidebar/모바일 내비, 다크 전용 테마, SEO(sitemap/robots/hreflang), 지역별 로케일 감지(geo 헤더), 푸터 면책 문구 |
| 3 | 메인 랜딩 | 수동 검증 | Hero/애니메이션 배경, Binance WebSocket 라이브 티커, AI 브리핑 프리뷰, RSS 뉴스, 마켓 대시보드, A-3 요금제(USD), FAQ, Framer Motion. 성과·수익률 표현 전수 검사 |
| 4 | Clerk 인증 | 플로우 전체 통과 | 가입/로그인/재설정/프로필, 가입 동의 체크박스 + ConsentLog(IP·UA 증빙), 내장 PostgreSQL 셋업(`npm run db:start`) |
| 5 | Stripe 결제 | 8/8 | PaymentProvider 추상화, 체크아웃/웹훅(서명 검증)/해지, /billing 구독 관리, 요금제 월·연 토글, 상품·가격 seed(멱등) |
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

**누적 자동 테스트: 283건 전부 통과** (각 `scripts/test-*.mjs`로 재실행 가능)

## 진행 중

| 단계 | 내용 | 상태 |
|---|---|---|
| 16 | 알림 시스템 (Telegram/Email/Browser Push, Price/Whale/Pattern/Macro Alert) | **스키마만 작성됨** — AlertRule/AlertChannelConfig/AlertDelivery 모델 추가(마이그레이션 미적용). 채널 어댑터·엔진·API·UI·테스트 미착수 |

## 남은 단계

| 단계 | 내용 | 비고 |
|---|---|---|
| 16 | 알림 시스템 마무리 | 위 참조 |
| 17~21 | (사용자 플랜 문서 참조) | 단계 정의가 대화로 전달되는 방식이라 미확정 |
| 22 | 법적 문서 | 이용약관/개인정보처리방침/면책조항 정식 작성 — `/legal/*` 자리 페이지 교체, docs/legal-review.md 체크리스트 반영, 지역 제한 국가 목록 확정 |

## 배포 전 처리 목록 (단계 외 누적 과제)

- [ ] ANTHROPIC_API_KEY 발급 → AI 기능(뉴스 요약·브리핑·리포트·포트폴리오 해설)을 mock에서 실제 Claude로 전환 (`.env.local`에 키만 입력하면 자동 전환)
- [ ] 파이프라인 자동 실행 cron 연결 (뉴스 수집/요약, 브리핑 일간, 리포트 주간·월간·분기 — 현재 `x-cron-secret` 헤더로 수동 트리거)
- [ ] Stripe 라이브 전환: 계정 활성화, 라이브 키 교체, 실제 웹훅 엔드포인트 등록
- [ ] Clerk 프로덕션 인스턴스 전환 + X(Twitter) 소셜 로그인 활성화(개발자 앱 자격증명 필요)
- [ ] Next 14 dev의 중첩 notFound() 200 이슈 — 프로덕션 빌드에서 404 상태 재확인
- [ ] `next build` 프로덕션 빌드 검증 (지금까지 dev 서버로만 구동)
- [ ] 내장 PostgreSQL(개발용) → 프로덕션 DB(호스팅 Postgres) 마이그레이션
- [ ] docs/legal-review.md 법률 검토 항목 처리 (22단계 연계)

## 개발 환경 메모

- DB: `npm run db:start` (내장 PostgreSQL 18.4, 데이터 위치 `~\.cryptoguide\pgdata` — 한글 경로 이슈로 프로젝트 밖에 있음). 간헐적으로 꺼지니 테스트 전 확인
- 테스트: dev 서버(`npm run dev`) + DB 켠 상태에서 `node scripts/test-*.mjs`
- 테스트 계정: Clerk 테스트 이메일 `flowtest+clerk_test@example.com` (인증코드 424242)
- AI: `ANTHROPIC_API_KEY` 미설정 시 mock-v1 프로바이더로 전체 파이프라인 동작
