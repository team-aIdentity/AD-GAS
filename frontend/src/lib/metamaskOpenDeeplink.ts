import { isCapacitorNativeApp } from '@/utils/capacitorNative';

/**
 * MetaMask SDK 딥링크 — Capacitor WebView에서는 **절대** `location.assign` 사용 금지.
 * (메인 프레임이 Vercel URL을 통째로 다시 로드해 1분 가까이 걸리는 원인)
 *
 * iframe / anchor 로 외부 MetaMask만 실행하고 WebView 세션은 유지합니다.
 * Capacitor Android는 shouldOverrideUrlLoading → launchIntent 로 외부 앱을 엽니다.
 */
export function openMetaMaskDeeplink(url: string): void {
  if (typeof window === 'undefined') return;

  if (isCapacitorNativeApp()) {
    if (openViaHiddenAnchor(url)) return;
    openViaHiddenIframe(url);
    return;
  }

  try {
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) openViaHiddenAnchor(url);
  } catch {
    openViaHiddenAnchor(url);
  }
}

function openViaHiddenAnchor(url: string): boolean {
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } catch {
    return false;
  }
}

function openViaHiddenIframe(url: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'display:none;width:0;height:0;border:0';
  iframe.src = url;
  document.body.appendChild(iframe);
  window.setTimeout(() => iframe.remove(), 3000);
}
