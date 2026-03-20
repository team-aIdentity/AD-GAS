/**
 * MetaMask SDK 기본 동작은 `window.open` 등을 쓰는 경우가 있어,
 * Capacitor WebView에서 앱만 켜지고 연결(OTP) 모달이 안 뜨는 현상이 날 수 있습니다.
 * 동일 창에서 이동해 OS가 인텐트/유니버설 링크로 MetaMask에 넘기도록 합니다.
 */
export function openMetaMaskDeeplink(url: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.location.assign(url);
  } catch {
    window.location.href = url;
  }
}
