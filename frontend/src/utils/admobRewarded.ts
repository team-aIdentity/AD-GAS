import { isCapacitorNativeApp } from './capacitorNative';

/**
 * AdMob 리워드 영상 (Capacitor 네이티브 전용).
 * @see https://github.com/capacitor-community/admob
 */
export function isAdMobRewardedConfigured(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isCapacitorNativeApp()) return false;
  const id = process.env.NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID;
  return !!id && id.trim().length > 3;
}

export type ShowAdMobRewardedOptions = {
  /** 네이티브 전면 광고 직전 — WebView 위 레이어를 가리지 않도록 UI 숨김 */
  onBeforeAdSurface?: () => void;
};

export async function showAdMobRewardedVideo(options?: ShowAdMobRewardedOptions): Promise<void> {
  if (!isCapacitorNativeApp()) {
    throw new Error('AdMob rewarded is only available in the native app');
  }
  const adId = process.env.NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID?.trim();
  if (!adId) {
    throw new Error('NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID is not set');
  }

  const useTestAds = process.env.NEXT_PUBLIC_ADMOB_USE_TEST_ADS === 'true';

  const { AdMob } = await import('@capacitor-community/admob');

  await AdMob.prepareRewardVideoAd({
    adId,
    isTesting: useTestAds,
  });

  try {
    options?.onBeforeAdSurface?.();
    await AdMob.showRewardVideoAd();
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}
