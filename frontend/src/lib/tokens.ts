// 체인별 USDC, USDT 컨트랙트 주소
export const TOKEN_ADDRESSES: Record<number, { USDC: `0x${string}`; USDT: `0x${string}` }> = {
  // Ethereum Mainnet
  1: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },
  // Base Mainnet
  8453: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  },
  // Base Sepolia (테스트넷)
  84532: {
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC (테스트넷)
    USDT: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia에는 USDT가 없을 수 있으므로 USDC 주소 사용 (실제 사용 시 확인 필요)
  },
  // Avalanche C-Chain
  43114: {
    USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  },
  // BNB Chain
  56: {
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
  },
};

// EIP-2612 Permit 지원 토큰 설정 (체인ID: { USDC?: { name, version }, USDT?: { name, version } })
// 미설정 시 approve 트랜잭션 사용 (사용자 가스비 부담)
export const PERMIT_TOKEN_CONFIG: Record<
  number,
  { USDC?: { name: string; version: string }; USDT?: { name: string; version: string } }
> = {
  1: {
    USDC: { name: 'USDC', version: '2' }, // Circle USDC Ethereum Mainnet
  },
  8453: {
    USDC: { name: 'USDC', version: '2' }, // Circle USDC Base Mainnet
  },
  56: {
    USDC: { name: 'USDC', version: '2' }, // Circle USDC BNB Chain
  },
  43114: {
    USDC: { name: 'USDC', version: '2' }, // Circle USDC Avalanche C-Chain
  },
  84532: {
    USDC: { name: 'USDC', version: '2' }, // Circle USDC Base Sepolia
  },
};

// 토큰 정보 (decimals, USD 가격 등)
export const TOKEN_INFO = {
  USDC: {
    name: 'USD Coin',
    decimals: 6,
    usdPrice: 1,
  },
  USDT: {
    name: 'Tether',
    decimals: 6,
    usdPrice: 1,
  },
};
