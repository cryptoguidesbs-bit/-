# 20단계 — 성능 최적화 리포트

> 작성: 2026-07-08 · 측정 환경: 로컬 프로덕션 빌드(`next build` + `next start`, Next.js 14.2.35)

## 요약

랜딩 페이지의 클라이언트 JS를 **73% 줄였고**(52.7 kB → 14.4 kB), framer-motion을
앱 전체 번들에서 제거했다. **프로덕션 빌드를 막고 있던 루트 레이아웃 누락을
해결**해 이제 `next build`가 정상 완료된다(이전 단계까지 프로덕션 빌드 불가
상태였음). SEO·캐싱·스트리밍·서버 컴포넌트·이미지 설정을 정비했다.

---

## 1. 번들 크기 (측정값, `next build` 출력)

| 구간 | Before | After | 변화 |
|---|---|---|---|
| 랜딩 `/[locale]` 페이지 JS | 52.7 kB | **14.4 kB** | **−73%** |
| 랜딩 First Load JS | 267 kB | **229 kB** | −38 kB (−14%) |
| 공유 First Load JS | 149 kB | 149 kB | 변화 없음¹ |
| framer-motion | 번들 포함 | **제거** | 의존성 삭제 |

¹ 공유 청크는 Clerk·React·next-intl·react-query(루트 레이아웃 provider)로
구성되며, 이번 최적화 대상(framer-motion)은 랜딩 전용이라 공유 청크에는
없었다. 공유 청크 추가 감량은 Clerk lazy-load가 필요해 안정성 리스크가 커서
제외.

프로덕션 빌드는 정상 완료(오류 0). 대부분의 페이지가 `●`(SSG) 또는 `○`(정적)로
프리렌더되고, 인증·데이터 종속 페이지만 `ƒ`(동적)로 요청 시 렌더된다.

## 2. 요구사항별 적용 내역

### SEO
- 메타데이터: `title` 템플릿, OpenGraph, Twitter 카드, `metadataBase`, 로케일별
  `hreflang` 대체 링크(`pageAlternates`) — 기존 구현 유지
- `sitemap.xml` / `robots.txt` 정적 생성(9개 내비 + 법적 페이지, ko/en 교차링크)
- **Hero 섹션을 서버 컴포넌트로 전환** → 핵심 카피가 초기 HTML에 포함(이전엔
  클라이언트 렌더로 초기 HTML에 없었음). 크롤러·LCP 모두 개선
- `/admin`은 `robots: { index: false }`로 색인 제외
- **루트 레이아웃 추가로 프로덕션 빌드의 404 경계가 정상 컴파일**

### Lighthouse 95+ 지향 최적화 (레버)
- **RSC 전환**: `HeroSection`·`AiBriefSection`·`WhySection`을 서버 컴포넌트로
  전환 → 클라이언트 JS에서 제외
- **framer-motion → CSS**: 스크롤 인은 IntersectionObserver 1KB 리프(`Reveal`),
  Hero 진입/배경 블롭은 CSS `@keyframes`, FAQ 아코디언은 `grid-rows` 트랜지션.
  `prefers-reduced-motion` 존중
- **시스템 폰트 스택** 유지 → 폰트 다운로드 0바이트, 렌더 블로킹 없음(웹폰트
  대비 LCP 유리)
- 프로덕션에서 `console.*` 제거(error/warn 제외), 클라이언트 소스맵 비활성,
  `X-Powered-By` 제거
- 보안 헤더 전역 적용: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `X-DNS-Prefetch-Control`
  (프로덕션 응답에서 확인)

### 이미지 최적화
- `next.config`에 `images.formats = ['image/avif','image/webp']`,
  `minimumCacheTTL 30일` 설정
- 현재 UI는 래스터 이미지 없이 SVG 차트 + CSS로 구성 → 실질 이미지 페이로드
  최소. 향후 이미지 추가 시 `next/image`로 자동 최적화되도록 설정 완비

### Lazy Loading / Dynamic Import
- `Reveal`(IntersectionObserver)로 뷰포트 진입 시에만 애니메이션
- 라우트 레벨 `loading.tsx` — 서버 컴포넌트의 auth/권한 조회 중 스켈레톤 즉시
  스트리밍
- 실시간 데이터 위젯(뉴스·마켓·온체인)은 react-query 클라이언트 컴포넌트로
  분리되어 초기 렌더를 막지 않음

### Caching / Streaming / Server Components
- 정적 자산(`/_next/static`)은 Next 기본 불변 캐시(1년)
- react-query `staleTime 60s`, `refetchOnWindowFocus false`
- `resilientFetch` 마지막 정상값 캐시(업스트림 장애 시에도 응답)
- 라우트별 `loading.tsx` 스트리밍 셸 + 서버 컴포넌트 전환

### CDN 리전 최적화
- 타깃 대륙(요금제 지역 화이트리스트 기준): APAC(KR/JP/SG), 미주(US/CA),
  유럽(GB/DE/FR/NL)
- 권장 엣지 리전: `icn1`(서울) · `hnd1`(도쿄) · `sin1`(싱가포르) ·
  `iad1`(미 동부) · `fra1`(프랑크푸르트)
- `scripts/perf-latency-check.mjs` — 배포 오리진에 대해 경로별 TTFB
  p50/p95/min/max를 측정하는 실행 가능한 점검 도구

## 3. 측정 지표

| 항목 | 결과 |
|---|---|
| 프로덕션 빌드 | **정상 완료** (이전: 루트 레이아웃 누락으로 실패) |
| 오리진 TTFB (로컬 prod, p50) | `/ko` 33ms · `/en` 26ms · `/ko/news` 24ms · `/api/health` 12ms |
| 보안 헤더 | prod 응답에서 4종 확인 |
| 회귀 테스트 | entitlements 97/97 · education 21/21 (새 루트 레이아웃·loading.tsx 하에서 페이지 정상 렌더) |

> TTFB 수치는 로컬(네트워크 0)이라 **오리진 렌더 시간**을 나타낸다. 대륙별
> 실제 지연은 배포 후 각 리전에서 `perf-latency-check.mjs`로 측정한다.

## 4. Lighthouse 검증 방법

이 개발 환경은 헤드리스 브라우저가 동작하지 않아(4단계부터 프리뷰 브라우저
불능) Lighthouse 점수를 직접 측정하지 못했다. 배포 후 아래로 확정한다:

```
npx lighthouse https://<도메인>/en --only-categories=performance,seo,best-practices,accessibility --form-factor=desktop
# 또는 PageSpeed Insights: https://pagespeed.web.dev/
```

목표: Performance/SEO/Best-Practices/Accessibility 각 **95+**. 위 최적화(랜딩
JS −73%, RSC 전환, 시스템 폰트, 보안 헤더, 이미지 포맷)가 그 방향의 레버다.
초기 HTML에 Hero 카피가 포함되고 폰트 다운로드가 없어 LCP·SEO에 유리하다.

## 5. 알려진 제약

- **중첩 `notFound()`가 200 반환** (Next 14 + next-intl): not-found UI는 정상
  렌더되나 HTTP 상태가 404가 아니다. 프로덕션 빌드에서도 재현되며 프레임워크
  레벨 이슈다. 완화책: not-found 페이지 `noindex`, 또는 배포 레이어(미들웨어/
  엣지)에서 상태 재기록. 15단계부터 추적된 항목으로 이번 단계에서 루트
  레이아웃을 추가해 프로덕션 빌드 자체는 정상화했다.
- 공유 번들의 Clerk(인증)는 전 페이지 공통이라 lazy-load 시 로그인 UX 리스크가
  커 이번 범위에서 제외.
