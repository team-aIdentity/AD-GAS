# AD-GAS Transaction SDK — B2B v0 스펙

> **한 줄**: dApp/지갑이 npm으로 붙여 **“트랜잭션 직전 광고 게이트 → 검증 후 가스 대납(릴레이)”** 을 표준화하는 클라이언트 SDK + 백엔드 계약.

**공개 저장소(배포 원본)**: `https://github.com/team-aIdentity/AD-GAS-Transaction-SDK`  
(레포명은 `Transaction` 철자 권장 — 검색·문서 일관성)

**모노레포 내 스캐폴드**: `web/ad-gas-transaction-sdk/` — 위 GitHub와 동기화·복사하여 npm publish.

---

## 1. 제품 포지셔닝

| 구분 | 설명 |
|------|------|
| **판매 대상 (B2B)** | dApp 팀, 지갑/미니앱, 게임 스튜디오 |
| **가치 제안** | 사용자는 광고 시청(또는 완료 이벤트) 후 **가스 없이** 핵심 트랜잭션 실행 |
| **과금 모델 (예시)** | 월 구독 + 트랜잭션당/광고 완료당 과금, 또는 광고 수익 쉐어 |
| **기존 AD-GAS와의 관계** | 온체인(`AdWalletSponsoredTransfer`, `AdSponsorPaymaster` 등) + Relayer API는 **플랫폼 코어**; 본 SDK는 **B2B 통합 표면** |

기존 [`integration_plan.md`](./integration_plan.md), [`BUSINESS_MODEL.md`](./BUSINESS_MODEL.md)의 **Type 1(즉시 대납)** / **Type 2(포인트)** 흐름을 SDK 메서드로 노출하는 것이 v0~v1 방향이다.

---

## 2. 아키텍처 (논리)

```
┌─────────────────────────────────────────────────────────────┐
│  Partner dApp / Wallet (React, Next, Mini App, Unity Web…) │
└────────────────────────────┬────────────────────────────────┘
                             │ npm: ad-gas-transaction-sdk
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  AdGasTransactionClient                                     │
│  - 광고 UI는 파트너 또는 AD-GAS Web Component (후속)           │
│  - 완료 후 proof / session → Relayer                         │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS + API Key (B2B)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  AD-GAS Platform API                                         │
│  - 광고 검증 (SSP/자체 광고 네트워크 연동)                     │
│  - 할당량·남용 방지 (per appId, per user, per day)           │
│  - Relayer 서명 → 체인 `executeSponsoredTransfer` / 4337 번들  │
└────────────────────────────┬────────────────────────────────┘
                             ▼
                    스마트 컨트랙트 / EntryPoint / Paymaster
```

---

## 3. 기존 코드베이스 매핑

| 레이어 | 현재 위치 (AD-GAS 레포) | SDK v0에서의 역할 |
|--------|-------------------------|-------------------|
| Relayer 호출 (형태1 전송) | `web/src/core/AdWalletRelayerSDK.ts` | 동일 플로우를 **API Key·베이스 URL 설정 가능**한 `AdGasTransactionClient`로 일반화 |
| Relayer API | `web/frontend/src/app/api/relay/transfer/route.ts` | B2B 시 **파트너 전용 엔드포인트** 또는 동일 경로에 **API Key 검증** 추가 |
| 컨트랙트 | `web/contracts/contracts/AdWalletSponsoredTransfer.sol` 등 | 변경 없음; SDK는 서명·nonce 규격 문서화 |
| Paymaster (4337) | `AdSponsorPaymaster.sol` | v1 이후 `UserOperation` 빌더·번들러 연동 문서 |

---

## 4. 공개 API — v0 (TypeScript)

### 4.1 설정

```ts
interface AdGasClientConfig {
  /** B2B 발급 API 키 (Dashboard에서 생성) */
  apiKey: string;
  /** Relayer 베이스 URL, 예: https://relay.ad-gas.io */
  baseUrl: string;
  /** 선택: Base / 대시보드에 등록한 앱 ID */
  appId?: string;
}
```

### 4.2 클라이언트

```ts
class AdGasTransactionClient {
  constructor(config: AdGasClientConfig);

  /**
   * 광고 시청이 끝난 뒤, 플랫폼이 검증 가능한 payload와 함께 대납 전송 요청.
   * (v0: 기존 AdWalletRelayerSDK.sendSponsoredTransfer 와 동일 바디 + 인증 헤더)
   */
  sendSponsoredTransfer(req: SponsoredTransferRequest): Promise<SponsoredTransferResponse>;

  /**
   * 후속: 광고 세션 시작(토큰 발급), 잔여 무료 횟수 조회 등.
   * v0에서는 optional / no-op 또는 REST 직접 호출로 문서화.
   */
  // getQuota(): Promise<QuotaResponse>;
  // startAdSession(): Promise<AdSession>;
}
```

### 4.3 요청/응답 타입 (기존과 정렬)

`SponsoredTransferRequest` / `SponsoredTransferResponse` / `SupportedTokenSymbol` 는 `AdWalletRelayerSDK` 와 동일 필드를 유지한다.  
추가 필드는 **선택적(opt-in)** 으로만 넣는다 (예: `adProof`, `sessionId`).

### 4.4 HTTP 계약 (v0)

| 항목 | 값 |
|------|-----|
| Method | `POST` |
| Path | `{baseUrl}/relay/transfer` (또는 `/v1/relay/transfer`) |
| Header | `Authorization: Bearer <apiKey>` **또는** `X-AD-GAS-Key: <apiKey>` (서버 구현 시 하나로 고정) |
| Body | JSON — 기존 `SponsoredTransferRequest` |

**백엔드 TODO (플랫폼)**  
- API Key → `appId`·도메인 화이트리스트·일일 한도 매핑  
- 기존 `/api/relay/transfer` 와 병합 또는 `/v1/...` 분리

---

## 5. B2B 온보딩 (운영)

1. 대시보드에서 **앱 등록** → `appId`, **API Key** 발급  
2. **허용 도메인** (web) / **번들 ID** (mobile) 등록  
3. npm 설치: `npm install ad-gas-transaction-sdk`  
4. 스테이징에서 `baseUrl` 스테이징 Relayer로 연결 후 E2E  
5. 프로덕션 키 전환 + 모니터링 (성공률, 가스 비용, 광고 완료율)

---

## 6. 보안·컴플라이언스

- API Key는 **서버에서만** 쓰는 모드(권장) vs **브라우저 노출**(제한적 키 + 도메인 바인딩) 명확히 문서화  
- 사용자 서명(EIP-712)은 **항상 사용자 지갑**에서; Relayer는 검증된 서명만 실행  
- 레이트 리밋·이상 징후 시 키 회전 절차  
- 광고·개인정보: 지역별 규제에 맞는 동의 문구는 **파트너 + 플랫폼** 약관에 반영

---

## 7. 로드맵 (요약)

| 단계 | 내용 |
|------|------|
| **v0** | `AdGasTransactionClient` + 기존 sponsored transfer + API Key 헤더 계약 문서 |
| **v0.1** | Quota/세션 API, 에러 코드 표준화 |
| **v1** | 4337 UserOperation 빌더, Paymaster 연동 옵션 |
| **v1+** | React 훅 패키지(`@ad-gas/react`), 선택적 광고 Web Component |

---

## 8. 레포 동기화 워크플로

1. AD-GAS 모노레포에서 `web/ad-gas-transaction-sdk/` 개발  
2. 릴리스 시 `AD-GAS-Transaction-SDK` GitHub로 **mirror / copy** 후 태그  
3. `npm publish` 는 공개 레포 CI에서 실행 (권장)

---

*문서 버전: v0.1 — B2B Transaction SDK 초안 (AD-GAS 모노레포 내부)*
