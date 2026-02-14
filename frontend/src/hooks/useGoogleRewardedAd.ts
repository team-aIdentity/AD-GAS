'use client';

import { useState, useCallback } from 'react';
import { showGoogleRewardedAd, isGoogleRewardedAdConfigured } from '../utils/googleAds';

/**
 * Google 리워드 광고 (웹: GPT) 훅.
 * - NEXT_PUBLIC_GOOGLE_REWARDED_AD_SLOT 이 설정된 경우에만 사용 가능.
 * - 형태 1 beforeTransaction 에서 호출하여 광고 시청 완료 시 resolve.
 */
export function useGoogleRewardedAd() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = typeof window !== 'undefined' && isGoogleRewardedAdConfigured();
  const adSlot = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_GOOGLE_REWARDED_AD_SLOT : undefined;

  const showAd = useCallback((): Promise<void> => {
    if (!adSlot) {
      return Promise.reject(new Error('Google rewarded ad slot not configured'));
    }
    setIsLoading(true);
    setError(null);
    return showGoogleRewardedAd(adSlot)
      .then(() => {
        setIsLoading(false);
      })
      .catch((err) => {
        setIsLoading(false);
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      });
  }, [adSlot]);

  return {
    showRewardedAd: showAd,
    isConfigured: !!isConfigured && !!adSlot,
    isLoading,
    error,
  };
}
