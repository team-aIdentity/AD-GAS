import { http, createConfig } from 'wagmi'
import { base, avalanche, bsc } from 'wagmi/chains'
import { injected, metaMask } from 'wagmi/connectors'
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
      dappMetadata: {
        name: 'AD GAS',
        url: dappMetadataUrl,
      },
      // 1.0.25에서 Permit 응답이 Android WebView로 정상 복귀하던
      // MetaMask SDK 커넥터를 사용한다. 앱 실행마다 새 통신 채널을 만들어
      // 만료된 relay 세션을 재사용하지 않는다.
      storage: { enabled: false },
      preferDesktop: false,
      useDeeplink: metamaskUseDeeplink,
      openDeeplink: openMetaMaskDeeplink,
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
