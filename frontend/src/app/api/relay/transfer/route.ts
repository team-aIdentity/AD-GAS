import { NextRequest, NextResponse } from 'next/server';
import {
  http,
  createWalletClient,
  createPublicClient,
  parseUnits,
  getAddress,
} from 'viem';
import { mainnet, base, avalanche, bsc, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { TOKEN_ADDRESSES, TOKEN_INFO } from '@/lib/tokens';

// 컨트랙트 ABI (executeSponsoredTransfer 함수만)
const SPONSORED_TRANSFER_ABI = [
  {
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'chainId', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    name: 'executeSponsoredTransfer',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'nonces',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

type SupportedChainId = 1 | 8453 | 43114 | 56 | 84532;
type SupportedTokenSymbol = 'USDC' | 'USDT';

interface RelayBody {
  from: `0x${string}`;
  to: `0x${string}`;
  amount: string;
  tokenSymbol: SupportedTokenSymbol;
  chainId: SupportedChainId;
  signature?: string; // EIP-712 서명 (메타트랜잭션용)
  nonce?: number; // 사용자 nonce
}

// 메모리 기반 1일 5회 제한 (from 주소 기준)
const dailyUsage = new Map<string, { date: string; count: number }>();
const DAILY_LIMIT = 5;

function getTodayKey(address: string) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${address.toLowerCase()}::${today}`;
}

function checkAndIncreaseDailyLimit(from: string) {
  const key = getTodayKey(from);
  const current = dailyUsage.get(key) || { date: new Date().toDateString(), count: 0 };
  if (current.count >= DAILY_LIMIT) {
    throw new Error('오늘 무료 전송 한도(5회)를 모두 사용했습니다.');
  }
  dailyUsage.set(key, { ...current, count: current.count + 1 });
}

function getChainConfig(chainId: SupportedChainId) {
  switch (chainId) {
    case 1:
      return {
        chain: mainnet,
        rpcUrl: process.env.NEXT_PUBLIC_RPC_MAINNET || mainnet.rpcUrls.default.http[0],
      };
    case 8453:
      return {
        chain: base,
        rpcUrl: process.env.NEXT_PUBLIC_RPC_BASE || base.rpcUrls.default.http[0],
      };
    case 43114:
      return {
        chain: avalanche,
        rpcUrl: process.env.NEXT_PUBLIC_RPC_AVALANCHE || avalanche.rpcUrls.default.http[0],
      };
    case 56:
      return { chain: bsc, rpcUrl: process.env.NEXT_PUBLIC_RPC_BNB || bsc.rpcUrls.default.http[0] };
    case 84532:
      return {
        chain: baseSepolia,
        rpcUrl: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || baseSepolia.rpcUrls.default.http[0],
      };
    default:
      throw new Error(`지원하지 않는 체인입니다: ${chainId}`);
  }
}

function getSponsorPrivateKey(chainId: SupportedChainId): `0x${string}` {
  let envKey: string | undefined;
  switch (chainId) {
    case 1:
      envKey = process.env.ADWALLET_SPONSOR_PK_ETH;
      break;
    case 8453:
      envKey = process.env.ADWALLET_SPONSOR_PK_BASE;
      break;
    case 43114:
      envKey = process.env.ADWALLET_SPONSOR_PK_AVALANCHE;
      break;
    case 56:
      envKey = process.env.ADWALLET_SPONSOR_PK_BNB;
      break;
    case 84532:
      envKey = process.env.ADWALLET_SPONSOR_PK_BASE_SEPOLIA;
      break;
  }
  if (!envKey) {
    throw new Error('해당 체인의 스폰서 지갑 Private Key가 설정되어 있지 않습니다.');
  }
  const trimmed = envKey.trim();

  // "0x" 빠진 경우 자동 보정
  const withPrefix = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;

  // 0x + 64자리 hex 인지 검증
  const regex = /^0x[0-9a-fA-F]{64}$/;
  if (!regex.test(withPrefix)) {
    throw new Error(
      '스폰서 Private Key 형식이 올바르지 않습니다. 0x + 64자리 hex 인지 확인해 주세요.'
    );
  }

  return withPrefix as `0x${string}`;
}

function getContractAddress(chainId: SupportedChainId): `0x${string}` {
  let envKey: string | undefined;
  switch (chainId) {
    case 1:
      envKey =
        process.env.ADWALLET_CONTRACT_ADDR_ETH ||
        process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_ETH;
      break;
    case 8453:
      envKey =
        process.env.ADWALLET_CONTRACT_ADDR_BASE ||
        process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_BASE;
      break;
    case 43114:
      envKey =
        process.env.ADWALLET_CONTRACT_ADDR_AVALANCHE ||
        process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_AVALANCHE;
      break;
    case 56:
      envKey =
        process.env.ADWALLET_CONTRACT_ADDR_BNB ||
        process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_BNB;
      break;
    case 84532:
      envKey =
        process.env.ADWALLET_CONTRACT_ADDR_BASE_SEPOLIA ||
        process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_BASE_SEPOLIA;
      break;
  }
  if (!envKey) {
    throw new Error(
      `해당 체인(${chainId})의 컨트랙트 주소가 설정되어 있지 않습니다. .env.local에 NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_${chainId === 43114 ? 'AVALANCHE' : chainId === 8453 ? 'BASE' : chainId === 56 ? 'BNB' : chainId === 84532 ? 'BASE_SEPOLIA' : 'ETH'}를 설정해주세요.`
    );
  }
  return getAddress(envKey);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RelayBody;
    const { from, to, amount, tokenSymbol, chainId, signature, nonce } = body;

    if (!from || !to || !amount || !tokenSymbol || !chainId) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
    }

    // 메타트랜잭션 모드: 서명과 nonce 필수
    if (!signature || nonce === undefined) {
      return NextResponse.json(
        { error: '메타트랜잭션 모드: 서명(signature)과 nonce가 필요합니다.' },
        { status: 400 }
      );
    }

    checkAndIncreaseDailyLimit(from);

    const { chain, rpcUrl } = getChainConfig(chainId);
    const sponsorPk = getSponsorPrivateKey(chainId);
    const account = privateKeyToAccount(sponsorPk);
    const contractAddress = getContractAddress(chainId);

    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    // 사용자 nonce 확인 (서버에서도 검증)
    const currentNonce = await publicClient.readContract({
      address: contractAddress,
      abi: SPONSORED_TRANSFER_ABI,
      functionName: 'nonces',
      args: [from],
    });
    if (BigInt(nonce) !== currentNonce) {
      return NextResponse.json(
        { error: `Invalid nonce. Expected ${currentNonce.toString()}, got ${nonce}` },
        { status: 400 }
      );
    }

    // ERC20만 지원 (USDC, USDT) - 네이티브 토큰 제외
    if (tokenSymbol !== 'USDC' && tokenSymbol !== 'USDT') {
      throw new Error('지원하지 않는 토큰입니다. USDC 또는 USDT만 가능합니다.');
    }
    const tokenAddresses = TOKEN_ADDRESSES[chainId];
    if (!tokenAddresses) {
      throw new Error('해당 체인에서 지원하지 않는 토큰입니다.');
    }
    const tokenAddress = tokenSymbol === 'USDC' ? tokenAddresses.USDC : tokenAddresses.USDT;
    const tokenInfo = TOKEN_INFO[tokenSymbol];
    const amountUnits = parseUnits(amount, tokenInfo.decimals);

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });

    // 컨트랙트 호출: executeSponsoredTransfer
    const txHash = await walletClient.writeContract({
      address: contractAddress,
      abi: SPONSORED_TRANSFER_ABI,
      functionName: 'executeSponsoredTransfer',
      args: [
        from,
        to,
        amountUnits,
        tokenAddress,
        BigInt(chainId),
        BigInt(nonce),
        signature as `0x${string}`,
      ],
    });

    return NextResponse.json({ txHash });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '스폰서 트랜잭션 처리 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
