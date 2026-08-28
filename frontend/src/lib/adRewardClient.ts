import { getRelayerApiBase } from './relayerApiBase';

type AdRewardIntent = {
  from: string;
  to: string;
  amount: string;
  tokenSymbol: string;
  chainId: number;
  testAd?: boolean;
};

type ChallengeResponse = {
  required: boolean;
  challengeId: string | null;
  expiresIn?: number;
  code?: string;
  error?: string;
};

function endpoint(path: string): string {
  return `${getRelayerApiBase()}${path}`;
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = (await response.json()) as { error?: string };
    return new Error(payload.error || fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function isAdRewardServerVerificationRequired(): Promise<boolean> {
  const response = await fetch(endpoint('/ad/challenge'), {
    method: 'GET',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw await responseError(response, '광고 검증 서버 상태를 확인하지 못했습니다.');
  }
  const payload = (await response.json()) as { required?: boolean };
  return payload.required === true;
}

export async function issueAdRewardChallenge(
  intent: AdRewardIntent
): Promise<ChallengeResponse> {
  const response = await fetch(endpoint('/ad/challenge'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(intent),
  });
  if (!response.ok) {
    throw await responseError(response, '광고 확인 요청을 생성하지 못했습니다.');
  }
  const payload = (await response.json()) as ChallengeResponse;
  if (payload.required && !/^[0-9a-f]{48}$/.test(payload.challengeId || '')) {
    throw new Error('광고 확인 서버가 올바른 challenge를 반환하지 않았습니다.');
  }
  return payload;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

export async function waitForAdRewardVerification(
  challengeId: string,
  maxWaitMs = 45_000
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < maxWaitMs) {
    const response = await fetch(
      endpoint(`/ad/challenge?id=${encodeURIComponent(challengeId)}`),
      { method: 'GET', cache: 'no-store' }
    );
    if (!response.ok) {
      throw await responseError(response, '광고 서버 검증 상태를 확인하지 못했습니다.');
    }
    const payload = (await response.json()) as {
      status?: 'pending' | 'verified' | 'missing';
    };
    if (payload.status === 'verified') return;
    if (payload.status === 'missing') {
      throw new Error('광고 확인 요청이 만료되었습니다. 다시 시도해주세요.');
    }
    await delay(1000);
  }
  throw new Error('광고 서버 확인이 지연되고 있습니다. 잠시 후 다시 시도해주세요.');
}

export async function completeGoogleTestAdReward(challengeId: string): Promise<void> {
  const response = await fetch(endpoint('/ad/test-complete'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ challengeId }),
  });
  if (!response.ok) {
    throw await responseError(response, '테스트 광고 완료를 서버에서 확인하지 못했습니다.');
  }
}
