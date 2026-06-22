import 'server-only';
import crypto from 'crypto';

/**
 * AdMob 리워드 광고 Server-Side Verification(SSV) 콜백 서명 검증.
 * @see https://developers.google.com/admob/android/ssv (Verify SSV callbacks)
 *
 * Google은 광고 시청 완료 시 SSV 콜백 URL을 GET으로 호출하며,
 * 마지막 두 쿼리 파라미터는 항상 `signature`, `key_id`(이 순서)다.
 * 나머지 쿼리 문자열(= signature 앞까지)이 ECDSA(P-256, SHA-256) 서명 대상이다.
 */

const VERIFIER_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';

interface VerifierKey {
  keyId: number;
  pem: string;
  base64: string;
}

interface VerifierKeysResponse {
  keys: VerifierKey[];
}

let _keysCache: { fetchedAt: number; keys: VerifierKey[] } | null = null;
const KEYS_TTL_MS = 6 * 60 * 60 * 1000; // 6시간

async function getVerifierKeys(): Promise<VerifierKey[]> {
  if (_keysCache && Date.now() - _keysCache.fetchedAt < KEYS_TTL_MS) {
    return _keysCache.keys;
  }
  const res = await fetch(VERIFIER_KEYS_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch AdMob verifier keys: ${res.status}`);
  }
  const data = (await res.json()) as VerifierKeysResponse;
  _keysCache = { fetchedAt: Date.now(), keys: data.keys };
  return data.keys;
}

function base64UrlToBuffer(value: string): Buffer {
  // Google은 web-safe base64(URL-safe)로 서명을 전달한다.
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

/**
 * SSV 콜백 검증.
 * @param rawQuery `?` 를 제외한 원본 쿼리 문자열(디코딩 전, 순서 보존 필수)
 * @returns 검증 통과 시 파싱된 파라미터, 실패 시 throw
 */
export async function verifyAdmobSsv(rawQuery: string): Promise<{
  customData: string | null;
  userId: string | null;
  transactionId: string | null;
}> {
  const sigMarker = '&signature=';
  const sigIndex = rawQuery.indexOf(sigMarker);
  if (sigIndex < 0) {
    throw new Error('signature 파라미터가 없습니다.');
  }
  const contentToVerify = rawQuery.substring(0, sigIndex);

  const params = new URLSearchParams(rawQuery);
  const signature = params.get('signature');
  const keyIdStr = params.get('key_id');
  if (!signature || !keyIdStr) {
    throw new Error('signature/key_id 파라미터가 없습니다.');
  }
  const keyId = Number(keyIdStr);

  const keys = await getVerifierKeys();
  const matched = keys.find(k => k.keyId === keyId);
  if (!matched) {
    throw new Error(`알 수 없는 key_id: ${keyId}`);
  }

  const verifier = crypto.createVerify('sha256');
  verifier.update(contentToVerify);
  verifier.end();
  const signatureBuf = base64UrlToBuffer(signature);
  const ok = verifier.verify(matched.pem, signatureBuf);
  if (!ok) {
    throw new Error('SSV 서명 검증에 실패했습니다.');
  }

  return {
    customData: params.get('custom_data'),
    userId: params.get('user_id'),
    transactionId: params.get('transaction_id'),
  };
}
