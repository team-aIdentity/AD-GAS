import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmobSsv } from '@/lib/server/admobSsv';
import { getRedis, isAdGatingEnabled, markChallengeVerified } from '@/lib/server/adGating';

/**
 * AdMob 리워드 광고 SSV 콜백 (Google → 서버).
 * AdMob 콘솔의 리워드 광고 단위 > SSV 콜백 URL에 다음을 등록:
 *   https://<배포도메인>/api/admob-ssv
 *
 * 클라이언트는 prepareRewardVideoAd({ ssv: { customData: <challengeId>, userId: <from> } })
 * 로 challengeId를 custom_data에 실어 보낸다. 서명 검증 후 해당 챌린지를 verified로 표시한다.
 */
export async function GET(req: NextRequest) {
  try {
    if (!isAdGatingEnabled()) {
      return new NextResponse('disabled', { status: 404 });
    }

    // 원본 쿼리 문자열(디코딩 전, 순서 보존)을 그대로 검증 대상으로 사용해야 한다.
    const url = new URL(req.url);
    const rawQuery = url.search.startsWith('?') ? url.search.slice(1) : url.search;

    const { customData } = await verifyAdmobSsv(rawQuery);
    if (!customData) {
      // 서명은 유효하나 challengeId가 없는 콜백 — 200으로 응답해 재시도 방지
      return new NextResponse('ok', { status: 200 });
    }

    const redis = getRedis();
    if (!redis) {
      return new NextResponse('storage unavailable', { status: 503 });
    }

    await markChallengeVerified(redis, customData);

    // Google에는 항상 2xx로 응답(재시도 폭주 방지). 검증 실패는 catch에서 처리.
    return new NextResponse('ok', { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SSV 검증 실패';
    console.error('[admob-ssv]', message);
    // 서명 검증 실패 시에는 200을 주지 않는다(위조 콜백 거부).
    return new NextResponse('invalid', { status: 403 });
  }
}
