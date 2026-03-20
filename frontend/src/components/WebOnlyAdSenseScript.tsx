'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { isCapacitorNativeApp } from '@/utils/capacitorNative';

/**
 * 일반 브라우저에서만 AdSense 스크립트 로드.
 * Capacitor 네이티브 WebView에서는 로드하지 않음 (AdMob 사용).
 */
export function WebOnlyAdSenseScript() {
  const [loadAdSense, setLoadAdSense] = useState(false);

  useEffect(() => {
    setLoadAdSense(!isCapacitorNativeApp());
  }, []);

  if (!loadAdSense) return null;

  const client =
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || 'ca-pub-1201899929581374';

  return (
    <Script
      id="adsense-script"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
