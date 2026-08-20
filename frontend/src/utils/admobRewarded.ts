import { Capacitor } from '@capacitor/core';
import { RewardAdPluginEvents } from '@capacitor-community/admob';

import { isCapacitorNativeApp } from './capacitorNative';

const ANDROID_REWARDED_TEST_AD_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917';
const ANDROID_REWARDED_PRODUCTION_AD_UNIT_ID = 'ca-app-pub-1201899929581374/3951197726';
let initializationPromise: Promise<void> | null = null;
let preparationPromise: Promise<void> | null = null;
let preparationKey: string | null = null;
let preparedAdKey: string | null = null;

function shouldUseTestAds(): boolean {
  return process.env.NEXT_PUBLIC_ADMOB_USE_TEST_ADS === 'true';
}

function pickRewardAdUnitId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const ios = process.env.NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID_IOS?.trim();
  const android = process.env.NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID_ANDROID?.trim();
  const fallback = process.env.NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID?.trim();

  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return ios || fallback;
  if (platform === 'android') {
    // 개발 중 실광고 노출·클릭으로 인한 무효 트래픽을 막기 위해 테스트 모드를 최우선한다.
    if (shouldUseTestAds()) return ANDROID_REWARDED_TEST_AD_UNIT_ID;
    return android || fallback || ANDROID_REWARDED_PRODUCTION_AD_UNIT_ID;
  }
  return fallback;
}

/** AdMob SDK 초기화를 단일 실행으로 보장하고 광고 준비 전에 완료까지 기다린다. */
export function initializeAdMobRewarded(): Promise<void> {
  if (!isCapacitorNativeApp()) return Promise.resolve();
  if (initializationPromise) return initializationPromise;

  initializationPromise = import('@capacitor-community/admob')
    .then(({ AdMob }) =>
      AdMob.initialize({
        initializeForTesting: shouldUseTestAds(),
      })
    )
    .then(() => undefined)
    .catch(error => {
      initializationPromise = null;
      throw error;
    });
  return initializationPromise;
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
  /** AdMob SSV callback의 custom_data로 전달할 서버 발급 1회용 challenge */
  ssvCustomData?: string;
};

export type PreloadAdMobRewardedOptions = Pick<ShowAdMobRewardedOptions, 'ssvCustomData'> & {
  /** show 직전 호출에서만 true. 앱 시작 시 SSV 없는 운영 광고 preload를 막기 위한 내부 옵션 */
  allowWithoutSsv?: boolean;
};

function withAdTimeout<T>(promise: Promise<T>, maxMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), maxMs);
    promise.then(
      value => {
        window.clearTimeout(timer);
        resolve(value);
      },
      error => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** 앱 진입 시 미리 광고를 준비해 전송 버튼에서의 대기 시간을 줄인다. */
export async function preloadAdMobRewarded(
  options: PreloadAdMobRewardedOptions = {}
): Promise<void> {
  if (!isCapacitorNativeApp()) return;
  const adId = pickRewardAdUnitId();
  if (!adId) throw new Error('리워드 광고 단위가 설정되어 있지 않습니다.');

  // 운영 광고는 challenge를 발급받기 전 미리 로드하면 SSV custom_data를 넣을 수 없다.
  // 테스트 광고는 SSV callback을 보내지 않으므로 앱 진입 시 일반 preload를 허용한다.
  if (!shouldUseTestAds() && !options.ssvCustomData && !options.allowWithoutSsv) {
    await withAdTimeout(initializeAdMobRewarded(), 10000, 'AdMob 초기화 시간이 초과되었습니다.');
    return;
  }

  const key = `${adId}:${options.ssvCustomData || 'no-ssv'}`;
  if (preparedAdKey === key) return;
  if (preparationPromise && preparationKey === key) return preparationPromise;
  if (preparationPromise) await preparationPromise;

  preparationKey = key;
  preparationPromise = (async () => {
    await withAdTimeout(initializeAdMobRewarded(), 10000, 'AdMob 초기화 시간이 초과되었습니다.');
    const { AdMob } = await import('@capacitor-community/admob');
    await withAdTimeout(
      AdMob.prepareRewardVideoAd({
        adId,
        isTesting: shouldUseTestAds(),
        ...(options.ssvCustomData
          ? { ssv: { customData: options.ssvCustomData } }
          : {}),
      }),
      20000,
      '리워드 광고 준비 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.'
    );
    preparedAdKey = key;
  })().finally(() => {
    preparationPromise = null;
    preparationKey = null;
  });

  return preparationPromise;
}

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

  await preloadAdMobRewarded({
    ssvCustomData: options?.ssvCustomData,
    allowWithoutSsv: true,
  });

  const { AdMob } = await import('@capacitor-community/admob');
  preparedAdKey = null;

  return new Promise((resolve, reject) => {
    let rewarded = false;
    let showed = false;
    let settled = false;
    let showTimer: number | undefined;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    const settle = async (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (showTimer != null) window.clearTimeout(showTimer);
      await Promise.all(handles.map(h => h.remove().catch(() => {})));
      fn();
    };

    void (async () => {
      try {
        // 표시 전에 모든 이벤트 구독을 완료해야 빠른 Showed/Rewarded 이벤트를 놓치지 않는다.
        const registeredHandles = await Promise.all([
          AdMob.addListener(RewardAdPluginEvents.Showed, () => {
            showed = true;
            if (showTimer != null) window.clearTimeout(showTimer);
          }),
          AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
            rewarded = true;
          }),
          AdMob.addListener(RewardAdPluginEvents.Dismissed, async () => {
            if (rewarded) {
              await waitAfterAdDismiss();
              await settle(() => resolve());
              void preloadAdMobRewarded().catch(() => {});
              return;
            }
            await settle(() =>
              reject(new Error('광고 시청이 완료되지 않아 트랜잭션을 취소했습니다.'))
            );
          }),
          AdMob.addListener(RewardAdPluginEvents.FailedToShow, async err => {
            await settle(() =>
              reject(new Error(err?.message || '리워드 광고를 표시하지 못했습니다.'))
            );
          }),
        ]);
        handles.push(...registeredHandles);

        options?.onBeforeAdSurface?.();
        showTimer = window.setTimeout(() => {
          if (!showed) {
            void settle(() =>
              reject(new Error('광고 표시 응답이 없습니다. 잠시 후 다시 시도해주세요.'))
            );
          }
        }, 10000);

        const reward = await AdMob.showRewardVideoAd();
        if (reward) rewarded = true;
      } catch (err) {
        await settle(() =>
          reject(err instanceof Error ? err : new Error(String(err)))
        );
      }
    })();
  });
}
