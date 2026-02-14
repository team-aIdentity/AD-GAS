import { http, createConfig } from 'wagmi'
import { mainnet, sepolia, base, baseSepolia, avalanche, bsc } from 'wagmi/chains'
import { injected, metaMask } from 'wagmi/connectors'

// 지원 체인: 이더리움 메인넷 / Base 메인넷 / Base Sepolia / Avalanche / BNB (5개)
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

// eth.merkle.io 등 실패 방지를 위해, 기본값 + 환경변수 기반 RPC 사용
const RPC_URLS: Record<number, string> = {
  [mainnet.id]: process.env.NEXT_PUBLIC_RPC_MAINNET || 'https://eth.llamarpc.com',
  [base.id]: process.env.NEXT_PUBLIC_RPC_BASE || 'https://mainnet.base.org',
  [baseSepolia.id]: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'https://sepolia.base.org',
  [avalanche.id]: process.env.NEXT_PUBLIC_RPC_AVALANCHE || 'https://api.avax.network/ext/bc/C/rpc',
  [bsc.id]: process.env.NEXT_PUBLIC_RPC_BNB || 'https://bsc-dataseed.binance.org',
}

export const config = createConfig({
  // 지갑 연결·네트워크 전환에 사용할 5개 체인
  chains: [mainnet, base, baseSepolia, avalanche, bsc],
  connectors: [
    injected(),
    metaMask(),
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
