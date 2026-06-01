import type { TokenCategory } from '@/types/adgasfe';

export type { TokenCategory };

// 체인별 지원 토큰 정의.
// - category: 'stablecoin' | 'token' (UI에서 그룹 구분)
// - permit: EIP-2612 도메인(name/version). 지정 시 가스리스(Permit) 서명, 미지정 시 approve 폴백.
//   서명 시 GaslessApp이 온체인 name()/version()을 우선 읽고, 실패하면 이 값을 폴백으로 사용.
// - usdPrice: 스테이블코인만 1로 표기. 일반 토큰은 생략(USD 환산 표시 안 함).
export interface TokenDef {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  category: TokenCategory;
  usdPrice?: number;
  permit?: { name: string; version: string };
}

function parseOptionalTokenAddr(raw: string | undefined): `0x${string}` | undefined {
  if (!raw?.trim()) return undefined;
  const t = raw.trim();
  const addr = (t.startsWith('0x') ? t : `0x${t}`) as `0x${string}`;
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return undefined;
  return addr;
}

const STATIC_CHAIN_TOKENS: Record<number, TokenDef[]> = {
  // Base Mainnet
  8453: [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      decimals: 6,
      category: 'stablecoin',
      usdPrice: 1,
      permit: { name: 'USD Coin', version: '2' },
    },
    {
      symbol: 'USDT',
      name: 'Tether',
      address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      decimals: 6,
      category: 'stablecoin',
      usdPrice: 1,
    },
    {
      symbol: 'AERO',
      name: 'Aerodrome',
      address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
      decimals: 18,
      category: 'token',
      permit: { name: 'Aerodrome', version: '1' },
    },
    {
      symbol: 'SBMB',
      name: 'SBMB',
      address: '0xc90990Db321F5806587bF496a3652c19aB223b94',
      decimals: 18,
      category: 'token',
      permit: { name: 'SBMB', version: '1' },
    },
    {
      symbol: 'LDT',
      name: 'Lucem Diffundo Token',
      address: '0x504B262539d3A4194d0649f69Fe3cCA06D5bB24a',
      decimals: 18,
      category: 'token',
      permit: { name: 'Lucem Diffundo Token', version: '1' },
    },
  ],
  // Avalanche C-Chain
  43114: [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
      decimals: 6,
      category: 'stablecoin',
      usdPrice: 1,
      permit: { name: 'USD Coin', version: '2' },
    },
    {
      symbol: 'USDT',
      name: 'Tether',
      address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
      decimals: 6,
      category: 'stablecoin',
      usdPrice: 1,
    },
  ],
  // BNB Chain (USDC/USDT는 18 decimals)
  56: [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      decimals: 18,
      category: 'stablecoin',
      usdPrice: 1,
      permit: { name: 'USD Coin', version: '2' },
    },
    {
      symbol: 'USDT',
      name: 'Tether',
      address: '0x55d398326f99059fF775485246999027B3197955',
      decimals: 18,
      category: 'stablecoin',
      usdPrice: 1,
    },
  ],
};

// GIWA Sepolia: 공식 문서에 표준 스테이블 주소가 없어 USDC/USDT는 선택적 환경 변수로 설정
const giwaSepoliaUsdc = parseOptionalTokenAddr(process.env.NEXT_PUBLIC_GIWA_SEPOLIA_USDC);
const giwaSepoliaUsdt = parseOptionalTokenAddr(process.env.NEXT_PUBLIC_GIWA_SEPOLIA_USDT);

function buildGiwaTokens(): TokenDef[] {
  if (!giwaSepoliaUsdc) return [];
  const tokens: TokenDef[] = [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: giwaSepoliaUsdc,
      decimals: 6,
      category: 'stablecoin',
      usdPrice: 1,
      permit: { name: 'USD Coin', version: '2' },
    },
  ];
  if (giwaSepoliaUsdt) {
    tokens.push({
      symbol: 'USDT',
      name: 'Tether',
      address: giwaSepoliaUsdt,
      decimals: 6,
      category: 'stablecoin',
      usdPrice: 1,
    });
  }
  return tokens;
}

export const CHAIN_TOKENS: Record<number, TokenDef[]> = { ...STATIC_CHAIN_TOKENS };

const giwaTokens = buildGiwaTokens();
if (giwaTokens.length > 0) {
  CHAIN_TOKENS[91342] = giwaTokens;
}

export function getChainTokens(chainId: number | undefined): TokenDef[] {
  if (!chainId) return [];
  return CHAIN_TOKENS[chainId] ?? [];
}

export function findChainToken(
  chainId: number | undefined,
  symbol: string
): TokenDef | undefined {
  return getChainTokens(chainId).find((t) => t.symbol === symbol);
}
