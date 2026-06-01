'use client';

import { useState, useCallback, useEffect } from 'react';
import { showGoogleRewardedAd, isGoogleRewardedAdConfigured } from '../utils/googleAds';
import { showAdMobRewardedVideo, isAdMobRewardedConfigured } from '../utils/admobRewarded';
import { isCapacitorNativeApp } from '../utils/capacitorNative';

export type RewardedAdShowOptions = {
  /** GPT display / AdMob show 직전 — 전체화면 광고가 모달에 가리지 않도록 */
  onAdSurfaceReady?: () => void;
};

/**
 * 리워드 영상 광고 (플랫폼 분기)
 * 운영 권장: **앱 우선 → AdMob** (`NEXT_PUBLIC_ADMOB_*`). 웹 GPT는 선택(`NEXT_PUBLIC_GOOGLE_REWARDED_AD_SLOT`).
 * - 브라우저: Google Ad Manager / GPT
 * - Capacitor 네이티브: AdMob (`NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID` 등)
 *
 * `isConfigured`/`platform`은 SSR·하이드레이션 불일치를 피하기 위해 마운트 후에만 채워집니다.
 * 실제 재생 분기는 항상 `isCapacitorNativeApp()`으로 동작합니다.
 */
export function useGoogleRewardedAd() {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const webSlot = process.env.NEXT_PUBLIC_GOOGLE_REWARDED_AD_SLOT;
  const webSlotReady = !!(webSlot && webSlot.trim().length > 2);

  /** UI용: 마운트 전에는 항상 false (서버 렌더와 일치). AdMob 브라우저 오판 방지 포함 */
  const nativeForUi = mounted && isCapacitorNativeApp();
  const isConfigured =
    mounted && (nativeForUi ? isAdMobRewardedConfigured() : isGoogleRewardedAdConfigured() && webSlotReady);
  const platform: 'native' | 'web' =
    mounted && nativeForUi ? 'native' : 'web';

  const showAd = useCallback((opts?: RewardedAdShowOptions): Promise<void> => {
    setIsLoading(true);
    setError(null);

    const run = isCapacitorNativeApp()
      ? showAdMobRewardedVideo({ onBeforeAdSurface: opts?.onAdSurfaceReady })
      : webSlot
        ? showGoogleRewardedAd(webSlot, {
            onBeforeDisplay: opts?.onAdSurfaceReady,
          })
        : Promise.reject(new Error('Google rewarded ad slot not configured'));

    return run
      .then(() => {
        setIsLoading(false);
      })
      .catch((err) => {
        setIsLoading(false);
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      });
  }, [webSlot]);

  return {
    showRewardedAd: showAd,
    /** 마운트 직후 false → 채워짐(깜박임은 짧음). 브라우저에서만 웹 GPT 기준 적용 */
    isConfigured,
    platform,
    isLoading,
    error,
  };
}
