import type { RegulationStatus } from '@prisma/client'

// Our managed, country-level regulation status for major countries. This is
// the SEED / source of truth; it is upserted into CountryRegulation and can
// be edited via admin later. INFORMATIONAL ONLY — not legal advice (see the
// map disclaimer and docs/legal-review.md).

export type RegulationSeed = {
  countryCode: string
  status: RegulationStatus
  summaryKo: string
  summaryEn: string
}

export const REGULATION_SEED: RegulationSeed[] = [
  { countryCode: 'KR', status: 'REGULATED', summaryKo: '가상자산이용자보호법 시행, 거래소 신고·실명계좌 요건.', summaryEn: 'Virtual Asset User Protection Act in force; exchange registration and real-name accounts.' },
  { countryCode: 'US', status: 'REGULATED', summaryKo: 'SEC·CFTC 관할이 나뉘며 주(州)별로 규정이 상이.', summaryEn: 'Split SEC/CFTC oversight; rules vary by state.' },
  { countryCode: 'JP', status: 'REGULATED', summaryKo: '자금결제법상 등록 거래소 체계.', summaryEn: 'Registered-exchange regime under the Payment Services Act.' },
  { countryCode: 'SG', status: 'REGULATED', summaryKo: 'MAS의 결제서비스법(PSA) 라이선스 체계.', summaryEn: 'MAS licensing under the Payment Services Act.' },
  { countryCode: 'GB', status: 'REGULATED', summaryKo: 'FCA 등록 및 마케팅 규정 적용.', summaryEn: 'FCA registration and financial-promotion rules apply.' },
  { countryCode: 'DE', status: 'REGULATED', summaryKo: 'EU MiCA 및 BaFin 감독.', summaryEn: 'EU MiCA framework under BaFin supervision.' },
  { countryCode: 'FR', status: 'REGULATED', summaryKo: 'EU MiCA 및 AMF의 PSAN 체계.', summaryEn: 'EU MiCA with the AMF PSAN registration.' },
  { countryCode: 'NL', status: 'REGULATED', summaryKo: 'EU MiCA 및 DNB 등록.', summaryEn: 'EU MiCA with DNB registration.' },
  { countryCode: 'PT', status: 'FRIENDLY', summaryKo: '개인 투자에 비교적 우호적, EU MiCA 적용.', summaryEn: 'Relatively favorable for individuals; EU MiCA applies.' },
  { countryCode: 'CH', status: 'FRIENDLY', summaryKo: '명확한 프레임워크(FINMA), “크립토 밸리”.', summaryEn: 'Clear FINMA framework; the "Crypto Valley".' },
  { countryCode: 'AE', status: 'FRIENDLY', summaryKo: 'VARA·ADGM 등 명확·친화적 규제.', summaryEn: 'Clear, favorable regimes (VARA, ADGM).' },
  { countryCode: 'SV', status: 'FRIENDLY', summaryKo: '비트코인 법정통화 도입(이후 일부 조정).', summaryEn: 'Adopted Bitcoin as legal tender (later partly adjusted).' },
  { countryCode: 'HK', status: 'REGULATED', summaryKo: 'SFC의 VASP 라이선스 체계.', summaryEn: 'SFC VASP licensing regime.' },
  { countryCode: 'CA', status: 'REGULATED', summaryKo: '증권 규제 및 거래소 등록 요건.', summaryEn: 'Securities regulation and exchange registration.' },
  { countryCode: 'AU', status: 'REGULATED', summaryKo: 'AUSTRAC 등록 및 규제 정비 진행.', summaryEn: 'AUSTRAC registration; framework evolving.' },
  { countryCode: 'BR', status: 'REGULATED', summaryKo: '가상자산 법제 및 중앙은행 감독.', summaryEn: 'Virtual-asset law with central-bank oversight.' },
  { countryCode: 'IN', status: 'RESTRICTED', summaryKo: '고율 과세·불확실성, 명확한 프레임워크 부재.', summaryEn: 'High taxation and uncertainty; no clear framework.' },
  { countryCode: 'TR', status: 'RESTRICTED', summaryKo: '가상자산 결제 사용 금지.', summaryEn: 'Ban on using crypto for payments.' },
  { countryCode: 'NG', status: 'RESTRICTED', summaryKo: '규제 강화 및 접근 제한 이력.', summaryEn: 'Tightened rules and access restrictions.' },
  { countryCode: 'RU', status: 'UNCLEAR', summaryKo: '결제 제한과 채굴 허용이 혼재, 정책 유동적.', summaryEn: 'Mixed payment limits and mining allowances; policy in flux.' },
  { countryCode: 'CN', status: 'HOSTILE', summaryKo: '거래·채굴 금지.', summaryEn: 'Trading and mining are banned.' },
  { countryCode: 'DZ', status: 'HOSTILE', summaryKo: '가상자산 보유·거래 금지.', summaryEn: 'Holding and trading crypto is prohibited.' },
]
