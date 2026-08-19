import { http, createConfig } from 'wagmi'
import { base, avalanche, bsc } from 'wagmi/chains'
import { injected } from '@wagmi/connectors/injected'
import { metaMask } from '@wagmi/connectors/metaMask'
import { openMetaMaskDeeplink } from '@/lib/metamaskOpenDeeplink'
import { giwaSepolia } from '@/lib/chains/giwaSepolia'

// 지원 체인: Base 메인넷 / GIWA Sepolia / Avalanche / BNB (4개)
// Capacitor WebView: MetaMask SDK 딥링크. 데스크톱: MetaMask SDK + Injected.

const dappMetadataUrl =
  (process.env.NEXT_PUBLIC_APP_URL?.trim() && process.env.NEXT_PUBLIC_APP_URL.trim()) ||
  (process.env.VERCEL_URL?.trim() && `https://${process.env.VERCEL_URL.trim()}`) ||
  'https://ad-gas.vercel.app'

const metamaskUseDeeplink = process.env.NEXT_PUBLIC_METAMASK_USE_DEEPLINK !== 'false'

const RPC_URLS: Record<number, string> = {
  [base.id]: process.env.NEXT_PUBLIC_RPC_BASE || 'https://mainnet.base.org',
  [giwaSepolia.id]:
    process.env.NEXT_PUBLIC_RPC_GIWA_SEPOLIA || 'https://sepolia-rpc.giwa.io',
  [avalanche.id]: process.env.NEXT_PUBLIC_RPC_AVALANCHE || 'https://api.avax.network/ext/bc/C/rpc',
  [bsc.id]: process.env.NEXT_PUBLIC_RPC_BNB || 'https://bsc-dataseed.binance.org',
}

export const config = createConfig({
  chains: [base, giwaSepolia, avalanche, bsc],
  connectors: [
    metaMask({
      dapp: {
        name: 'AD GAS',
        url: dappMetadataUrl,
      },
      // MetaMask Connect의 Mobile Wallet Protocol을 사용한다. 기존
      // @metamask/sdk relay는 Android chainChanged 누락 시 activeChain이
      // 이전 체인에 고정될 수 있었다.
      mobile: {
        useDeeplink: metamaskUseDeeplink,
        preferredOpenLink: openMetaMaskDeeplink,
      },
      ui: {
        // Connect SDK는 모바일에서 `preferExtension: false`이면 확장프로그램/QR
        // 설치 모달을 강제로 표시한다. 기본값(true)을 유지하면 확장프로그램이
        // 없는 모바일 WebView에서 MWP 딥링크 경로로 바로 진입한다.
        preferExtension: true,
        showInstallModal: false,
      },
    }),
    injected(),
  ],
  transports: {
    [base.id]: http(RPC_URLS[base.id]),
    [giwaSepolia.id]: http(RPC_URLS[giwaSepolia.id]),
    [avalanche.id]: http(RPC_URLS[avalanche.id]),
    [bsc.id]: http(RPC_URLS[bsc.id]),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
