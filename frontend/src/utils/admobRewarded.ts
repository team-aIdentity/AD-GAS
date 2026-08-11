import { Capacitor } from '@capacitor/core';
import { RewardAdPluginEvents } from '@capacitor-community/admob';

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

/** 리워드 다이얼로그 닫기 후 WebView·MetaMask 딥링크 충돌 방지 */
async function waitAfterAdDismiss(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 700));
  try {
    const { App } = await import('@capacitor/app');
    const state = await App.getState();
    if (!state.isActive) {
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, 5000);
        void App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
    }
    await new Promise(resolve => setTimeout(resolve, 400));
  } catch {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

/**
 * 리워드 지급(Rewarded) 후 사용자가 광고 UI를 닫을 때(Dismissed)까지 대기한 뒤 resolve.
 * 영상 종료 직후 MetaMask 서명을 띄우면 전면 광고와 충돌하므로 Dismissed 이후에만 완료 처리.
 */
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

  return new Promise((resolve, reject) => {
    let rewarded = false;
    let settled = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    const settle = async (fn: () => void) => {
      if (settled) return;
      settled = true;
      await Promise.all(handles.map(h => h.remove().catch(() => {})));
      fn();
    };

    void AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
      rewarded = true;
    }).then(h => handles.push(h));

    void AdMob.addListener(RewardAdPluginEvents.Dismissed, async () => {
      if (rewarded) {
        await waitAfterAdDismiss();
        await settle(() => resolve());
        return;
      }
      await settle(() =>
        reject(new Error('Ad was not completed. Transaction cancelled.'))
      );
    }).then(h => handles.push(h));

    void AdMob.addListener(RewardAdPluginEvents.FailedToShow, async err => {
      await settle(() =>
        reject(new Error(err?.message || 'Failed to show rewarded ad'))
      );
    }).then(h => handles.push(h));

    options?.onBeforeAdSurface?.();

    void AdMob.showRewardVideoAd()
      .then(() => {
        rewarded = true;
      })
      .catch(async err => {
        await settle(() =>
          reject(err instanceof Error ? err : new Error(String(err)))
        );
      });
  });
}
