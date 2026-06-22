import 'server-only';

/**
 * Cloudflare Turnstile 토큰 서버 검증 (웹 best-effort 봇 방지).
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * `TURNSTILE_SECRET_KEY` 미설정 시 검증을 건너뛴다(개발/미설정 환경).
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function isTurnstileConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp?: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // 시크릿 미설정이면 검증을 강제하지 않음(설정 전 호환).
    return true;
  }
  if (!token) return false;

  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  if (remoteIp) form.set('remoteip', remoteIp);

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      cache: 'no-store',
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
