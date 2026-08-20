import { createPublicKey, verify } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import {
  AdRewardSecurityError,
  isAdRewardSecurityRequired,
  markAdRewardChallengeVerified,
} from '@/lib/adRewardSecurity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMOB_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
const MAX_KEY_CACHE_MS = 6 * 60 * 60 * 1000;
const MAX_CALLBACK_AGE_MS = 15 * 60 * 1000;

type AdMobKey = { keyId: number; pem: string };
type AdMobKeyResponse = { keys?: AdMobKey[] };

let keyCache: { expiresAt: number; keys: Map<string, string> } | null = null;

async function loadAdMobKeys(forceRefresh = false): Promise<Map<string, string>> {
  if (!forceRefresh && keyCache && keyCache.expiresAt > Date.now()) {
    return keyCache.keys;
  }
  const response = await fetch(ADMOB_KEYS_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`AdMob 공개키를 가져오지 못했습니다. (${response.status})`);
  const payload = (await response.json()) as AdMobKeyResponse;
  const keys = new Map<string, string>();
  for (const key of payload.keys ?? []) {
    if (Number.isSafeInteger(key.keyId) && typeof key.pem === 'string') {
      keys.set(String(key.keyId), key.pem);
    }
  }
  if (keys.size === 0) throw new Error('AdMob 검증 공개키가 비어 있습니다.');
  keyCache = { expiresAt: Date.now() + MAX_KEY_CACHE_MS, keys };
  return keys;
}

function decodeBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64');
}

function normalizeTimestampMs(raw: string): number {
  let value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return Number.NaN;
  // 현재 AdMob은 ms를 사용하지만 오래된 예제의 microseconds 값도 안전하게 처리한다.
  if (value > 10_000_000_000_000) value /= 1000;
  else if (value < 10_000_000_000) value *= 1000;
  return value;
}

async function verifyCallback(rawQuery: string): Promise<{
  challengeId: string | null;
  transactionId: string;
  adUnit: string;
}> {
  const signatureMarker = '&signature=';
  const signatureIndex = rawQuery.lastIndexOf(signatureMarker);
  if (signatureIndex <= 0) throw new Error('AdMob signature 파라미터가 없습니다.');

  // Google 문서 규격대로 signature 직전까지의 raw query를 수정하지 않고 검증한다.
  const signedContent = rawQuery.slice(0, signatureIndex);
  const parameters = new URLSearchParams(rawQuery);
  const signature = parameters.get('signature');
  const keyId = parameters.get('key_id');
  const challengeId = parameters.get('custom_data');
  const transactionId = parameters.get('transaction_id');
  const timestamp = parameters.get('timestamp');
  const adUnit = parameters.get('ad_unit');
  if (!signature || !keyId || !transactionId || !timestamp || !adUnit) {
    throw new Error('AdMob SSV 필수 파라미터가 누락되었습니다.');
  }

  const timestampMs = normalizeTimestampMs(timestamp);
  const age = Date.now() - timestampMs;
  if (!Number.isFinite(timestampMs) || age < -2 * 60 * 1000 || age > MAX_CALLBACK_AGE_MS) {
    throw new Error('AdMob SSV timestamp가 허용 범위를 벗어났습니다.');
  }

  let keys = await loadAdMobKeys();
  let pem = keys.get(keyId);
  if (!pem) {
    keys = await loadAdMobKeys(true);
    pem = keys.get(keyId);
  }
  if (!pem) throw new Error('AdMob SSV key_id에 해당하는 공개키를 찾지 못했습니다.');

  const valid = verify(
    'sha256',
    Buffer.from(signedContent, 'utf8'),
    createPublicKey(pem),
    decodeBase64Url(signature)
  );
  if (!valid) throw new Error('AdMob SSV 서명이 올바르지 않습니다.');
  return { challengeId, transactionId, adUnit };
}

function isExpectedAdUnit(adUnit: string): boolean {
  const expectedAdUnit = (process.env.ADMOB_SSV_AD_UNIT_ID || '3951197726').trim();
  const expectedSuffix = expectedAdUnit.includes('/')
    ? expectedAdUnit.slice(expectedAdUnit.lastIndexOf('/') + 1)
    : expectedAdUnit;
  return adUnit === expectedAdUnit || adUnit === expectedSuffix;
}

export async function GET(request: NextRequest) {
  if (!isAdRewardSecurityRequired()) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  try {
    const queryIndex = request.url.indexOf('?');
    const rawQuery = queryIndex >= 0 ? request.url.slice(queryIndex + 1) : '';
    // AdMob URL 등록 단계의 단순 연결 확인은 보상을 발급하지 않는 health check로 처리한다.
    // 실제 콜백은 query parameter가 있으므로 아래의 서명 검증을 반드시 거친다.
    if (!rawQuery) {
      return NextResponse.json({ ok: true, health: 'admob-ssv' });
    }
    const verified = await verifyCallback(rawQuery);
    // AdMob 콘솔 URL 테스트 등 custom_data가 없는 정상 서명 callback은 승인만 하고
    // 보상 challenge는 변경하지 않는다.
    if (!verified.challengeId) {
      return NextResponse.json({ ok: true, accepted: false, reason: 'missing_custom_data' });
    }
    if (!isExpectedAdUnit(verified.adUnit)) {
      throw new Error('허용되지 않은 AdMob 광고 단위입니다.');
    }
    try {
      await markAdRewardChallengeVerified({
        challengeId: verified.challengeId,
        transactionId: verified.transactionId,
      });
    } catch (error) {
      // 서명은 Google 것으로 확인됐지만 challenge가 만료/중복된 경우 재시도할 필요가 없다.
      // 저장소 장애(5xx)만 Google이 재시도할 수 있도록 실패 응답한다.
      if (error instanceof AdRewardSecurityError && error.status < 500) {
        return NextResponse.json({ ok: true, accepted: false, reason: error.code });
      }
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof AdRewardSecurityError ? error.status : 403;
    return NextResponse.json(
      {
        ok: false,
        code: error instanceof AdRewardSecurityError ? error.code : 'INVALID_ADMOB_SSV',
        error: error instanceof Error ? error.message : 'AdMob SSV 검증에 실패했습니다.',
      },
      { status }
    );
  }
}
