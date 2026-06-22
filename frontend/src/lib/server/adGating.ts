import 'server-only';
import { Redis } from '@upstash/redis';

/**
 * 광고 시청 검증(게이팅) 레이어.
 *
 * 동작:
 * 1. 클라이언트가 전송 직전 챌린지를 생성한다(/api/ad-challenge).
 * 2. 앱(AdMob): 광고 시청 후 Google SSV 콜백(/api/admob-ssv)이 챌린지를 verified로 표시.
 *    웹(best-effort): Turnstile 검증을 통과하면 챌린지를 즉시 verified로 표시.
 * 3. 릴레이(/api/relay/transfer)는 verified·미사용·파라미터 일치 챌린지만 대납하고 consume.
 *
 * 서버리스(Vercel)에서는 인스턴스 메모리가 공유되지 않으므로 영속 저장소(Upstash Redis)가 필수.
 * `AD_GATING_ENABLED !== 'true'`이면 게이팅을 적용하지 않는다(설정 완료 전 안전 머지용).
 */

export type ChallengePlatform = 'app' | 'web';

export interface Challenge {
  from: string;
  to: string;
  amount: string;
  tokenSymbol: string;
  chainId: number;
  platform: ChallengePlatform;
  status: 'pending' | 'verified' | 'consumed';
  createdAt: number;
}

const CHALLENGE_TTL_SECONDS = 600; // 10분
const DAILY_LIMIT = 10;

export function isAdGatingEnabled(): boolean {
  return process.env.AD_GATING_ENABLED === 'true';
}

let _redis: Redis | null = null;

/** Upstash Redis 클라이언트. 환경변수가 없으면 null을 반환(게이팅 활성 시 fail-closed). */
export function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

function challengeKey(id: string): string {
  return `adchal:${id}`;
}

function dailyKey(address: string): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return `adgas:daily:${address.toLowerCase()}:${today}`;
}

/** 챌린지 생성. 반환된 id를 AdMob customData / 릴레이 호출에 사용한다. */
export async function createChallenge(
  redis: Redis,
  params: Omit<Challenge, 'status' | 'createdAt'>
): Promise<string> {
  const id = crypto.randomUUID();
  const challenge: Challenge = {
    ...params,
    status: 'pending',
    createdAt: Date.now(),
  };
  await redis.set(challengeKey(id), challenge, { ex: CHALLENGE_TTL_SECONDS });
  return id;
}

export async function getChallenge(
  redis: Redis,
  id: string
): Promise<Challenge | null> {
  const raw = await redis.get<Challenge>(challengeKey(id));
  return raw ?? null;
}

/** SSV/Turnstile 검증 통과 시 호출. pending → verified. */
export async function markChallengeVerified(
  redis: Redis,
  id: string
): Promise<boolean> {
  const challenge = await getChallenge(redis, id);
  if (!challenge || challenge.status !== 'pending') return false;
  challenge.status = 'verified';
  await redis.set(challengeKey(id), challenge, { ex: CHALLENGE_TTL_SECONDS });
  return true;
}

/**
 * 릴레이 시 호출. 챌린지가 verified·미사용이고 전송 파라미터가 서명 내용과 일치하는지 확인 후 consume.
 * 일치/검증 실패 시 throw.
 */
export async function consumeChallengeForTransfer(
  redis: Redis,
  id: string,
  expected: {
    from: string;
    to: string;
    amount: string;
    tokenSymbol: string;
    chainId: number;
  }
): Promise<void> {
  const challenge = await getChallenge(redis, id);
  if (!challenge) {
    throw new Error('광고 시청 확인을 찾을 수 없습니다. 광고를 다시 시청해 주세요.');
  }
  if (challenge.status === 'consumed') {
    throw new Error('이미 사용된 광고 시청 확인입니다.');
  }
  if (challenge.status !== 'verified') {
    throw new Error('광고 시청이 아직 확인되지 않았습니다.');
  }
  // 챌린지가 서명된 전송과 동일한지(바인딩) 검증 — 다른 전송에 재사용 방지
  const mismatch =
    challenge.from.toLowerCase() !== expected.from.toLowerCase() ||
    challenge.to.toLowerCase() !== expected.to.toLowerCase() ||
    challenge.amount !== expected.amount ||
    challenge.tokenSymbol !== expected.tokenSymbol ||
    challenge.chainId !== expected.chainId;
  if (mismatch) {
    throw new Error('광고 시청 확인이 전송 내용과 일치하지 않습니다.');
  }
  // consume (멱등 방지를 위해 상태 갱신)
  challenge.status = 'consumed';
  await redis.set(challengeKey(id), challenge, { ex: CHALLENGE_TTL_SECONDS });
}

/** 1일 무료 대납 한도 검사 및 증가(원자적 INCR). 한도 초과 시 throw. */
export async function checkAndIncreaseDailyLimit(
  redis: Redis,
  from: string
): Promise<void> {
  const key = dailyKey(from);
  const count = await redis.incr(key);
  if (count === 1) {
    // 첫 사용 시 자정(UTC)까지 TTL 설정 — 넉넉히 25시간
    await redis.expire(key, 25 * 60 * 60);
  }
  if (count > DAILY_LIMIT) {
    throw new Error(`오늘 무료 전송 한도(${DAILY_LIMIT}회)를 모두 사용했습니다.`);
  }
}
