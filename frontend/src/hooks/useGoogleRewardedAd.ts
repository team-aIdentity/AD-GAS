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
 * - 브라우저: Google Ad Manager / GPT (`NEXT_PUBLIC_GOOGLE_REWARDED_AD_SLOT`)
 * - Capacitor 앱: AdMob (`NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID`)
 */
export function useGoogleRewardedAd() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState(false);

  useEffect(() => {
    setClient(true);
  }, []);

  const webSlot = process.env.NEXT_PUBLIC_GOOGLE_REWARDED_AD_SLOT;
  const webSlotReady = !!(webSlot && webSlot.trim().length > 2);

  /** 하이드레이션 전: 웹은 env만으로 판단(슬롯 있으면 실제 광고 경로). 마운트 후 앱 여부 반영 */
  const native = client && isCapacitorNativeApp();
  const isConfigured = !client
    ? webSlotReady
    : native
      ? isAdMobRewardedConfigured()
      : isGoogleRewardedAdConfigured() && webSlotReady;

  const showAd = useCallback(
    (opts?: RewardedAdShowOptions): Promise<void> => {
      setIsLoading(true);
      setError(null);

      const run = native
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
          setError(err instanceof Error ? err.message : String(err));
          throw err;
        });
    },
    [native, webSlot]
  );

  return {
    showRewardedAd: showAd,
    isConfigured,
    platform: native ? ('native' as const) : ('web' as const),
    isLoading,
    error,
  };
}
