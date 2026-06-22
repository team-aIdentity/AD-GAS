import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'team.aidentity.adgas',
  appName: 'AD GAS',
  // Next 정적 export 결과물 (npm run build:mobile → frontend/out)
  webDir: 'out',
  android: {
    // 릴레이 API는 HTTPS(Vercel)를 사용하므로 cleartext 불필요
    allowMixedContent: false,
  },
};

export default config;
