import { Capacitor } from '@capacitor/core';

import { isCapacitorNativeApp } from './capacitorNative';

function pickRewardAdUnitId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const ios = process.env.NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID_IOS?.trim();
  const android = process.env.NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID_ANDROID?.trim();
  const fallback = process.env.NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID?.trim();

  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return ios || fallback;
  if (platform === 'android') return android || fallback;
  return fallback;
}

/**
 * AdMob 리워드 영상 (Capacitor 네이티브 전용).
 * @see https://github.com/capacitor-community/admob
 */
export function isAdMobRewardedConfigured(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isCapacitorNativeApp()) return false;
  const id = pickRewardAdUnitId();
  return !!id && id.length > 3;
}

export type ShowAdMobRewardedOptions = {
  /** 네이티브 전면 광고 직전 — WebView 위 레이어를 가리지 않도록 UI 숨김 */
  onBeforeAdSurface?: () => void;
};

export async function showAdMobRewardedVideo(options?: ShowAdMobRewardedOptions): Promise<void> {
  if (!isCapacitorNativeApp()) {
    throw new Error('AdMob rewarded is only available in the native app');
  }

  const adId = pickRewardAdUnitId();
  if (!adId) {
    throw new Error(
      '리워드 광고 단위가 설정되어 있지 않습니다. NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID (또는 iOS/Android 전용 변수)를 Vercel/배포 환경에 설정하세요.'
    );
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
