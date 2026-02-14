# 형태 1 Paymaster 컨트랙트

광고 시청 시 가스비 대납용 EIP-4337 Paymaster (`AdSponsorPaymaster`).

## 요구사항

- Node.js 18+
- 환경 변수 (배포 시): `PRIVATE_KEY`, `SEPOLIA_RPC_URL` 등

## 설치 및 컴파일

```bash
cd contracts
npm install
npm run compile
```

## 배포 (Sepolia)

```bash
export PRIVATE_KEY=0x...
npm run deploy:sepolia
```

## 정책 설정 (owner)

- `setMaxCostPerUserOp(uint256)`: 호출당 최대 가스비 (wei)
- `setDailyGasLimit(uint256)`: 일일 가스비 한도 (0 = 미적용)
- `setWhitelistEnabled(bool)`: true 시 화이트리스트만 대납
- `setWhitelist(address, bool)` / `setWhitelistBatch`: 허용 주소 설정
- `deposit()`: EntryPoint에 ETH 예치 (가스 대납용)
- `pause()` / `unpause()`: 비상 정지

EntryPoint v0.6 주소: `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`
