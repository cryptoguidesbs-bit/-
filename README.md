# Insight Platform

투자 인사이트 / 포트폴리오 / 리포트 플랫폼 — 1단계 초기 세팅.

## 기술 스택

- **Next.js 14** (App Router) · **TypeScript** · **Tailwind CSS** · **shadcn/ui**
- **Framer Motion** (애니메이션) · **React Query** (서버 상태)
- **next-intl** (다국어: `ko` 기본, `en`)
- **Prisma** (PostgreSQL) · **Sentry** (에러 모니터링)
- ESLint + Prettier (+ tailwind class 정렬 플러그인)

## 시작하기

```bash
npm install            # postinstall에서 prisma generate 자동 실행
cp .env.example .env.local   # 환경 변수 설정
npm run dev            # http://localhost:3000 → /ko 로 리다이렉트
```

| 스크립트 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행 |
| `npm run lint` | ESLint |
| `npm run format` | Prettier 포맷팅 |
| `npm run prisma:generate` | Prisma Client 생성 |
| `npm run prisma:migrate` | 마이그레이션 (DB 필요) |

## 폴더 구조

```
├── messages/              # next-intl 번역 (ko.json, en.json)
├── prisma/
│   └── schema.prisma      # User, Subscription, Portfolio, Watchlist,
│                          # Article, Report, ConsentLog, ContentAuditLog
├── sentry.*.config.ts     # Sentry 초기화 (client/server/edge)
└── src/
    ├── app/
    │   ├── [locale]/      # 로케일 세그먼트 (레이아웃/페이지/에러/404/로딩)
    │   │   └── [...rest]/ # 알 수 없는 경로 → 지역화된 404
    │   ├── api/health/    # 헬스체크 (스모크 테스트용)
    │   ├── global-error.tsx  # 최후 방어선 500 UI
    │   └── globals.css    # Tailwind + shadcn 테마 변수 (다크모드 기본)
    ├── components/
    │   ├── ui/            # shadcn/ui 컴포넌트
    │   ├── providers/     # ThemeProvider, QueryProvider
    │   └── error-boundary.tsx  # 섹션 단위 에러 격리
    ├── i18n/              # routing / request / navigation (next-intl)
    ├── lib/               # prisma client, datetime(UTC 정책), utils
    ├── instrumentation.ts # Sentry 서버 초기화 훅
    └── middleware.ts      # 로케일 라우팅
```

## 컨벤션

- **타임존**: DB/API는 항상 **UTC**(ISO 8601 `Z`), 화면 표시만 사용자 로컬 시간대로 변환 — [src/lib/datetime.ts](src/lib/datetime.ts) 참고. SSR은 UTC로 고정해 하이드레이션 불일치를 방지.
- **다크모드**: 기본값 다크 (`next-themes`, class 전략).
- **컴플라이언스**: `ConsentLog`(약관/마케팅/투자 고지 동의 이력), `ContentAuditLog`(콘텐츠 변경 감사 로그)는 append-only.
- **Sentry**: DSN이 비어 있으면 로컬에서 자동 비활성화. 소스맵 업로드는 `SENTRY_AUTH_TOKEN` 설정 시에만 동작.
