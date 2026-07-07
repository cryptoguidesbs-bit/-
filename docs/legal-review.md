# 출시 전 법률 검토 목록 (Pre-launch Legal Review Checklist)

> 22단계(법적 문서)에서 법률 자문과 함께 확정할 항목들. 각 항목은 코드상
> 구현 위치와 함께 기록한다. 새 개인 데이터 처리 기능이 추가될 때마다 이
> 목록에 등재할 것.

## ⚠ 상태: 로펌 검토 대기 (사람 단계)

본 리포지토리에는 검토 준비가 된 **초안**이 구현되어 있습니다. **유자격
변호사의 검토·서명은 반영되지 않았으며, AI가 이를 대체할 수 없습니다.**
프로덕션 출시 전 아래 일괄 검토 패키지를 로펌에 전달하여 검토·확정해야 합니다.

**검토 패키지(로펌 전달용):**
1. 4개 법적 문서 ko/en — `/legal/{terms,privacy,disclaimer,refund}` (원본: `messages/{ko,en}.json` `legal.*`)
2. 지역별 조항 US/EU/KR — 각 문서의 `regions` 블록 + 전역 5줄 고지(`legal.globalDisclaimer`)
3. AI 콘텐츠 샘플 — 패턴 분석(신뢰도=형태 일치 명시), 마켓 브리핑(비개인화·표현 가이드라인), 리포트
4. 지역 기능 매트릭스 — `docs/region-matrix.md` (기능 × 지역 On/Off 후보안)

**확정 산출물:** 변호사 검토 완료본을 각 문서에 반영 + 지역별 기능 On/Off를
`featureRegionPolicy`(또는 관리자 지역 스위치)에 확정 반영 → 본 문서의 "후보/
초안" 표기를 "확정"으로 갱신.

## 개인 데이터 처리 항목

| # | 항목 | 데이터 | 구현 위치 | 검토 포인트 |
|---|---|---|---|---|
| 1 | 회원 계정 | 이메일, 이름, 프로필 이미지 (Clerk 위탁) | `src/lib/user.ts`, Clerk | 개인정보 처리방침에 수탁사(Clerk) 명시, 국외 이전 고지 |
| 2 | 동의 기록 | 동의 시각, IP 주소, User-Agent | `ConsentLog`, `/api/consent` | IP 보관 기간·목적 명시 (동의 증빙), 파기 정책 |
| 3 | 결제 정보 | Stripe 고객/구독 ID (카드정보는 Stripe 보관) | `Subscription`, `/api/billing/*` | PCI-DSS는 Stripe 책임 범위, 결제내역 보관 의무 기간 |
| 4 | **포트폴리오 데이터 (11단계)** | 보유 심볼, 수량, 평균단가 — 민감한 개인 금융 정보 | `Portfolio*`, `/api/me/portfolio*` | 수집 최소화, 보관 기간, 회원 탈퇴 시 삭제(cascade 구현됨), 암호화 필요성 검토 |
| 5 | 워치리스트 | 관심 심볼 목록 | `Watchlist*`, `/api/me/watchlist` | 포트폴리오 대비 민감도 낮음, 동일 삭제 정책 |
| 6 | 저장 콘텐츠 / 알림 | 북마크, 알림 이력 | `SavedArticle/SavedReport/Notification` | 탈퇴 시 삭제(cascade 구현됨) |
| 7 | **리퍼럴 데이터 (17단계)** | 추천 관계, 가입 IP 해시(sha256+salt, 원본 미보관), 회원 국가 코드 | `Referral*`, `User.country`, `/api/consent` | IP 해시의 개인정보 해당 여부·보관 기간, 어뷰징 audit용 REJECTED 기록 보존 근거, 탈퇴 시 삭제(cascade 구현됨) |

## AI 처리 관련

| # | 항목 | 상태 | 검토 포인트 |
|---|---|---|---|
| A1 | 포트폴리오 AI 해설의 개인 데이터 최소화 | **구현됨** — 모델에는 비중(%)·지표만 전달, 금액/식별자 미전송 (`/api/me/portfolio/insight`) | LLM 제공사(Anthropic) 데이터 처리 계약(DPA), 학습 미사용 확인 |
| A2 | AI 출력 권고 금지 (A-2-7) | **구현됨** — 지시형 문구 필터 후 차단 (`src/lib/portfolio/guidelines.ts`, `src/lib/brief/guidelines.ts`) | 필터 목록의 주기적 갱신 절차 |
| A3 | AI 생성물 라벨 | **구현됨** — 모든 AI 콘텐츠에 모델명 라벨 | AI 생성물 표시 관련 규제(EU AI Act 등) 추이 확인 |
| A4 | AI 해설 비저장 | **구현됨** — 포트폴리오 해설은 응답 후 폐기 | — |

## 서비스 정책

| # | 항목 | 검토 포인트 |
|---|---|---|
| S1 | 투자자문업 해당 여부 | 비개인화 정보 제공 원칙 유지 (브리핑 비개인화 구현됨), 국가별 규제(한국 자본시장법, 미국 IA법 등) |
| S2 | 지역 제한 국가 목록 | `src/config/features.ts`의 화이트리스트 = **출시 후보안**(docs/region-matrix.md에 근거 문서화) — 로펌 검토로 On/Off 최종 확정 필요. 관리자 지역 스위치로 배포 없이 조정 가능 |
| S3 | 뉴스 저작권 | RSS 헤드라인 + 링크 + AI 요약 표시 방식의 인용 적법성, 소스별 이용약관 확인 |
| S4 | 이용약관 / 개인정보처리방침 / 면책조항 / 환불 정책 | **4개 문서 모두 다국어(ko/en) 초안 게시 완료** (`/legal/{terms,privacy,disclaimer,refund}`, `src/components/legal/legal-document.tsx`). 지역별 조항(US/EU/KR) 및 전역 5줄 고지 포함. **⚠ 유자격 변호사 검토·서명 미반영 — 프로덕션 출시 전 필수** |
| S6 | 환불 정책 실제 운영 정합성 | `/legal/refund` 문안이 실제 결제 로직(7일 체험·14일 미사용 환불·프로레이션·다운그레이드 지연·invoice.upcoming 3일 전 안내)과 일치하는지 법률 검토 시 대조. USDC 결제는 미구현(현재 Stripe 카드) — USDC 도입 시 지갑 환불 절차 확정 |
| S5 | **금전 보상 리퍼럴 규제 (17단계)** | 국가별 유료 추천(finder's fee)·경품류 규제 확인 후 `featureRegionPolicy['referral.rewards']` 화이트리스트 확정 (현재 플레이스홀더). 커미션은 추천인의 저장된 국가 기준으로만 발생하며 비허용 지역은 랭킹만 참여. 세무 처리(지급 시 원천징수·소득신고 안내) 및 지급 수단 검토 |
