import { isCapacitorNativeApp } from '@/utils/capacitorNative';
import { openExternalAppUrl } from '@/lib/nativeExternalAppLauncher';

/**
 * MetaMask SDK 딥링크 — Capacitor WebView에서는 **절대** `location.assign` 사용 금지.
 * (메인 프레임이 Vercel URL을 통째로 다시 로드해 1분 가까이 걸리는 원인)
 *
 * 광고 종료처럼 브라우저 사용자 제스처가 끝난 뒤에도 동작하도록 Capacitor에서는
 * 네이티브 Intent로 MetaMask를 실행합니다. WebView 세션은 그대로 유지됩니다.
 */
export function openMetaMaskDeeplink(url: string): void {
  if (typeof window === 'undefined') return;

  if (isCapacitorNativeApp()) {
    // 숨은 anchor.click()은 호출 자체는 성공해도 비동기 광고 콜백에서는 Android가
    // 새 창을 차단할 수 있다. 네이티브 결과가 실패한 경우에만 WebView 폴백을 쓴다.
    void openExternalAppUrl(url).then(opened => {
      if (!opened) openViaSameWindowAnchor(url);
    });
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

function openViaSameWindowAnchor(url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_self';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
