import type { TokenCategory, Token } from '@/types/adgasfe';

export type { TokenCategory };

// 체인별 지원 토큰 정의.
// - category: 'stablecoin' | 'token' (UI에서 그룹 구분)
// - permit: EIP-2612 도메인(name/version). 지정 시 가스리스(Permit) 서명, 미지정 시 approve 폴백.
//   기본적으로 온체인 name()/version()을 우선 읽는다. version()이 앱/구현 버전이고
//   EIP-712 도메인 버전과 다른 토큰은 useOnchainVersion=false로 설정값을 고정한다.
// - authorization: EIP-3009 도메인(name/version). 토큰 자체의 온체인 authorization nonce로
//   최초 approve 없이 한 번의 서명만으로 transferWithAuthorization을 실행한다.
// - usdPrice: 스테이블코인만 1로 표기. 일반 토큰은 생략(USD 환산 표시 안 함).
export interface TokenDef {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  category: TokenCategory;
  usdPrice?: number;
  permit?: { name: string; version: string; useOnchainVersion?: boolean };
  authorization?: { name: string; version: string };
  /** 토큰 자체가 수신자 자격을 제한하는 경우 전송 전 검증 방식 */
  recipientVerification?: 'giwa-dojang';
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
      authorization: { name: 'USD Coin', version: '2' },
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
      authorization: { name: 'USD Coin', version: '2' },
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
  // GIWA Sepolia — GIWA 공식 문서에서 주소가 확인되는 ERC-20
  91342: [
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0x4200000000000000000000000000000000000006',
      decimals: 18,
      category: 'token',
    },
    {
      symbol: 'TEST',
      name: 'Dojang VerifiedToken',
      address: '0xBCdB22f56642DE57624CfC2fBb9eE398cF3CA268',
      decimals: 18,
      category: 'token',
      // TestTokenV2는 일반 transfer/transferFrom 모두 Dojang 검증 수신자만 허용한다.
      recipientVerification: 'giwa-dojang',
    },
    {
      symbol: 'FAUCET',
      name: 'FaucetToken',
      address: '0xB11E5c9070a57C0c33Df102436C440a2c73a4c38',
      decimals: 18,
      category: 'token',
      // 온체인 version()은 1.4.0-beta.5지만 DOMAIN_SEPARATOR는 version="1"을 사용한다.
      permit: { name: 'FaucetToken', version: '1', useOnchainVersion: false },
    },
  ],
};

// GIWA Sepolia: 공식 문서에 표준 스테이블 주소가 없어 USDC/USDT는 선택적 환경 변수로 설정
const giwaSepoliaUsdc = parseOptionalTokenAddr(process.env.NEXT_PUBLIC_GIWA_SEPOLIA_USDC);
const giwaSepoliaUsdt = parseOptionalTokenAddr(process.env.NEXT_PUBLIC_GIWA_SEPOLIA_USDT);
const giwaSepoliaUsdcAuthMode = process.env.NEXT_PUBLIC_GIWA_SEPOLIA_USDC_AUTH_MODE?.trim().toLowerCase();

function buildGiwaTokens(): TokenDef[] {
  const tokens: TokenDef[] = [];
  if (giwaSepoliaUsdc) {
    const permit = giwaSepoliaUsdcAuthMode === 'eip2612'
      ? { name: 'USD Coin', version: '2' }
      : undefined;
    const authorization = giwaSepoliaUsdcAuthMode === 'eip3009'
      ? { name: 'USD Coin', version: '2' }
      : undefined;
    tokens.push({
      symbol: 'USDC',
      name: 'USD Coin',
      address: giwaSepoliaUsdc,
      decimals: 6,
      category: 'stablecoin',
      usdPrice: 1,
      ...(permit ? { permit } : {}),
      ...(authorization ? { authorization } : {}),
    });
  }
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
  CHAIN_TOKENS[91342] = [...(CHAIN_TOKENS[91342] ?? []), ...giwaTokens];
}

export function getChainTokens(chainId: number | undefined): TokenDef[] {
  if (!chainId) return [];
  return CHAIN_TOKENS[chainId] ?? [];
}

/** TokenDef → UI Token (잔액은 기본 0, 멀티콜 결과로 갱신) */
export function tokenDefToUiToken(def: TokenDef, balance = 0): Token {
  return {
    symbol: def.symbol,
    name: def.name,
    balance,
    decimals: def.decimals,
    usdPrice: def.usdPrice,
    category: def.category,
    sponsorshipMode: def.authorization ? 'eip3009' : def.permit ? 'eip2612' : 'approval',
  };
}

export function getDefaultUiToken(chainId: number): Token | null {
  const def = getChainTokens(chainId)[0];
  return def ? tokenDefToUiToken(def) : null;
}

export function findChainToken(
  chainId: number | undefined,
  symbol: string
): TokenDef | undefined {
  return getChainTokens(chainId).find((t) => t.symbol === symbol);
}
