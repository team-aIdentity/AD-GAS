import { http, createConfig } from 'wagmi'
import { mainnet, base, baseSepolia, avalanche, bsc } from 'wagmi/chains'
import { injected, metaMask } from 'wagmi/connectors'
import { openMetaMaskDeeplink } from '@/lib/metamaskOpenDeeplink'

// 지원 체인: 이더리움 메인넷 / Base 메인넷 / Base Sepolia / Avalanche / BNB (5개)
// MetaMask만 사용 (@metamask/sdk 딥링크 / 확장). dappMetadata.url 은 실제 접속 origin 과 맞추는 것이 안전합니다.
const dappMetadataUrl =
  (process.env.NEXT_PUBLIC_APP_URL?.trim() && process.env.NEXT_PUBLIC_APP_URL.trim()) ||
  (process.env.VERCEL_URL?.trim() && `https://${process.env.VERCEL_URL.trim()}`) ||
  'https://ad-gas.vercel.app'

/** false면 유니버설 링크(https://metamask.app/...) 위주 — WebView에서 커스텀 스킴보다 나을 때가 있음 */
const metamaskUseDeeplink = process.env.NEXT_PUBLIC_METAMASK_USE_DEEPLINK !== 'false'

const RPC_URLS: Record<number, string> = {
  [mainnet.id]: process.env.NEXT_PUBLIC_RPC_MAINNET || 'https://eth.llamarpc.com',
  [base.id]: process.env.NEXT_PUBLIC_RPC_BASE || 'https://mainnet.base.org',
  [baseSepolia.id]: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'https://sepolia.base.org',
  [avalanche.id]: process.env.NEXT_PUBLIC_RPC_AVALANCHE || 'https://api.avax.network/ext/bc/C/rpc',
  [bsc.id]: process.env.NEXT_PUBLIC_RPC_BNB || 'https://bsc-dataseed.binance.org',
}

export const config = createConfig({
  chains: [mainnet, base, baseSepolia, avalanche, bsc],
  connectors: [
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
    [mainnet.id]: http(RPC_URLS[mainnet.id]),
    [base.id]: http(RPC_URLS[base.id]),
    [baseSepolia.id]: http(RPC_URLS[baseSepolia.id]),
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
