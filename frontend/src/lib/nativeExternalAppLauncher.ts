import { registerPlugin } from '@capacitor/core';

type OpenExternalUrlResult = {
  opened: boolean;
};

interface ExternalAppLauncherPlugin {
  open(options: { url: string }): Promise<OpenExternalUrlResult>;
}

const ExternalAppLauncher = registerPlugin<ExternalAppLauncherPlugin>(
  'ExternalAppLauncher'
);

/** Android WebView의 사용자 제스처 제한과 무관하게 신뢰된 외부 앱 링크를 연다. */
export async function openExternalAppUrl(url: string): Promise<boolean> {
  try {
    const result = await ExternalAppLauncher.open({ url });
    return result.opened === true;
  } catch {
    return false;
  }
}
