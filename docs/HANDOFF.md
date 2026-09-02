# CryptoGuide — 인수인계 노트

새 작업 세션(사람이든 AI 어시스턴트든)이 이 리포를 이어받을 때 먼저 읽는 문서.
코드로 알 수 없는 결정·상태·함정만 적는다. 마지막 갱신: 2026-09-02.

## 1. 서비스 상태
- 프로덕션 https://cryptoguide.live (Vercel, Neon Postgres, Clerk 인증). 무료 우선 출시 중.
- **결제 비활성(waitlist 모드)**: 법인이 없어 Stripe 라이브 계정을 켤 수 없음. 결제 코드는 완성 상태로 비활성만 — 삭제 금지.
- **AI는 mock-v1**: 실제 LLM 키는 법인 설립 후. 브리핑·요약은 규칙 기반 템플릿으로 생성됨(의도된 상태).
- 크론 8개는 cron-job.org에서 POST + `x-cron-secret`. 브리핑 07:05 KST, 뉴스 수집 30분, 요약 30분 등.
- Next.js 16 / React 19 / next-intl 4 / Sentry 10 (2026-09-02 업그레이드). `middleware.ts`는 deprecated지만 유지 중 — `proxy.ts` 전환은 Clerk·Sentry Turbopack 이슈 안정화 후.

## 2. 절대 원칙 (요청이 있어도 바꾸지 않음)
- 매매 신호·맞춤형 투자 권고·자동매매·수익 보장·거래소(중개) 기능은 **도입 금지**. 모든 콘텐츠는 비개인화 정보 제공.
- 요금제 불변: Free / Starter $29 / Trader $79 / Pro $249 / Whale $799 / Enterprise $1,999~ (연간 = 월×10).
- Market Score·스크리너 등 지표는 "시장 상태 요약"으로만 표현. 방향 언어(매수/매도) 금지 — `scripts/test-market-score.mjs`가 검증.
- 비밀키는 채팅·문서에 쓰지 않고 Vercel 환경변수와 `.env.local`에만.

## 3. 자주 쓰는 명령
- 개발: `npm run dev` (로컬 DB: `npm run db:start`; 5432 wedge 시 postgres 프로세스 종료 → `pgdata/postmaster.pid` 삭제 → 재시작)
- 검증: `npx tsc --noEmit` · `npm run lint` · `npx next build` · `node scripts/test-<name>.mjs` (dev 서버 3000 + 로컬 DB 필요, 26종)
- 새 테스트는 `scripts/lib/test-kit.mjs`를 import (기존 것은 각자 헬퍼 보유).

## 4. 최근 결정·이력 (요약)
- 2026-08-26 브리핑 중단 사고 → AI 예산에 콘텐츠 예약(reserve)+환불 도입. `AI_DAILY_CALL_LIMIT`(Vercel)=400.
- 2026-09-02 뉴스 요약 HELD 사고 → 예산 유예를 시도로 세지 않도록 수정, 행 선점(CAS), 예산 소진 시 즉시 중단. 예산이 밤에 소진되면 PENDING으로 대기(정상). mock 기간에는 한도를 1000 정도로 올려도 됨.
- 홈: 히어로 = 가치제안 텍스트, 지도는 하단 보너스. 실제 스크린샷은 `public/screenshots/`(UI 크게 바뀌면 재캡처).
- SEO: 페이지 메타는 `pageMeta()`(lib/seo) 사용 — 페이지 openGraph를 직접 쓰면 상위 og:image 상속이 끊기므로 헬퍼가 images를 명시함.
- 데이터 신선도 표기는 `DataStatus` 컴포넌트로 통일(없음/일부 없음/지연/N분 전).
- 로고는 나침반 C 마크(최종 확정, 재논의 안 함). PPT 3종·이관 패키지는 사용자 바탕화면.

## 5. 보류 항목 (이유 포함)
- AI Chat: 실키 필요. v1 범위는 Market Score 요약 + 주요 지표 Q&A(비개인화).
- Token Research·언락 캘린더·백테스트: 유료 데이터/퀀트급 작업.
- `/api/me/*` 인증 보일러플레이트 헬퍼 추출, 기존 테스트 24개 헬퍼 이관: 손댈 때 함께.
- 구글 검색 파비콘·제목 갱신: 기술 요건 완비, 구글 캐시 대기(1~2주).
