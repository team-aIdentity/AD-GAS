import { http, createConfig } from 'wagmi'
import { mainnet, base, baseSepolia, avalanche, bsc } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'

// 지원 체인: 이더리움 메인넷 / Base 메인넷 / Base Sepolia / Avalanche / BNB (5개)
// MetaMask SDK: 모바일/WebView에서 딥링크로 MetaMask 앱 연결 (dappMetadata.url 필수에 가깝게 설정)
// WalletConnect: https://cloud.walletconnect.com projectId
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

const dappMetadataUrl =
  (process.env.NEXT_PUBLIC_APP_URL?.trim() && process.env.NEXT_PUBLIC_APP_URL.trim()) ||
  (process.env.VERCEL_URL?.trim() && `https://${process.env.VERCEL_URL.trim()}`) ||
  'https://ad-gas.vercel.app'

const RPC_URLS: Record<number, string> = {
  [mainnet.id]: process.env.NEXT_PUBLIC_RPC_MAINNET || 'https://eth.llamarpc.com',
  [base.id]: process.env.NEXT_PUBLIC_RPC_BASE || 'https://mainnet.base.org',
  [baseSepolia.id]: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'https://sepolia.base.org',
  [avalanche.id]: process.env.NEXT_PUBLIC_RPC_AVALANCHE || 'https://api.avax.network/ext/bc/C/rpc',
  [bsc.id]: process.env.NEXT_PUBLIC_RPC_BNB || 'https://bsc-dataseed.binance.org',
}

export const config = createConfig({
  chains: [mainnet, base, baseSepolia, avalanche, bsc],
  // MetaMask 먼저(모바일 딥링크) → WC(다른 지갑) → 브라우저 주입
  connectors: [
    metaMask({
      dappMetadata: {
        name: 'AD GAS',
        url: dappMetadataUrl,
      },
      useDeeplink: true,
    }),
    walletConnect({ projectId }),
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

// Wagmi 타입 확장
declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
