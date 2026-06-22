'use client';

/**
 * Cloudflare Turnstile 클라이언트 토큰 획득 (웹 best-effort 봇 방지).
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 미설정 시 undefined를 반환(검증 생략).
 *
 * 보이지 않는(invisible) 위젯을 동적으로 렌더해 1회용 토큰을 발급한다.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          size?: 'invisible' | 'normal' | 'compact';
          callback: (token: string) => void;
          'error-callback'?: () => void;
        }
      ) => string;
      execute: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Turnstile 스크립트 로드 실패'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** 토큰 발급. 미설정/실패 시 undefined. */
export async function getTurnstileToken(): Promise<string | undefined> {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return undefined;
  if (typeof window === 'undefined') return undefined;

  try {
    await loadScript();
  } catch {
    return undefined;
  }
  if (!window.turnstile) return undefined;

  return new Promise<string | undefined>(resolve => {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    let widgetId: string | undefined;
    const cleanup = () => {
      try {
        if (widgetId) window.turnstile?.remove(widgetId);
      } catch {
        /* ignore */
      }
      container.remove();
    };
    // 안전장치: 응답이 없으면 8초 후 undefined
    const timer = setTimeout(() => {
      cleanup();
      resolve(undefined);
    }, 8000);

    try {
      widgetId = window.turnstile!.render(container, {
        sitekey: siteKey,
        size: 'invisible',
        callback: (token: string) => {
          clearTimeout(timer);
          cleanup();
          resolve(token);
        },
        'error-callback': () => {
          clearTimeout(timer);
          cleanup();
          resolve(undefined);
        },
      });
      window.turnstile!.execute(widgetId);
    } catch {
      clearTimeout(timer);
      cleanup();
      resolve(undefined);
    }
  });
}
