/**
 * Google 광고 연동 (웹)
 * - 리워드 광고: Google Publisher Tag (GPT) 사용.
 *   (AdMob은 모바일 앱용이므로, 웹에서는 GPT 리워드 광고 사용)
 * - 참고: https://developers.google.com/publisher-tag/samples/display-rewarded-ad
 */

const GPT_SCRIPT_URL = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';

declare global {
  interface Window {
    googletag?: {
      cmd: Array<() => void>;
      pubads: () => {
        (): unknown;
        setTargeting?: (key: string, value: string | string[]) => void;
        addEventListener: (event: string, fn: (event: unknown) => void) => void;
        enableSingleRequest?: () => void;
      };
      defineOutOfPageSlot: (adUnitPath: string, elementId?: string) => unknown;
      enableServices: () => void;
      destroySlots: (slots: unknown[]) => void;
      display: (slotOrId: unknown) => void;
    };
  }
}

let gptLoaded: Promise<void> | null = null;

function loadGptScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('window is undefined'));
  if (window.googletag?.cmd) return Promise.resolve();
  if (gptLoaded) return gptLoaded;

  gptLoaded = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GPT_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      window.googletag = window.googletag || { cmd: [] };
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load GPT script'));
    document.head.appendChild(script);
  });
  return gptLoaded;
}

/**
 * GPT 리워드 광고 표시.
 * - adUnitPath: 예) '/12345678/rewarded' (Google Ad Manager에서 발급한 리워드 광고 단위 경로)
 * - 리워드 수령 시 resolve, 닫기만 하거나 실패 시 reject
 */
export function showGoogleRewardedAd(adUnitPath: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      await loadGptScript();
      const googletag = window.googletag;
      if (!googletag?.cmd) {
        reject(new Error('Google Tag not available'));
        return;
      }

      googletag.cmd.push(function () {
        const pubads = googletag!.pubads();
        if (!pubads) {
          reject(new Error('googletag.pubads not available'));
          return;
        }

        // 리워드 광고는 defineOutOfPageSlot(경로) 사용. 일부 환경에서는 null 반환 가능(모바일 최적화 필요)
        const slot = googletag!.defineOutOfPageSlot(adUnitPath, undefined as unknown as string);
        if (!slot) {
          reject(
            new Error(
              'Rewarded ad slot not supported (e.g. require mobile-optimized page with viewport meta)'
            )
          );
          return;
        }

        let settled = false;
        const cleanup = () => {
          try {
            pubads.removeEventListener?.('rewardedSlotGranted', onGranted);
            pubads.removeEventListener?.('rewardedSlotClosed', onClosed);
            googletag!.destroySlots?.([slot]);
          } catch (_) {}
        };

        const onGranted = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        };

        const onClosed = () => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error('Ad was not completed. Transaction cancelled.'));
        };

        pubads.addEventListener?.('rewardedSlotGranted', onGranted);
        pubads.addEventListener?.('rewardedSlotClosed', onClosed);

        googletag!.enableServices?.();
        googletag!.display?.(slot);
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

export function isGoogleRewardedAdConfigured(): boolean {
  if (typeof window === 'undefined') return false;
  const slot = process.env.NEXT_PUBLIC_GOOGLE_REWARDED_AD_SLOT;
  return !!slot && slot.length > 2;
}
