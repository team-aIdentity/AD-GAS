/**
 * Capacitor 네이티브 앱(WebView)에서 실행 중인지 여부.
 * 브라우저에서는 false → AdSense / GPT 리워드 사용.
 * 앱에서는 true → AdMob 리워드 사용 (AdSense 스크립트 비활성화).
 */
export function isCapacitorNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const Capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    return Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}
