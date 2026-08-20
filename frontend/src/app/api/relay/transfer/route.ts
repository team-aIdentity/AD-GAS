import { NextRequest, NextResponse } from 'next/server';
import {
  http,
  createWalletClient,
  createPublicClient,
  parseUnits,
  getAddress,
  hexToSignature,
  recoverTypedDataAddress,
} from 'viem';
import { base, avalanche, bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { findChainToken } from '@/lib/tokens';
import { giwaSepolia } from '@/lib/chains/giwaSepolia';
import { isGiwaDojangRecipientVerified } from '@/lib/giwaDojang';
import {
  AdRewardSecurityError,
  assertVerifiedAdRewardChallenge,
  authorizeSponsoredTransfer,
  isAdRewardSecurityRequired,
} from '@/lib/adRewardSecurity';

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}

// 컨트랙트 ABI
const SPONSORED_TRANSFER_ABI = [
  {
    inputs: [{ name: 'addr', type: 'address' }],
    name: 'NotVerified',
    type: 'error',
  },
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
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'chainId', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
      { name: 'deadline', type: 'uint256' },
      { name: 'permitV', type: 'uint8' },
      { name: 'permitR', type: 'bytes32' },
      { name: 'permitS', type: 'bytes32' },
    ],
    name: 'executeSponsoredTransferWithPermit',
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

const EIP3009_ABI = [
  {
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    name: 'transferWithAuthorization',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const EIP3009_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

type SupportedChainId = 8453 | 43114 | 56 | 91342;

interface RelayBody {
  from: `0x${string}`;
  to: `0x${string}`;
  amount: string;
  tokenSymbol: string;
  chainId: SupportedChainId;
  signature?: string; // EIP-712 서명 (메타트랜잭션용)
  nonce?: string | number; // 사용자 nonce
  permitSignature?: string; // Permit 서명 (가스리스 approve)
  deadline?: number; // Permit 만료 시간 (unix timestamp)
  authorizationSignature?: string; // EIP-3009 TransferWithAuthorization 서명
  authorizationNonce?: `0x${string}`; // 토큰 컨트랙트가 소비하는 nonce
  validAfter?: number;
  validBefore?: number;
  adChallengeId?: string;
}

// 메모리 기반 1일 10회 제한 (from 주소 기준)
const dailyUsage = new Map<string, { date: string; count: number }>();
const DAILY_LIMIT = 10;

function getTodayKey(address: string) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${address.toLowerCase()}::${today}`;
}

function checkAndIncreaseDailyLimit(from: string) {
  const key = getTodayKey(from);
  const current = dailyUsage.get(key) || { date: new Date().toDateString(), count: 0 };
  if (current.count >= DAILY_LIMIT) {
    throw new Error(`오늘 무료 전송 한도(${DAILY_LIMIT}회)를 모두 사용했습니다.`);
  }
  dailyUsage.set(key, { ...current, count: current.count + 1 });
}

async function authorizeRelayGasSponsorship(input: {
  adChallengeId?: string;
  from: string;
  to: string;
  amountUnits: bigint;
  tokenSymbol: string;
  chainId: number;
}) {
  if (!isAdRewardSecurityRequired()) {
    // 로컬 개발·테스트 광고 모드에서만 사용하는 인스턴스 메모리 폴백.
    checkAndIncreaseDailyLimit(input.from);
    return;
  }
  await authorizeSponsoredTransfer(
    input.adChallengeId,
    {
      from: input.from,
      to: input.to,
      amountUnits: input.amountUnits.toString(),
      tokenSymbol: input.tokenSymbol,
      chainId: input.chainId,
    },
    input.from
  );
}

function contractEnvSuffix(chainId: SupportedChainId): string {
  switch (chainId) {
    case 8453:
      return 'BASE';
    case 43114:
      return 'AVALANCHE';
    case 56:
      return 'BNB';
    case 91342:
      return 'GIWA_SEPOLIA';
  }
}

function getChainConfig(chainId: SupportedChainId) {
  switch (chainId) {
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
    case 91342:
      return {
        chain: giwaSepolia,
        rpcUrl:
          process.env.NEXT_PUBLIC_RPC_GIWA_SEPOLIA ||
          giwaSepolia.rpcUrls.default.http[0],
      };
    default:
      throw new Error(`지원하지 않는 체인입니다: ${chainId}`);
  }
}

function getSponsorPrivateKey(chainId: SupportedChainId): `0x${string}` {
  let envKey: string | undefined;
  switch (chainId) {
    case 8453:
      envKey = process.env.ADWALLET_SPONSOR_PK_BASE;
      break;
    case 43114:
      envKey = process.env.ADWALLET_SPONSOR_PK_AVALANCHE;
      break;
    case 56:
      envKey = process.env.ADWALLET_SPONSOR_PK_BNB;
      break;
    case 91342:
      envKey = process.env.ADWALLET_SPONSOR_PK_GIWA_SEPOLIA;
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
    case 91342:
      envKey =
        process.env.ADWALLET_CONTRACT_ADDR_GIWA_SEPOLIA ||
        process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_GIWA_SEPOLIA;
      break;
  }
  if (!envKey) {
    throw new Error(
      `해당 체인(${chainId})의 컨트랙트 주소가 설정되어 있지 않습니다. .env.local에 NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_${contractEnvSuffix(chainId)}를 설정해주세요.`
    );
  }
  return getAddress(envKey) as `0x${string}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RelayBody;
    const {
      from,
      to,
      amount,
      tokenSymbol,
      chainId,
      signature,
      nonce,
      permitSignature,
      deadline,
      authorizationSignature,
      authorizationNonce,
      validAfter,
      validBefore,
      adChallengeId,
    } = body;

    if (!from || !to || !amount || !tokenSymbol || !chainId) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
    }
    try {
      getAddress(from);
      getAddress(to);
    } catch {
      return NextResponse.json(
        {
          code: 'INVALID_ADDRESS',
          error: '보내는 주소 또는 받는 주소가 올바른 20바이트 지갑 주소가 아닙니다.',
        },
        { status: 400 }
      );
    }

    const authorizationFields = [
      authorizationSignature,
      authorizationNonce,
      validAfter,
      validBefore,
    ];
    const hasAnyAuthorizationField = authorizationFields.some(value => value !== undefined);
    const useAuthorization = authorizationFields.every(value => value !== undefined);

    if (hasAnyAuthorizationField && !useAuthorization) {
      return NextResponse.json(
        { error: 'EIP-3009 모드: 서명, nonce, validAfter, validBefore가 모두 필요합니다.' },
        { status: 400 }
      );
    }

    if (useAuthorization && (signature || nonce !== undefined || permitSignature || deadline !== undefined)) {
      return NextResponse.json(
        { error: 'EIP-3009와 Permit/allowance 전송 모드를 동시에 사용할 수 없습니다.' },
        { status: 400 }
      );
    }

    // Permit/allowance 메타트랜잭션 모드: AD-GAS 서명과 컨트랙트 nonce 필수
    if (!useAuthorization && (!signature || nonce === undefined)) {
      return NextResponse.json(
        { error: '메타트랜잭션 모드: 서명(signature)과 nonce가 필요합니다.' },
        { status: 400 }
      );
    }

    // Permit 모드: permitSignature과 deadline 함께 필수
    if ((permitSignature && deadline === undefined) || (!permitSignature && deadline !== undefined)) {
      return NextResponse.json(
        { error: 'Permit 모드: permitSignature과 deadline이 함께 필요합니다.' },
        { status: 400 }
      );
    }

    // 체인별 지원 토큰 해석 (ERC20, 네이티브 토큰 제외)
    const tokenDef = findChainToken(chainId, tokenSymbol);
    if (!tokenDef) {
      throw new Error('해당 체인에서 지원하지 않는 토큰입니다.');
    }
    const tokenAddress = tokenDef.address;
    const amountUnits = parseUnits(amount, tokenDef.decimals);
    if (amountUnits <= BigInt(0)) {
      throw new Error('전송 수량은 0보다 커야 합니다.');
    }

    await assertVerifiedAdRewardChallenge(adChallengeId, {
      from,
      to,
      amountUnits: amountUnits.toString(),
      tokenSymbol: tokenDef.symbol,
      chainId,
    });

    const { chain, rpcUrl } = getChainConfig(chainId);
    const sponsorPk = getSponsorPrivateKey(chainId);
    const account = privateKeyToAccount(sponsorPk);
    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    // GIWA VerifiedToken(TEST)은 일반 ERC-20과 달리 검증된 수신자에게만
    // transfer/transferFrom을 허용한다. 프론트 검사를 우회한 API 호출도 차단한다.
    if (tokenDef.recipientVerification === 'giwa-dojang') {
      const recipientVerified = await isGiwaDojangRecipientVerified(
        publicClient,
        tokenAddress,
        getAddress(to)
      );
      if (!recipientVerified) {
        return NextResponse.json(
          {
            code: 'GIWA_RECIPIENT_NOT_VERIFIED',
            error:
              'GIWA TEST 토큰은 Dojang 검증을 받은 주소로만 전송할 수 있습니다. 받는 지갑에서 GIWA Playground의 Issue Dojang을 먼저 완료해 주세요.',
          },
          { status: 400 }
        );
      }
    }

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });

    let txHash: `0x${string}`;

    if (useAuthorization) {
      const authorization = tokenDef.authorization;
      if (!authorization) {
        throw new Error(`${tokenSymbol}은(는) EIP-3009 가스리스 전송 대상이 아닙니다.`);
      }
      if (!/^0x[0-9a-fA-F]{64}$/.test(authorizationNonce!)) {
        throw new Error('EIP-3009 authorizationNonce는 32바이트 hex여야 합니다.');
      }

      const now = Math.floor(Date.now() / 1000);
      if (!Number.isSafeInteger(validAfter) || !Number.isSafeInteger(validBefore)) {
        throw new Error('EIP-3009 유효 시간이 올바르지 않습니다.');
      }
      if (validAfter! > now + 60 || validBefore! <= now) {
        throw new Error('EIP-3009 서명이 아직 유효하지 않거나 만료되었습니다.');
      }
      if (validBefore! - now > 30 * 60) {
        throw new Error('EIP-3009 서명 유효 시간은 최대 30분입니다.');
      }

      const authorizationMessage = {
        from,
        to,
        value: amountUnits,
        validAfter: BigInt(validAfter!),
        validBefore: BigInt(validBefore!),
        nonce: authorizationNonce!,
      } as const;
      const recovered = await recoverTypedDataAddress({
        domain: {
          name: authorization.name,
          version: authorization.version,
          chainId,
          verifyingContract: tokenAddress,
        },
        types: EIP3009_TYPES,
        primaryType: 'TransferWithAuthorization',
        message: authorizationMessage,
        signature: authorizationSignature as `0x${string}`,
      });
      if (getAddress(recovered) !== getAddress(from)) {
        throw new Error('EIP-3009 서명자가 보내는 지갑과 일치하지 않습니다.');
      }

      const authorizationSig = hexToSignature(authorizationSignature as `0x${string}`);
      const authorizationV =
        typeof authorizationSig.v === 'bigint'
          ? Number(authorizationSig.v)
          : (authorizationSig.v ?? 27);
      const { request } = await publicClient.simulateContract({
        account,
        address: tokenAddress,
        abi: EIP3009_ABI,
        functionName: 'transferWithAuthorization',
        args: [
          from,
          to,
          amountUnits,
          BigInt(validAfter!),
          BigInt(validBefore!),
          authorizationNonce!,
          authorizationV,
          authorizationSig.r,
          authorizationSig.s,
        ],
      });
      await authorizeRelayGasSponsorship({
        adChallengeId,
        from,
        to,
        amountUnits,
        tokenSymbol: tokenDef.symbol,
        chainId,
      });
      txHash = await walletClient.writeContract(request);
      return NextResponse.json({ txHash });
    }

    const contractAddress = getContractAddress(chainId);

    // 사용자 nonce 확인 (서버에서도 검증)
    const currentNonce = await publicClient.readContract({
      address: contractAddress,
      abi: SPONSORED_TRANSFER_ABI,
      functionName: 'nonces',
      args: [from],
    });
    if (BigInt(nonce!) !== currentNonce) {
      return NextResponse.json(
        { error: `Invalid nonce. Expected ${currentNonce.toString()}, got ${nonce}` },
        { status: 400 }
      );
    }

    if (permitSignature && deadline !== undefined) {
      // Permit 모드: approve 없이 가스리스 전송
      const now = Math.floor(Date.now() / 1000);
      if (!Number.isSafeInteger(deadline) || deadline <= now || deadline - now > 30 * 60) {
        throw new Error('Permit 서명이 만료되었거나 유효 시간이 너무 깁니다.');
      }
      const sig = hexToSignature(permitSignature as `0x${string}`);
      const permitV = typeof sig.v === 'bigint' ? Number(sig.v) : (sig.v ?? 27);
      const { request } = await publicClient.simulateContract({
        account,
        address: contractAddress,
        abi: SPONSORED_TRANSFER_ABI,
        functionName: 'executeSponsoredTransferWithPermit',
        args: [
          from,
          to,
          amountUnits,
          tokenAddress,
          BigInt(chainId),
          BigInt(nonce!),
          signature as `0x${string}`,
          BigInt(deadline),
          permitV,
          sig.r,
          sig.s,
        ],
      });
      await authorizeRelayGasSponsorship({
        adChallengeId,
        from,
        to,
        amountUnits,
        tokenSymbol: tokenDef.symbol,
        chainId,
      });
      txHash = await walletClient.writeContract(request);
    } else {
      const { request } = await publicClient.simulateContract({
        account,
        address: contractAddress,
        abi: SPONSORED_TRANSFER_ABI,
        functionName: 'executeSponsoredTransfer',
        args: [
          from,
          to,
          amountUnits,
          tokenAddress,
          BigInt(chainId),
          BigInt(nonce!),
          signature as `0x${string}`,
        ],
      });
      await authorizeRelayGasSponsorship({
        adChallengeId,
        from,
        to,
        amountUnits,
        tokenSymbol: tokenDef.symbol,
        chainId,
      });
      txHash = await walletClient.writeContract(request);
    }

    return NextResponse.json({ txHash });
  } catch (error) {
    if (error instanceof AdRewardSecurityError) {
      return NextResponse.json(
        { code: error.code, error: error.message },
        { status: error.status }
      );
    }
    const message =
      error instanceof Error ? error.message : '스폰서 트랜잭션 처리 중 오류가 발생했습니다.';
    if (message.toLowerCase().includes('0xb12c8f91') || message.toLowerCase().includes('notverified')) {
      return NextResponse.json(
        {
          code: 'GIWA_RECIPIENT_NOT_VERIFIED',
          error:
            'GIWA TEST 토큰은 Dojang 검증을 받은 주소로만 전송할 수 있습니다. 받는 지갑에서 GIWA Playground의 Issue Dojang을 먼저 완료해 주세요.',
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
