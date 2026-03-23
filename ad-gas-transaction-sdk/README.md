# ad-gas-transaction-sdk

B2B용 **광고 게이트 이후 가스 대납(릴레이) 트랜잭션** 클라이언트.  
AD-GAS 플랫폼 파트너(dApp·지갑)가 npm으로 연동합니다.

## Canonical repo

배포·이슈·PR의 기준 저장소:

**https://github.com/team-aIdentity/AD-GAS-Transction-SDK**

> 레포 이름의 철자는 나중에 GitHub **Settings → General → Repository name** 에서 `AD-GAS-Transaction-SDK` 로 바꿀 수 있습니다. (npm·문서 검색에 유리)

이 폴더(`web/ad-gas-transaction-sdk/`)는 AD-GAS 모노레포에서 개발한 뒤 위 레포와 동기화할 수 있습니다.

## 문서

- [B2B v0 스펙 (한글)](../docs/AD-GAS-Transaction-SDK-B2B-v0.md)

## 설치

```bash
npm install ad-gas-transaction-sdk
```

## 사용 예시

```ts
import { AdGasTransactionClient } from "ad-gas-transaction-sdk";

const client = new AdGasTransactionClient({
  apiKey: process.env.AD_GAS_API_KEY!,
  baseUrl: "https://your-relay.ad-gas.io",
  appId: "optional-app-id",
});

const { txHash } = await client.sendSponsoredTransfer({
  from: "0x...",
  to: "0x...",
  amount: "0.01",
  tokenSymbol: "USDC",
  chainId: 8453,
  signature: "0x...",
  nonce: 0,
});
```

## 서버 요구사항 (v0)

- `POST /relay/transfer` 가 `Authorization: Bearer <apiKey>` 를 검증하고, 기존 AD-GAS Relayer 바디를 처리해야 합니다.  
- 아직 API Key 검증이 없다면 플랫폼 백엔드에 추가하는 작업이 필요합니다.

## 빌드

```bash
npm install
npm run build
```

`dist/` 가 생성되면 `npm publish` 로 배포할 수 있습니다.
