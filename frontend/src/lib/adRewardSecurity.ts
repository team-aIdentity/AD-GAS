import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

const CHALLENGE_PREFIX = 'adgas:ad-reward:';
const SSV_TRANSACTION_PREFIX = 'adgas:admob-tx:';
const DAILY_USAGE_PREFIX = 'adgas:daily-usage:';
const TEST_DAILY_USAGE_PREFIX = 'adgas:test-daily-usage:';
const CHALLENGE_ISSUE_LIMIT_PREFIX = 'adgas:challenge-issue-limit:';
const DEFAULT_CHALLENGE_TTL_SECONDS = 10 * 60;
const SSV_TRANSACTION_TTL_SECONDS = 7 * 24 * 60 * 60;
const DAILY_LIMIT = 10;
const TEST_DAILY_LIMIT = 10;
const TEST_AD_SUPPORTED_CHAIN_IDS = new Set([8453, 43114, 56, 91342]);

export type AdRewardIntent = {
  from: string;
  to: string;
  amountUnits: string;
  tokenSymbol: string;
  chainId: number;
};

type AdRewardRecord = {
  intentHash: string;
  status: 'pending' | 'verified';
  verificationSource?: 'admob-ssv' | 'google-test-ad';
  createdAt: number;
  expiresAt: number;
  verifiedAt?: number;
};

type RedisResponse<T> = {
  result?: T;
  error?: string;
};

export class AdRewardSecurityError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = 'AdRewardSecurityError';
  }
}

function securityMode(): 'required' | 'disabled' {
  const configured = process.env.AD_REWARD_SECURITY_MODE?.trim().toLowerCase();
  if (configured === 'disabled') return 'disabled';
  if (configured === 'required') return 'required';
  return process.env.NODE_ENV === 'production' ? 'required' : 'disabled';
}

export function isAdRewardSecurityRequired(): boolean {
  return securityMode() === 'required';
}

/** 앱 심사 전 공개 POC용. false로 설정하면 테스트 광고 가스 대납만 즉시 닫힌다. */
export function isPublicTestAdModeEnabled(): boolean {
  return process.env.AD_REWARD_PUBLIC_TEST_MODE?.trim().toLowerCase() !== 'false';
}

function redisConfig(): { url: string; token: string } {
  const url = (
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  )?.replace(/\/$/, '');
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new AdRewardSecurityError(
      'AD_REWARD_STORE_UNAVAILABLE',
      '광고 검증 저장소가 설정되지 않았습니다. Vercel KV 또는 Upstash Redis 환경 변수를 확인해주세요.',
      503
    );
  }
  return { url, token };
}

async function redisCommand<T>(command: Array<string | number>): Promise<T> {
  const { url, token } = redisConfig();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new AdRewardSecurityError(
      'AD_REWARD_STORE_UNAVAILABLE',
      `광고 검증 저장소 요청에 실패했습니다. (${response.status})`,
      503
    );
  }
  const payload = (await response.json()) as RedisResponse<T>;
  if (payload.error) {
    throw new AdRewardSecurityError(
      'AD_REWARD_STORE_UNAVAILABLE',
      `광고 검증 저장소 오류: ${payload.error}`,
      503
    );
  }
  return payload.result as T;
}

function challengeTtlSeconds(): number {
  const parsed = Number(process.env.AD_REWARD_CHALLENGE_TTL_SECONDS);
  if (!Number.isSafeInteger(parsed) || parsed < 60 || parsed > 30 * 60) {
    return DEFAULT_CHALLENGE_TTL_SECONDS;
  }
  return parsed;
}

export function isValidAdChallengeId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{48}$/.test(value);
}

export function hashAdRewardIntent(intent: AdRewardIntent): string {
  const canonical = [
    intent.from.toLowerCase(),
    intent.to.toLowerCase(),
    String(intent.chainId),
    intent.tokenSymbol.trim().toUpperCase(),
    intent.amountUnits,
  ].join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

/** Google 테스트 광고 POC는 현재 앱이 지원하는 체인에서 모든 지갑에 허용한다. */
export function isTestAdRewardEligible(intent: AdRewardIntent): boolean {
  return TEST_AD_SUPPORTED_CHAIN_IDS.has(intent.chainId);
}

export async function createAdRewardChallenge(
  intent: AdRewardIntent,
  options: { verificationSource?: 'admob-ssv' | 'google-test-ad' } = {}
): Promise<{ challengeId: string; expiresIn: number }> {
  if (!isAdRewardSecurityRequired()) {
    throw new AdRewardSecurityError(
      'AD_REWARD_SECURITY_DISABLED',
      '광고 서버 검증이 비활성화되어 있습니다.',
      409
    );
  }

  const verificationSource = options.verificationSource ?? 'admob-ssv';
  if (verificationSource === 'google-test-ad' && !isTestAdRewardEligible(intent)) {
    throw new AdRewardSecurityError(
      'TEST_AD_SPONSOR_NOT_ALLOWED',
      'Google 테스트 광고 가스 대납은 AD-GAS가 지원하는 체인에서만 사용할 수 있습니다.',
      403
    );
  }

  const challengeId = randomBytes(24).toString('hex');
  const ttl = challengeTtlSeconds();
  const now = Date.now();
  const record: AdRewardRecord = {
    intentHash: hashAdRewardIntent(intent),
    status: 'pending',
    verificationSource,
    createdAt: now,
    expiresAt: now + ttl * 1000,
  };
  const result = await redisCommand<string | null>([
    'SET',
    `${CHALLENGE_PREFIX}${challengeId}`,
    JSON.stringify(record),
    'EX',
    ttl,
    'NX',
  ]);
  if (result !== 'OK') {
    throw new AdRewardSecurityError(
      'AD_REWARD_CHALLENGE_CREATE_FAILED',
      '광고 확인 요청을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.',
      503
    );
  }
  return { challengeId, expiresIn: ttl };
}

/**
 * 네이티브 SDK의 Rewarded 이벤트 후 POC용 테스트 challenge를 승인한다.
 * challenge 자체는 192-bit 임의값이며 실제 릴레이에서는 지갑 서명·nonce·의도를 다시 검증한다.
 */
export async function markGoogleTestAdChallengeVerified(challengeId: string): Promise<void> {
  if (!isAdRewardSecurityRequired()) return;
  if (!isValidAdChallengeId(challengeId)) {
    throw new AdRewardSecurityError(
      'AD_REWARD_CHALLENGE_INVALID',
      '광고 확인 요청 ID가 올바르지 않습니다.'
    );
  }
  const script = [
    "local raw = redis.call('GET', KEYS[1])",
    "if not raw then return 'MISSING' end",
    'local record = cjson.decode(raw)',
    "if record.verificationSource ~= 'google-test-ad' then return 'NOT_TEST' end",
    "if record.status == 'verified' then return 'OK' end",
    "record.status = 'verified'",
    'record.verifiedAt = tonumber(ARGV[1])',
    "redis.call('SET', KEYS[1], cjson.encode(record), 'KEEPTTL')",
    "return 'OK'",
  ].join('\n');
  const result = await redisCommand<string>([
    'EVAL',
    script,
    1,
    `${CHALLENGE_PREFIX}${challengeId}`,
    Date.now(),
  ]);
  if (result === 'OK') return;
  if (result === 'NOT_TEST') {
    throw new AdRewardSecurityError(
      'TEST_AD_CHALLENGE_NOT_ALLOWED',
      '운영 AdMob challenge는 테스트 광고 완료로 승인할 수 없습니다.',
      403
    );
  }
  throw new AdRewardSecurityError(
    'AD_REWARD_CHALLENGE_MISSING',
    '광고 확인 요청이 만료되었거나 존재하지 않습니다.',
    404
  );
}

export async function rateLimitAdRewardChallengeIssue(clientKey: string): Promise<void> {
  if (!isAdRewardSecurityRequired()) return;
  const keyHash = createHash('sha256').update(clientKey).digest('hex');
  const script = [
    "local value = redis.call('INCR', KEYS[1])",
    "if value == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
    'return value',
  ].join('\n');
  const count = Number(
    await redisCommand<number>([
      'EVAL',
      script,
      1,
      `${CHALLENGE_ISSUE_LIMIT_PREFIX}${keyHash}`,
      600,
    ])
  );
  if (count > 30) {
    throw new AdRewardSecurityError(
      'AD_REWARD_CHALLENGE_RATE_LIMIT',
      '광고 확인 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      429
    );
  }
}

function parseRecord(raw: unknown): AdRewardRecord | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AdRewardRecord>;
    if (
      typeof parsed.intentHash !== 'string' ||
      (parsed.status !== 'pending' && parsed.status !== 'verified') ||
      typeof parsed.createdAt !== 'number' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null;
    }
    return parsed as AdRewardRecord;
  } catch {
    return null;
  }
}

export async function getAdRewardChallengeStatus(
  challengeId: string
): Promise<'pending' | 'verified' | 'missing'> {
  if (!isAdRewardSecurityRequired()) return 'verified';
  if (!isValidAdChallengeId(challengeId)) return 'missing';
  const record = parseRecord(
    await redisCommand<string | null>(['GET', `${CHALLENGE_PREFIX}${challengeId}`])
  );
  if (!record || record.expiresAt <= Date.now()) return 'missing';
  return record.status;
}

/** 릴레이의 RPC/시뮬레이션 비용을 사용하기 전에 광고와 전송 의도 일치를 확인한다. */
export async function assertVerifiedAdRewardChallenge(
  challengeId: string | undefined,
  expectedIntent: AdRewardIntent
): Promise<void> {
  if (!isAdRewardSecurityRequired()) return;
  if (!isValidAdChallengeId(challengeId)) {
    throw new AdRewardSecurityError(
      'AD_REWARD_REQUIRED',
      '검증된 광고 시청 기록이 필요합니다.',
      403
    );
  }
  const record = parseRecord(
    await redisCommand<string | null>(['GET', `${CHALLENGE_PREFIX}${challengeId}`])
  );
  if (!record || record.expiresAt <= Date.now()) {
    throw new AdRewardSecurityError(
      'AD_REWARD_CHALLENGE_MISSING',
      '광고 시청 기록이 만료되었거나 이미 사용되었습니다.',
      403
    );
  }
  if (record.status !== 'verified') {
    throw new AdRewardSecurityError(
      'AD_REWARD_PENDING',
      '광고 서버 검증이 아직 완료되지 않았습니다. 잠시 후 다시 시도해주세요.',
      409
    );
  }
  if (record.intentHash !== hashAdRewardIntent(expectedIntent)) {
    throw new AdRewardSecurityError(
      'AD_REWARD_INTENT_MISMATCH',
      '광고를 확인한 전송 정보와 실제 요청 정보가 일치하지 않습니다.',
      403
    );
  }
}

export async function markAdRewardChallengeVerified(input: {
  challengeId: string;
  transactionId: string;
}): Promise<void> {
  if (!isAdRewardSecurityRequired()) return;
  if (!isValidAdChallengeId(input.challengeId)) {
    throw new AdRewardSecurityError(
      'AD_REWARD_CHALLENGE_INVALID',
      '광고 확인 요청 ID가 올바르지 않습니다.'
    );
  }
  if (!/^[0-9a-fA-F]{16,128}$/.test(input.transactionId)) {
    throw new AdRewardSecurityError(
      'AD_REWARD_TRANSACTION_INVALID',
      'AdMob transaction_id가 올바르지 않습니다.'
    );
  }

  // 동일 AdMob transaction_id 재사용 차단과 challenge 상태 변경을 Redis에서 원자적으로 처리한다.
  const script = [
    "local raw = redis.call('GET', KEYS[1])",
    "if not raw then return 'MISSING' end",
    'local record = cjson.decode(raw)',
    "if record.status == 'verified' then return 'ALREADY_VERIFIED' end",
    "if redis.call('EXISTS', KEYS[2]) == 1 then return 'DUPLICATE_TRANSACTION' end",
    "redis.call('SET', KEYS[2], '1', 'EX', ARGV[1], 'NX')",
    "record.status = 'verified'",
    'record.verifiedAt = tonumber(ARGV[2])',
    "redis.call('SET', KEYS[1], cjson.encode(record), 'KEEPTTL')",
    "return 'OK'",
  ].join('\n');
  const txHash = createHash('sha256').update(input.transactionId).digest('hex');
  const result = await redisCommand<string>([
    'EVAL',
    script,
    2,
    `${CHALLENGE_PREFIX}${input.challengeId}`,
    `${SSV_TRANSACTION_PREFIX}${txHash}`,
    SSV_TRANSACTION_TTL_SECONDS,
    Date.now(),
  ]);

  if (result === 'OK' || result === 'ALREADY_VERIFIED') return;
  if (result === 'DUPLICATE_TRANSACTION') {
    throw new AdRewardSecurityError(
      'AD_REWARD_DUPLICATE_TRANSACTION',
      '이미 처리된 AdMob 보상입니다.',
      409
    );
  }
  throw new AdRewardSecurityError(
    'AD_REWARD_CHALLENGE_MISSING',
    '광고 확인 요청이 만료되었거나 존재하지 않습니다.',
    404
  );
}

/**
 * 검증된 광고 1회권 소비와 일일 스폰서 한도 증가를 하나의 Redis transaction으로 처리한다.
 * 동일 challenge의 병렬 릴레이 및 서버리스 인스턴스 간 한도 우회를 동시에 차단한다.
 */
export async function authorizeSponsoredTransfer(
  challengeId: string | undefined,
  expectedIntent: AdRewardIntent,
  from: string
): Promise<void> {
  if (!isAdRewardSecurityRequired()) return;
  if (!isValidAdChallengeId(challengeId)) {
    throw new AdRewardSecurityError(
      'AD_REWARD_REQUIRED',
      '검증된 광고 시청 기록이 필요합니다.',
      403
    );
  }

  const addressHash = createHash('sha256').update(from.toLowerCase()).digest('hex');
  const date = new Date().toISOString().slice(0, 10);
  const script = [
    "local raw = redis.call('GET', KEYS[1])",
    "if not raw then return 'MISSING' end",
    'local record = cjson.decode(raw)',
    "if record.status ~= 'verified' then return 'PENDING' end",
    "if record.intentHash ~= ARGV[1] then return 'INTENT_MISMATCH' end",
    "local current = tonumber(redis.call('GET', KEYS[2]) or '0')",
    "if current >= tonumber(ARGV[2]) then return 'LIMIT' end",
    "if record.verificationSource == 'google-test-ad' then",
    "  local testCurrent = tonumber(redis.call('GET', KEYS[3]) or '0')",
    "  if testCurrent >= tonumber(ARGV[4]) then return 'TEST_LIMIT' end",
    'end',
    "redis.call('DEL', KEYS[1])",
    "local value = redis.call('INCR', KEYS[2])",
    "if value == 1 then redis.call('EXPIRE', KEYS[2], ARGV[3]) end",
    "if record.verificationSource == 'google-test-ad' then",
    "  local testValue = redis.call('INCR', KEYS[3])",
    "  if testValue == 1 then redis.call('EXPIRE', KEYS[3], ARGV[3]) end",
    'end',
    "return 'OK'",
  ].join('\n');
  const result = await redisCommand<string>([
    'EVAL',
    script,
    3,
    `${CHALLENGE_PREFIX}${challengeId}`,
    `${DAILY_USAGE_PREFIX}${date}:${addressHash}`,
    `${TEST_DAILY_USAGE_PREFIX}${date}`,
    hashAdRewardIntent(expectedIntent),
    DAILY_LIMIT,
    172800,
    TEST_DAILY_LIMIT,
  ]);

  switch (result) {
    case 'OK':
      return;
    case 'PENDING':
      throw new AdRewardSecurityError(
        'AD_REWARD_PENDING',
        '광고 서버 검증이 아직 완료되지 않았습니다. 잠시 후 다시 시도해주세요.',
        409
      );
    case 'INTENT_MISMATCH':
      throw new AdRewardSecurityError(
        'AD_REWARD_INTENT_MISMATCH',
        '광고를 확인한 전송 정보와 실제 요청 정보가 일치하지 않습니다.',
        403
      );
    case 'LIMIT':
      throw new AdRewardSecurityError(
        'DAILY_SPONSOR_LIMIT',
        `오늘 무료 전송 한도(${DAILY_LIMIT}회)를 모두 사용했습니다.`,
        429
      );
    case 'TEST_LIMIT':
      throw new AdRewardSecurityError(
        'TEST_AD_DAILY_SPONSOR_LIMIT',
        `오늘 테스트 광고 가스 대납 전체 한도(${TEST_DAILY_LIMIT}회)를 모두 사용했습니다.`,
        429
      );
    default:
      throw new AdRewardSecurityError(
        'AD_REWARD_CHALLENGE_MISSING',
        '광고 시청 기록이 만료되었거나 이미 사용되었습니다.',
        403
      );
  }
}
