"use client";

import { OnchainKitProvider } from "@coinbase/onchainkit";
import type { ReactNode } from "react";
import { base } from "viem/chains";

const apiKey = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY ?? "";

export function Providers({ children }: { children: ReactNode }) {
  // 로컬에서 OnchainKit 분석 API로의 fetch가 막히면 콘솔에 "Failed to fetch"가 자주 뜹니다.
  const analyticsEnv = process.env.NEXT_PUBLIC_ONCHAINKIT_ANALYTICS;
  const analyticsEnabled =
    analyticsEnv === "false"
      ? false
      : analyticsEnv === "true"
        ? true
        : process.env.NODE_ENV === "production";

  return (
    <OnchainKitProvider
      apiKey={apiKey}
      analytics={analyticsEnabled}
      chain={base}
      config={{
        appearance: {
          name: "AD-GAS",
          logo: "/logo.png",
        },
      }}
      miniKit={{
        enabled: true,
        autoConnect: true,
      }}
    >
      {children}
    </OnchainKitProvider>
  );
}
