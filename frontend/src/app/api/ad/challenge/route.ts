import { NextRequest, NextResponse } from 'next/server';
import { getAddress, parseUnits } from 'viem';

import {
  AdRewardSecurityError,
  assertPrivateTestApkToken,
  createAdRewardChallenge,
  getAdRewardChallengeStatus,
  isAdRewardSecurityRequired,
  isValidAdChallengeId,
  rateLimitAdRewardChallengeIssue,
} from '@/lib/adRewardSecurity';
import { findChainToken } from '@/lib/tokens';

export const runtime = 'nodejs';

type ChallengeBody = {
  from?: string;
  to?: string;
  amount?: string;
  tokenSymbol?: string;
  chainId?: number;
  testAd?: boolean;
};

function errorResponse(error: unknown): NextResponse {
  if (error instanceof AdRewardSecurityError) {
    return NextResponse.json(
      { code: error.code, error: error.message },
      { status: error.status }
    );
  }
  return NextResponse.json(
    {
      code: 'AD_REWARD_CHALLENGE_ERROR',
      error: error instanceof Error ? error.message : '광고 확인 요청 처리에 실패했습니다.',
    },
    { status: 400 }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-ADGAS-Test-Token',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChallengeBody;
    if (
      !body.from ||
      !body.to ||
      !body.amount ||
      !body.tokenSymbol ||
      !Number.isSafeInteger(body.chainId)
    ) {
      return NextResponse.json(
        { code: 'INVALID_AD_REWARD_INTENT', error: '광고 확인에 필요한 전송 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const from = getAddress(body.from);
    const to = getAddress(body.to);
    const tokenDef = findChainToken(body.chainId, body.tokenSymbol);
    if (!tokenDef) {
      return NextResponse.json(
        { code: 'UNSUPPORTED_TOKEN', error: '해당 체인에서 지원하지 않는 토큰입니다.' },
        { status: 400 }
      );
    }
    const amountUnits = parseUnits(body.amount, tokenDef.decimals);
    if (amountUnits <= BigInt(0)) {
      return NextResponse.json(
        { code: 'INVALID_AMOUNT', error: '전송 수량은 0보다 커야 합니다.' },
        { status: 400 }
      );
    }

    if (!isAdRewardSecurityRequired()) {
      return NextResponse.json({ required: false, challengeId: null });
    }

    const forwardedFor =
      request.headers.get('x-vercel-forwarded-for') ||
      request.headers.get('x-forwarded-for') ||
      'unknown';
    const clientIp = forwardedFor.split(',')[0]?.trim() || 'unknown';
    await rateLimitAdRewardChallengeIssue(clientIp);

    if (body.testAd) {
      assertPrivateTestApkToken(request.headers.get('x-adgas-test-token'));
    }

    const challenge = await createAdRewardChallenge(
      {
        from,
        to,
        chainId: body.chainId!,
        tokenSymbol: tokenDef.symbol,
        amountUnits: amountUnits.toString(),
      },
      {
        verificationSource: body.testAd ? 'google-test-ad' : 'admob-ssv',
      }
    );
    return NextResponse.json({ required: true, ...challenge });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!isAdRewardSecurityRequired()) {
      return NextResponse.json({ required: false, status: 'verified' });
    }
    const challengeId = request.nextUrl.searchParams.get('id');
    if (!challengeId) {
      return NextResponse.json({ required: true, status: null });
    }
    if (!isValidAdChallengeId(challengeId)) {
      return NextResponse.json(
        { code: 'AD_REWARD_CHALLENGE_INVALID', error: '광고 확인 요청 ID가 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    const status = await getAdRewardChallengeStatus(challengeId);
    return NextResponse.json({ required: true, status });
  } catch (error) {
    return errorResponse(error);
  }
}
