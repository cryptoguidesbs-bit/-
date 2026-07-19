# Crypto Map (결제 지도) — 설계 문서

> 상태: **MVP 구현 완료** (2026-07-08~09). 테스트 18/18 통과
> (`scripts/test-map.mjs`). **최초 데이터 적재 완료**: `scripts/map-sync-initial.mjs`로
> BTCMap 전체 28,821곳 적재(서울 등 실매장 조회 확인). **"내 주변" 폴백 추가**:
> 위치 권한 거부 시 `/api/map/locate`가 접속 국가 중심(또는 로케일 기본 도시)로
> 이동하고 안내를 표시. **마커 클러스터링 추가**(react-leaflet-cluster —
> 클러스터 버블/카운트, 최소줌 5로 완화, 상한 1500, 핀 호버 툴팁, 선택 핀
> 하이라이트, 핀 색상 범례, 로딩 표시). 아래 설계대로 구현됨. **후속(follow-up)으로 남긴 것**:
> 저줌 국가 경계
> GeoJSON 오버레이(현재 범례·뱃지만), 규제 데이터 admin 편집 UI(현재 config
> seed→DB), 프로덕션 타일 제공자 전환(현재 개발용 OSM), 즐겨찾기(`MapSavedPlace`,
> 미구현). 지도 자체의 시각 렌더는 이 환경의 프리뷰 브라우저 제약으로 자동
> 검증 불가 → localhost에서 사용자 확인.

## 1. 개요

로그인한 회원이 세계 지도 위에서 **비트코인/크립토를 받는 실물 매장·코인 ATM·
온라인 서비스**를 탐색하고, **나라별 규제 상태**를 참고할 수 있는 기능. 유저
위치 기반 "내 주변" 탐색과 다른 나라 탐색을 모두 지원한다. **정보 제공 목적**
이며 거래를 중개하지 않는다.

- 지도: **Leaflet + OpenStreetMap**(무료 타일)
- 데이터: **BTCMap API**(매장·ATM) + **로컬 JSON**(온라인 서비스) + **우리 관리
  데이터**(주요국 규제 상태)
- 접근: **로그인 필수, 전 플랜 무료**(플랜 게이트 없음)

경로(라우트) 결정: `/[locale]/map` (예: `/ko/map`, `/en/map`).

---

## 2. 접근 권한 설계

요구사항: 로그인 회원만, 전 플랜 무료, 비로그인 시 로그인 페이지로 리다이렉트.
→ 기존 `/dashboard`와 **동일 패턴**(인증만 요구, 플랜 게이트 없음)을 재사용한다.

### 2.1 미들웨어 (1차 방어 — 리다이렉트)

`src/middleware.ts`의 `isProtectedRoute` 매처에 map 경로를 추가한다. (현재
profile/billing/dashboard와 같은 방식.)

```ts
const isProtectedRoute = createRouteMatcher([
  '/:locale/profile(.*)', '/profile(.*)',
  '/:locale/billing(.*)', '/billing(.*)',
  '/:locale/dashboard(.*)', '/dashboard(.*)',
  '/:locale/map(.*)', '/map(.*)',          // ← 추가
])
```

비로그인 접근 시 기존 로직이 그대로 `/{locale}/sign-in?redirect_url=...`로
리다이렉트한다(별도 코드 불필요).

### 2.2 페이지 (2차 방어 — belt & suspenders)

`app/[locale]/map/page.tsx`(서버 컴포넌트)에서 `getDbUser()`(자가 치유 DB 유저)
로 재확인하고 null이면 `redirect('/{locale}/sign-in')`. `/billing` 페이지가 쓰는
방식과 동일. **플랜 게이트(`checkFeature`)는 호출하지 않는다** — 전 플랜 무료.

### 2.3 API 라우트 인증

읽기 API(`/api/map/*` GET)는 각 핸들러에서 `getDbUser()`로 로그인 여부만 확인,
null이면 401. 플랜 확인 없음.

> **관여하지 않는 것:** `FEATURE_MIN_PLAN`(플랜 매트릭스)에 map 키를 추가하지
> 않는다. 전 플랜 무료이므로 기능 게이트가 아니라 순수 인증 게이트다.
> 지역 정책(`featureRegionPolicy`)도 기본은 적용하지 않는다(요구사항: 전
> 회원). 향후 특정 규제 지역 차단이 필요하면 옵션으로 추가 가능(§15 리스크).

---

## 3. 기능 요구사항 → 설계 매핑

| 요구사항 | 설계 |
|---|---|
| 세계지도, "내 주변" + 타국 탐색 | Leaflet 지도 + `navigator.geolocation`(내 주변) + 자유 팬/줌 |
| 실물 매장·ATM 표시 | BTCMap → `MapPlace`(DB 캐시) → viewport API → 클러스터 마커 |
| 온라인 서비스 표시 | 로컬 JSON(`src/config/crypto-map-online.ts`) → 별도 레이어/리스트 |
| 나라별 규제 뱃지 | `CountryRegulation`(우리 관리) → 상세 카드 뱃지 + 범례 + (저줌) 국가 오버레이 |
| 필터: 코인/카테고리/검색 | viewport API 쿼리 파라미터 + 클라이언트 상태 |
| 핀 클릭 상세 카드 | `PlaceCard`(이름·주소·받는 코인·길찾기 링크) |
| 성능: viewport 로딩 + 캐싱 | bbox 쿼리 + 최소 줌 게이팅 + 다층 캐시(§10) |
| 면책 상시 표시 | 기존 노란 테두리 disclaimer 패턴(`data-testid="map-disclaimer"`) |

---

## 4. 아키텍처 개요 (데이터 흐름)

```
[BTCMap API]  ──(cron/admin sync, resilientFetch)──▶  [MapPlace 테이블]
                                                            │ bbox+필터 질의
                                                            ▼
[온라인 서비스 JSON(config)] ─────┐                 GET /api/map/places
[CountryRegulation(DB/seed)] ──┐  │                        │
                               ▼  ▼                         ▼
                       GET /api/map/regulation      ◀── CryptoMap (client, Leaflet)
                       GET /api/map/online                 · viewport(moveend, debounce)
                                                           · 필터/검색 상태
                                                           · 클러스터 마커 + 상세 카드
                                                           · geolocation "내 주변"
```

핵심 설계 결정: **BTCMap 원본을 클라이언트가 직접 부르지 않는다.** 서버가 주기적
으로 동기화해 `MapPlace`에 저장하고, 클라이언트는 우리 API에 **viewport(bbox)**
만 질의한다. 이유: (1) BTCMap 전체 덤프가 크다(수 MB, 수만 개), (2) 복원력/캐싱을
우리가 통제, (3) bbox·필터·검색을 DB 인덱스로 빠르게 처리, (4) 외부 API 장애
시에도 마지막 동기화분으로 서비스 유지.

> **경량 대안(옵션 B):** DB 없이 서버 메모리(globalThis)에 전체 덤프를 캐시하고
> 라우트에서 bbox 필터. 기존 `resilientFetch`의 last-good 캐시 패턴과 동일. 구현이
> 가볍지만 재시작 시 콜드스타트·수평 확장 시 인스턴스별 중복 로딩 단점. **권장은
> DB 캐시(옵션 A)**, 프로토타입은 옵션 B로 시작 가능.

---

## 5. 데이터 소스 & 전략

### 5.1 BTCMap (매장 · ATM)
- 엔드포인트: `https://api.btcmap.org/v2/elements` (전체) 또는
  `?updated_since=<ISO>` (증분). 전체 덤프는 크므로 **초기 1회 전체 → 이후 증분**.
- 원소 구조(요약): `{ id, osm_json: { type:'node'|'way', lat, lon, bounds, tags },
  tags: { category, "icon:android" }, deleted_at }`.
- 추출 필드: 이름(`osm_json.tags.name`), 좌표(node=lat/lon, way=bounds 중심),
  카테고리(`osm_json.tags.amenity|shop` 또는 BTCMap `tags.category`), 받는 코인
  (`payment:bitcoin`, `payment:lightning`, `payment:onchain`,
  `payment:lightning_contactless`, `currency:XBT`), 주소(`addr:*`), 검증일.
- ATM 판별: `osm_json.tags.amenity === 'atm'` + `currency:XBT`.
- `deleted_at != null`은 제외/삭제 처리.

### 5.2 온라인 서비스 (로컬 JSON)
- `src/config/crypto-map-online.ts` — 우리가 관리하는 정적 목록(거래소·결제
  게이트웨이·기프트카드 등). 위치가 없으므로 지도 핀이 아니라 **별도 사이드
  리스트/레이어**로 표시(또는 본사 국가에 대표 핀). 코인·카테고리 필터 공유.

### 5.3 규제 상태 (우리 관리 데이터)
- 주요국(초기 ~30개국) 대상. `CountryRegulation`.
- 상태 enum: `FRIENDLY` / `REGULATED` / `RESTRICTED` / `HOSTILE` / `UNCLEAR`.
- 표시: (a) 상세 카드에 해당 국가 뱃지, (b) 지도 범례, (c) **저줌(국가 단위)**
  에서 국가 색상 오버레이(선택). **법률 자문 아님** 명시(§11, docs/legal-review).

---

## 6. 데이터 모델 (Prisma)

`prisma/schema.prisma`에 추가. 마이그레이션은 기존 워크플로우(diff → deploy,
`prisma generate` 전 dev 서버 종료) 사용.

```prisma
enum MapPlaceSource {
  BTCMAP
  MANUAL          // 향후 수기 보정/추가용
}

enum RegulationStatus {
  FRIENDLY
  REGULATED
  RESTRICTED
  HOSTILE
  UNCLEAR
}

// BTCMap 동기화 캐시 — 클라이언트 viewport 질의의 원천.
model MapPlace {
  id          String         @id @default(cuid())
  source      MapPlaceSource @default(BTCMAP)
  externalId  String         // BTCMap element id (예: "node:12345")
  name        String?
  lat         Float
  lng         Float
  category    String?        // cafe/restaurant/atm/shop/hotel ...
  coins       String[]       // ["btc","lightning"]
  address     String?
  countryCode String?        // ISO-3166-1 alpha-2 (역지오코딩/BTCMap 태그)
  verifiedAt  DateTime?      // BTCMap survey:date 등
  raw         Json?          // 원본 태그 스냅샷(디버깅/확장)
  syncedAt    DateTime       @default(now())

  @@unique([source, externalId])
  @@index([lat, lng])        // bbox 범위 질의
  @@index([category])
  @@index([countryCode])
}

// 우리가 관리하는 국가별 규제 상태(주요국).
model CountryRegulation {
  countryCode String           @id  // ISO alpha-2
  status      RegulationStatus
  summaryKo   String
  summaryEn   String
  sourceNote  String?          // 출처/근거 메모(참고용)
  updatedBy   String?          // 관리자 이메일(admin 편집 시)
  updatedAt   DateTime         @updatedAt
}
```

설계 노트:
- **온라인 서비스는 DB에 넣지 않는다**(요구사항: 로컬 JSON). 정적 config로 관리.
- `MapPlace.coins`/`category`는 문자열 배열/문자열로 단순화(정규화 테이블 불요).
  필터가 소수 값에 대한 부분일치라 인덱스+애플리케이션 필터로 충분.
- 좌표 bbox 질의는 `lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?` + `@@index([lat,
  lng])`. PostGIS는 도입하지 않는다(현 요구 규모에 과함; 리스크 §15에 기재).
- `CountryRegulation`은 seed(config) → DB. 관리자 콘솔(19단계 `/admin`)에서 편집
  가능하게 확장(선택). 초기엔 seed만으로 충분.
- (선택) `MapSavedPlace`(회원 즐겨찾기) — 기존 `SavedArticle`/`SavedReport`
  패턴과 동일하게 향후 추가 가능. 초기 범위 밖.

---

## 7. API 라우트 구조

모두 `app/api/map/*`. 읽기 라우트는 `getDbUser()` 인증 + `force-dynamic`. 외부
동기화는 `canTriggerPipeline`(cron 시크릿/ADMIN).

| 메서드·경로 | 인증 | 역할 |
|---|---|---|
| `GET /api/map/places` | 로그인 | viewport(bbox) 내 매장·ATM. 쿼리: `bbox=minLng,minLat,maxLng,maxLat`, `coins=`, `category=`, `q=`, `limit=` |
| `GET /api/map/online` | 로그인 | 온라인 서비스 목록(config). 코인/카테고리 필터 |
| `GET /api/map/regulation` | 로그인 | 국가별 규제 상태 배열(범례·뱃지·오버레이용) |
| `POST /api/map/sync` | cron/ADMIN | BTCMap → `MapPlace` 동기화(증분). `canTriggerPipeline` 보호 |

`GET /api/map/places` 응답(예):
```jsonc
{
  "places": [
    { "id":"...", "name":"Cafe X", "lat":37.5, "lng":127.0,
      "category":"cafe", "coins":["btc","lightning"],
      "address":"...", "countryCode":"KR", "verifiedAt":"2026-05-01" }
  ],
  "count": 128,
  "capped": false,        // limit 초과 시 true + "줌인" 유도(무음 절단 금지)
  "stale": false          // 마지막 sync가 오래됐으면 true
}
```

성능·안전:
- `bbox` 필수. 없거나 과대(전세계)면 400 또는 저줌 안내(핀 미로딩).
- `limit` 기본 500, 초과 시 `capped:true`로 명시(무음 절단 금지 — 기존 리포트
  파이프라인 원칙과 동일).
- 응답에 `Cache-Control`(짧은 s-maxage) + 클라이언트 react-query `staleTime`.

`POST /api/map/sync`:
- `resilientFetch('btcmap-elements', [btcmapSource], { timeoutMs, freshMs, retries })`
  로 BTCMap 호출(last-good 폴백). 파싱 후 `MapPlace` upsert(`@@unique([source,
  externalId])`), `deleted_at` 원소는 삭제. 요약(추가/갱신/삭제 수) 반환.
- 스케줄: 시간당~일 1회. 기존 cron 트리거 패턴 재사용(`x-cron-secret`).

---

## 8. BTCMap 연동 방식

```
POST /api/map/sync
  └─ canTriggerPipeline(req)           // cron secret 또는 ADMIN
  └─ resilientFetch("btcmap-elements", [ btcmapSource ], {
        timeoutMs: 20_000, retries: 1, freshMs: 30*60_000 })
        └─ btcmapSource.fetch: GET api.btcmap.org/v2/elements(?updated_since=)
           assertUpstreamOk(res)       // 기존 헬퍼
           return elements[]
  └─ parseElement(e) → { externalId, name, lat, lng, category, coins[], address,
                         countryCode, verifiedAt, raw }   // §5.1 규칙
  └─ prisma.$transaction: upsert 배치 + deleted 정리
  └─ return { added, updated, removed, source, stale }
```

- **증분 동기화:** 마지막 성공 `syncedAt`을 커서로 `updated_since` 사용 → 전송량
  최소화. 초기 1회만 전체.
- **좌표(way):** BTCMap way(폴리곤)는 `osm_json.bounds` 중심 또는 제공 centroid
  사용(정확도 리스크 §15).
- **국가 코드:** BTCMap/OSM 태그에 있으면 사용, 없으면 (a) 규제 오버레이용
  경계 대조 또는 (b) 생략(뱃지는 있을 때만). 무거운 역지오코딩은 지양.
- **복원력:** BTCMap 장애 시 `resilientFetch` last-good로 이전 스냅샷 유지 →
  `stale:true`. 관리자 모니터(19단계)에 "map sync stale" 이상 징후 추가 가능(선택).

---

## 9. 컴포넌트 구조

Leaflet은 `window` 의존 → **클라이언트 전용**. Next 14에서 `next/dynamic`
`{ ssr: false }`로 로드. 지도 관련 코드는 `/map` 라우트에서만 번들 로딩(코드
분할).

```
app/[locale]/map/page.tsx           (서버: 인증·i18n·면책·<MapContainerClient/> 동적로드)
components/map/
  map-app.tsx            'use client'  최상위 상태(viewport/필터/선택 핀), react-query
  crypto-map.tsx         'use client'  react-leaflet <MapContainer> + TileLayer(OSM)
                                       + 클러스터 마커, moveend(debounce)→bbox 갱신
  map-filters.tsx        'use client'  코인/카테고리 셀렉트 + 검색 입력
  place-card.tsx         'use client'  선택 핀 상세(이름·주소·코인·길찾기)
  regulation-legend.tsx  'use client'  규제 상태 색상 범례 (+ 저줌 국가 오버레이)
  online-services.tsx    'use client'  온라인 서비스 사이드 리스트
  locate-me.tsx          'use client'  navigator.geolocation → "내 주변"으로 이동
```

라이브러리(신규 의존성):
- `leaflet`, `react-leaflet`(React 18 호환 v4), `@types/leaflet`
- 클러스터링: `react-leaflet-cluster`(또는 `leaflet.markercluster` + `supercluster`)
- CSS: `leaflet/dist/leaflet.css` import(전역 또는 컴포넌트).

동작:
- **viewport 로딩:** `moveend`에서 bbox 계산 → 400ms 디바운스 → react-query
  `['map-places', bbox, filters]` 질의. bbox가 캐시된 상위 영역에 포함되면 재사용.
- **내 주변:** `navigator.geolocation.getCurrentPosition` → `map.flyTo`. 거부/실패
  시 IP 국가 중심 또는 기본 뷰로 폴백(저장하지 않음, §11 프라이버시).
- **클러스터:** 저줌에서 마커 클러스터로 렌더(DOM 폭증 방지).
- **길찾기:** OSM(`https://www.openstreetmap.org/directions`) 또는 Google Maps
  (`https://www.google.com/maps/dir/?...`) 링크(외부 새 탭).
- **상태 표시:** `stale`/`capped` 시 상단 안내(무음 아님).

---

## 10. 성능 설계

다층 전략:
1. **viewport bbox 질의** — 화면 밖 데이터 미로딩.
2. **최소 줌 게이팅** — 저줌(예: zoom < 9, 국가 단위)에서는 핀 대신 규제 국가
   오버레이/집계만. 고줌에서 핀 로딩(전세계 핀 폭주 방지).
3. **클러스터링** — 마커 DOM 수 억제.
4. **캐싱**
   - 서버: `MapPlace`는 이미 동기화된 스냅샷(외부 호출 없이 DB 질의). sync만 외부.
   - HTTP: `/api/map/places`에 짧은 `s-maxage`.
   - 클라이언트: react-query `staleTime`(예: 5분) + bbox 상위영역 재사용.
5. **응답 상한** — `limit` 초과 시 `capped:true` + "확대하세요" 안내.
6. **번들 분할** — Leaflet은 `/map`에서만 로드(dynamic import, route-level split).

---

## 11. 면책 & 컴플라이언스

- **상시 면책**(기존 노란 테두리 패턴, `data-testid="map-disclaimer"`):
  > "본 지도는 정보 제공 목적으로만 제공되며 거래를 중개하지 않습니다. 매장·ATM
  > 정보는 제3자(BTCMap/OpenStreetMap) 데이터로 정확성·최신성이 보장되지 않으며,
  > 국가별 규제 상태는 참고용이고 법률 자문이 아닙니다. 실제 방문·거래 및 규제
  > 준수 책임은 이용자에게 있습니다."
- **규제 뱃지 = 법률 자문 아님** 명시 → `docs/legal-review.md`에 신규 항목 등재
  (규제 데이터 정확성/책임, 출처 표기).
- **BTCMap/OSM 저작권·표기**: OSM 데이터 © OpenStreetMap contributors, BTCMap
  출처 표기 + 라이선스(ODbL) 준수. 타일 하단 attribution 필수.
- **프라이버시**: 유저 위치는 **클라이언트에서만** 사용, 서버 저장/전송 금지.
  개인정보처리방침(22단계 `legal.privacy`)에 "위치정보 미저장" 문구 반영.
- **전역 5줄 고지**는 기존 푸터로 이미 상시 노출(22단계).

---

## 12. i18n / 내비게이션 / SEO

- **번역:** `messages/{ko,en}.json`에 `map.*` 네임스페이스(title/subtitle/
  disclaimer/필터 라벨/카테고리·코인·규제상태 라벨/빈결과/에러).
- **내비:** `src/config/nav.ts`에 `map` 키 추가(`NavKey` 유니온 + `navItems` +
  lucide 아이콘 `MapPin`/`Map`) → 헤더/사이드바/모바일/푸터 자동 반영. `messages`
  `nav.map` 추가.
- **SEO:** 로그인 전용 페이지이므로 `robots: { index: false }`(관리자 페이지와
  동일). 사이트맵은 `navItems` 자동 포함이지만 인증 페이지는 제외 검토(현 sitemap은
  navItems 전체를 넣으므로, map은 nav엔 넣되 sitemap에서 제외하는 예외 처리 필요 —
  §15 오픈 이슈).

---

## 13. 기존 코드베이스 연결점 (요약)

| 영역 | 재사용 대상 | 연결 방식 |
|---|---|---|
| 접근제어 | `middleware.ts` `isProtectedRoute` | map 경로 2줄 추가(리다이렉트 자동) |
| 인증 조회 | `getDbUser()` (`src/lib/user.ts`) | 페이지·API에서 로그인 확인(플랜 게이트 없음) |
| 외부 데이터 | `resilientFetch` + `assertUpstreamOk` (`src/lib/market/resilient.ts`) | BTCMap 동기화(last-good 폴백) |
| 트리거 인증 | `canTriggerPipeline` (`src/lib/news/trigger-auth.ts`) | `/api/map/sync`(cron/ADMIN) |
| 설정 패턴 | `src/config/*.ts` | 온라인 서비스 JSON·규제 seed |
| 마이그레이션 | diff→deploy, generate 전 dev 종료 | `MapPlace`·`CountryRegulation` 추가 |
| 데이터 페칭 | `QueryProvider`(react-query 전역) | viewport 질의 캐싱 |
| 면책 UI | 노란 테두리 disclaimer 패턴 | `data-testid="map-disclaimer"` |
| 내비/i18n | `nav.ts` + `messages/*` | `map` 항목·번역 추가 |
| 관리자(선택) | 19단계 `/admin` + `OpsEvent` 모니터 | 규제 편집·"sync stale" 이상 징후 |
| 테스트 | `scripts/test-*.mjs`(Clerk Backend API JWT, `ok()`) | `scripts/test-map.mjs` |
| 보안 | 21단계 헤더/CSP | 현 CSP는 img/connect 미제한 → OSM 타일 OK(하드닝 시 허용목록 §15) |

---

## 14. 단계별 구현 순서

1. **스캐폴딩 & 접근제어**: 의존성 설치(leaflet 등), `middleware` map 경로 추가,
   `map/page.tsx`(인증·면책·빈 지도), `nav`/i18n. → 비로그인 리다이렉트 확인.
2. **데이터 모델**: `MapPlace`·`CountryRegulation` 스키마 + 마이그레이션,
   `crypto-map-online.ts`·규제 seed config.
3. **BTCMap 동기화**: `/api/map/sync` + parser + `resilientFetch` 소스 →
   `MapPlace` 적재.
4. **viewport API + 지도**: `/api/map/places`(bbox) + `crypto-map.tsx` 마커·
   클러스터 + moveend 로딩.
5. **필터·검색·상세 카드**: `map-filters` + `/api/map/places` 쿼리 파라미터 +
   `place-card`(길찾기).
6. **온라인 서비스 + 규제 레이어**: `/api/map/online`·`/api/map/regulation` +
   범례·뱃지·(저줌) 국가 오버레이 + "내 주변".
7. **성능·마감**: 최소 줌 게이팅, 상한/capped 안내, 캐시 헤더, i18n 마감, SEO
   noindex, 면책 검수.
8. **테스트 & 문서**: `scripts/test-map.mjs`(접근제어·viewport·필터·면책·sync),
   `docs/legal-review.md` 규제 데이터 항목, PROGRESS.md 갱신.

---

## 15. 예상 리스크 & 완화

| 리스크 | 영향 | 완화 |
|---|---|---|
| **OSM 공개 타일 사용정책** — 대량 트래픽 시 차단 | 지도 로딩 실패 | 프로덕션은 타일 제공자(MapTiler/Stadia/Carto 무료 티어)로 전환, attribution 유지. 초기 개발은 OSM 기본 |
| BTCMap 덤프 크기·동기화 비용 | sync 지연/부하 | 증분(`updated_since`), 서버 전용 sync, DB 캐시, resilientFetch last-good |
| Leaflet SSR 비호환 | 빌드/런타임 오류 | `dynamic(..., { ssr:false })`, 마커 아이콘 경로 보정 |
| 저줌 핀 폭주 | 성능 저하 | 최소 줌 게이팅 + 클러스터 + viewport 상한 |
| way(폴리곤) 좌표 정확도 | 핀 위치 오차 | bounds 중심/centroid, 필요 시 보정 |
| 규제 데이터 정확성·법적 책임 | 신뢰/법적 리스크 | "참고용·법률자문 아님" 면책, 출처 표기, legal-review 등재, 주기 갱신 |
| BTCMap/OSM 데이터 부정확 | 잘못된 매장 정보 | 면책 + 검증일 표시 + BTCMap 신고 링크 |
| 지오로케이션 거부/실패 | "내 주변" 불가 | IP 국가/기본 뷰 폴백, 위치 미저장 |
| CSP 하드닝(향후 script-src) | 타일/지오 차단 | 타일·BTCMap 호스트를 `img-src`/`connect-src` 허용목록에 추가 |
| PostGIS 미도입 | 복잡 공간질의 한계 | 현 요구는 bbox로 충분. 필요 시 PostGIS로 확장 |
| sitemap에 인증 페이지 노출 | 잘못된 색인 유도 | map은 nav엔 넣되 sitemap 생성에서 제외(예외 처리) |
| 신규 의존성 번들 크기 | 초기 로딩 | route-level 코드 분할(`/map`에서만 로드) |

---

## 16. 테스트 계획 (`scripts/test-map.mjs`)

기존 패턴(Clerk Backend API로 JWT 발급, `ok()` 카운터, prisma 직접 조작) 재사용.

- 접근제어: 비로그인 `/ko/map` → sign-in 게이트/리다이렉트, `/api/map/places`
  비로그인 → 401, 로그인 → 200.
- viewport: bbox 내 `MapPlace`(테스트 seed)만 반환, bbox 밖 제외, `limit` 초과 시
  `capped:true`.
- 필터: `coins`/`category`/`q` 조합 정확성.
- 규제/온라인: `/api/map/regulation`·`/api/map/online` 응답 구조.
- sync: 비인증 401, cron 시크릿으로 200 + `MapPlace` upsert(모의 BTCMap 응답 또는
  실제 소량 호출), `deleted` 정리.
- 면책: 페이지에 `data-testid="map-disclaimer"` 렌더.

> Leaflet 지도 자체의 시각 렌더는 이 환경의 프리뷰 브라우저 제약으로 자동
> 스크린샷 검증 불가(4단계부터 알려진 이슈) → SSR HTML/`data-testid`·API 레벨
> 검증으로 대체, 실제 지도 조작은 사용자가 localhost에서 확인.

---

## 17. 결정 필요 사항 (오픈 이슈)

1. **타일 제공자**: 개발 OSM 기본 → 프로덕션 제공자 선택(비용/키). 필요?
2. **규제 데이터 관리 위치**: config seed만 vs `/admin` 편집 UI까지.
3. **저줌 국가 오버레이**: 국가 경계 GeoJSON 도입 여부(번들·복잡도) vs 뱃지·범례만.
4. **온라인 서비스 표현**: 지도 핀(대표 국가) vs 사이드 리스트만.
5. **DB 캐시(옵션 A) vs 메모리 캐시(옵션 B)**: 초기 구현 범위.
6. **즐겨찾기(`MapSavedPlace`)**: 초기 포함 여부(기본 제외 권장).
