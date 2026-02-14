# AdWalletSponsoredTransfer 컨트랙트 배포 가이드

## 사전 준비

1. `.env` 파일 생성 (contracts 폴더에)
```env
# 배포자 지갑 Private Key (0x 제외 가능)
PRIVATE_KEY=your_private_key_here

# 네트워크별 RPC URL (선택사항, 기본값 사용 가능)
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
BASE_RPC_URL=https://mainnet.base.org
BSC_RPC_URL=https://bsc-dataseed.binance.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

2. 의존성 설치
```bash
cd contracts
npm install
```

## 배포

### Avalanche 메인넷
```bash
npm run deploy:sponsored-transfer:avalanche
```

### Base 메인넷
```bash
npm run deploy:sponsored-transfer:base
```

### BNB Chain
```bash
npm run deploy:sponsored-transfer:bsc
```

### Base Sepolia (테스트넷)
```bash
npm run deploy:sponsored-transfer:base-sepolia
```

## 배포 후 설정

배포가 완료되면 출력된 컨트랙트 주소를 `frontend/.env.local`에 추가하세요:

```env
# Avalanche
NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_AVALANCHE=0x...

# Base
NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_BASE=0x...

# BNB Chain
NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_BNB=0x...

# Base Sepolia
NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_BASE_SEPOLIA=0x...
```

## 중요 사항

- 배포자 지갑에 충분한 가스비가 있어야 합니다.
- 배포 후 컨트랙트 주소를 안전하게 보관하세요.
- 메인넷 배포 전 테스트넷에서 충분히 테스트하세요.
