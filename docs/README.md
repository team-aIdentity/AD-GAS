# AD Wallet SDK — 문서 안내

이 폴더에는 **통합 플랫폼**(형태1 + 형태2 + 무료 스왑풀) 기획·개발·사업 모델을 담은 문서 3개가 있습니다.

---

## 문서 구성

| 문서 | 읽는 순서 | 내용 |
|------|-----------|------|
| **[통합_기획서.md](./통합_기획서.md)** | 1 | 제품 개요, 사용자 플로우(즉시 무료/포인트/스왑), 스왑풀 설계, 컨트랙트 스펙, KPI, 리스크, 로드맵 |
| **[통합_개발_기획서.md](./통합_개발_기획서.md)** | 2 | 아키텍처, 기존/신규 컨트랙트 스펙, SDK·프론트 확장, 배포·테스트, Phase 1~3 체크리스트 |
| **[BUSINESS_MODEL.md](./BUSINESS_MODEL.md)** | 3 | 형태1·형태2 사업 구조, 통합 수익·비용, 타깃 고객, 기술·제품 매핑, 진행 제안 |

### 영문 버전 (English)

| Document | Content |
|----------|---------|
| [integration_plan.md](./integration_plan.md) | Product overview, user flows, swap pool design, tech spec, KPIs, risks, roadmap |
| [integration_dev_plan.md](./integration_dev_plan.md) | Architecture, contract/SDK/frontend spec, deploy & test, Phase 1–3 checklist |
| [business_model.md](./business_model.md) | Type 1 & 2 business structure, integrated revenue/cost, target customers, rollout |

---

## 읽는 순서 제안

- **제품/기획**을 이해하려면: **통합_기획서** → BUSINESS_MODEL  
- **개발/구현**을 진행하려면: **통합_기획서** → **통합_개발_기획서** → (필요 시) BUSINESS_MODEL  
- **사업/수익 구조**만 보려면: **BUSINESS_MODEL**

---

## 용어 요약

| 용어 | 설명 |
|------|------|
| **통합** | 형태1 + 형태2 + 무료 스왑풀 + 지갑/앱 개발사용 컨트랙트 연동 |
| **Paymaster** | EIP-4337 가스비 대납 컨트랙트 (AdSponsorPaymaster) |
| **AdWalletPoints** | 포인트 적립/차감/가스 결제용 컨트랙트 (형태2·지갑 연동) |
| **AdWalletSwapPool** | 자체 LP 스왑풀, 가스 대납 연동 (통합 신규) |
