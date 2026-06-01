import { http, createConfig } from 'wagmi'
import { base, avalanche, bsc } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'
import { openMetaMaskDeeplink } from '@/lib/metamaskOpenDeeplink'
import { giwaSepolia } from '@/lib/chains/giwaSepolia'

// 지원 체인: Base 메인넷 / GIWA Sepolia / Avalanche / BNB (4개)
// Capacitor WebView: WalletConnect → MetaMask. 데스크톱: MetaMask SDK + Injected (UI에서 WC 숨김)
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

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
    walletConnect({ projectId }),
    metaMask({
      dappMetadata: {
        name: 'AD GAS',
        url: dappMetadataUrl,
      },
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
