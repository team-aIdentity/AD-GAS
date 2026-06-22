import { NextRequest, NextResponse } from 'next/server';
import {
  getRedis,
  isAdGatingEnabled,
  createChallenge,
  markChallengeVerified,
  type ChallengePlatform,
} from '@/lib/server/adGating';
import { verifyTurnstileToken } from '@/lib/server/turnstile';

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

interface ChallengeBody {
  from: string;
  to: string;
  amount: string;
  tokenSymbol: string;
  chainId: number;
  platform: ChallengePlatform; // 'app' | 'web'
  turnstileToken?: string; // 웹 best-effort 봇 방지
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdGatingEnabled()) {
      return NextResponse.json(
        { error: 'Ad gating is not enabled.' },
        { status: 404 }
      );
    }

    const redis = getRedis();
    if (!redis) {
      return NextResponse.json(
        { error: '서버 저장소가 구성되지 않았습니다.' },
        { status: 503 }
      );
    }

    const body = (await req.json()) as ChallengeBody;
    const { from, to, amount, tokenSymbol, chainId, platform, turnstileToken } = body;

    if (
      !from ||
      !to ||
      !amount ||
      !tokenSymbol ||
      !chainId ||
      (platform !== 'app' && platform !== 'web')
    ) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
    }

    // 웹은 AdMob SSV가 없으므로 Turnstile로 봇 방지 후 즉시 verified 처리(best-effort).
    if (platform === 'web') {
      const ip =
        req.headers.get('cf-connecting-ip') ||
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        undefined;
      const ok = await verifyTurnstileToken(turnstileToken, ip);
      if (!ok) {
        return NextResponse.json({ error: '봇 방지 검증에 실패했습니다.' }, { status: 403 });
      }
    }

    const challengeId = await createChallenge(redis, {
      from,
      to,
      amount,
      tokenSymbol,
      chainId,
      platform,
    });

    // 웹은 위 Turnstile 통과로 바로 검증 완료 처리(앱은 SSV 콜백 대기).
    if (platform === 'web') {
      await markChallengeVerified(redis, challengeId);
    }

    return NextResponse.json({ challengeId });
  } catch (error) {
    const message = error instanceof Error ? error.message : '챌린지 생성 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
