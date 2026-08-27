import { NextRequest, NextResponse } from 'next/server';

import {
  AdRewardSecurityError,
  assertPrivateTestApkToken,
  isAdRewardSecurityRequired,
  markGoogleTestAdChallengeVerified,
} from '@/lib/adRewardSecurity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-ADGAS-Test-Token',
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isAdRewardSecurityRequired()) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  try {
    assertPrivateTestApkToken(request.headers.get('x-adgas-test-token'));
    const body = (await request.json()) as { challengeId?: string };
    await markGoogleTestAdChallengeVerified(body.challengeId || '');
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof AdRewardSecurityError ? error.status : 400;
    return NextResponse.json(
      {
        ok: false,
        code:
          error instanceof AdRewardSecurityError
            ? error.code
            : 'TEST_AD_REWARD_COMPLETE_ERROR',
        error:
          error instanceof Error
            ? error.message
            : '테스트 광고 완료 처리에 실패했습니다.',
      },
      { status }
    );
  }
}
