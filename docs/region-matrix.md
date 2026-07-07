# 지역별 기능 매트릭스 (Region Feature Matrix)

> 22단계 산출물 — **출시 후보안(launch candidate)**. 최종 On/Off는 로펌 검토
> 후 확정한다. 런타임에서는 관리자 콘솔의 지역 스위치(FeatureSwitch)로 배포
> 없이 조정 가능(19단계). 코드 원본: `src/config/features.ts`
> (`featureRegionPolicy`).

## 원칙

- **정보·교육 콘텐츠(뉴스·브리핑·패턴·리포트·교육)는 전 지역 제공**을 기본으로
  한다. 비개인화 정보 제공 서비스라는 서비스 성격에 부합.
- **규제 민감 기능만 지역 화이트리스트**로 제한한다. 목록에 없는 기능은 모든
  국가에서 제공된다.
- `allowUnknown=true`: 국가를 판별할 수 없을 때(geo 헤더 없음) 허용. 로컬/직접
  접속 및 판별 실패 시 서비스 연속성 우선.
- 화이트리스트에 없는 국가(예: CN)는 해당 기능이 차단(reason=`region`)된다.

## 매트릭스 (기능 × 지역)

| 기능 | 성격 | 화이트리스트(후보) | allowUnknown | 제한 근거 |
|---|---|---|---|---|
| `onchain.advanced` | 온체인 심화(웨일·플로우·네트워크) | KR US JP SG GB DE FR NL CA AU HK TW | 예 | 온체인 데이터 제공사 약관 및 일부 관할의 데이터 취급 규제 검토 필요 |
| `api.center` | Legendary 공개 REST API·웹훅 | KR US JP SG GB DE FR NL CA AU | 예 | 데이터 재배포·국외 이전 및 API 상업적 이용에 대한 관할별 규제 검토 |
| `data.export` | 시장 데이터 CSV 내보내기 | KR US JP SG GB DE FR NL CA AU | 예 | 데이터 재배포 라이선스·국외 이전 검토 |
| `referral.rewards` | 금전 리퍼럴 커미션 | KR US JP SG GB DE FR NL CA AU | 예 | 유료 추천(finder's fee)·경품류 규제(관할별 상이). 링크·랭킹은 전 지역, 커미션만 제한 |

> 그 외 전 기능(`market.basic`, `news.*`, `brief.*`, `analysis.patterns`,
> `portfolio.tools`, `reports.premium`, `alerts.realtime`, `referral.program`
> 등)은 **지역 제한 없음** — 플랜 게이트만 적용.

## 지역별 법적 문구 연계 (로펌 검토 대상)

| 지역 | 문서 조항 | 핵심 문구 |
|---|---|---|
| 미국 | 면책조항 §US, 이용약관 §US | 투자자문업자 미등록(1940년 투자자문업법), SEC 미등록, 증권 매매 권유 아님 |
| EU | 면책조항 §EU, 개인정보 §EU | MiCA상 CASP 아님, GDPR 고지·권리 |
| 한국 | 면책조항 §KR, 이용약관 §KR, 개인정보 §KR | 자본시장법상 투자자문·투자일임 아님, 개별 상담 미제공, 개인정보보호법 |

## 확정 절차 (출시 전 · 사람이 수행)

1. 로펌이 4개 문서(약관·개인정보·면책·환불) + AI 콘텐츠 샘플(패턴/브리핑) +
   본 매트릭스를 일괄 검토.
2. 관할별로 각 규제 민감 기능의 제공 가능 여부(On/Off) 및 필수 문구를 확정.
3. 확정 결과를 `featureRegionPolicy`(또는 관리자 지역 스위치)에 반영하고, 이
   문서의 "후보" 표기를 "확정"으로 갱신.
4. `docs/legal-review.md` 체크리스트의 관련 항목을 종결.

> **주의:** 본 매트릭스와 법적 문서는 검토 준비가 된 초안이며, 실제 법률
> 자문·서명은 반영되지 않았다. 프로덕션 출시 전 유자격 변호사의 검토가
> 반드시 선행되어야 한다.
