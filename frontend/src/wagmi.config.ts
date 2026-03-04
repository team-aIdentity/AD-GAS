import { http, createConfig } from 'wagmi'
import { mainnet, base, baseSepolia, avalanche, bsc } from 'wagmi/chains'
import { metaMask, walletConnect } from 'wagmi/connectors'

// 지원 체인: 이더리움 메인넷 / Base 메인넷 / Base Sepolia / Avalanche / BNB (5개)
// WalletConnect: Trust Wallet, OKX Wallet 등 모바일 지갑 연결용 (https://cloud.walletconnect.com 에서 발급)
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

const RPC_URLS: Record<number, string> = {
  [mainnet.id]: process.env.NEXT_PUBLIC_RPC_MAINNET || 'https://eth.llamarpc.com',
  [base.id]: process.env.NEXT_PUBLIC_RPC_BASE || 'https://mainnet.base.org',
  [baseSepolia.id]: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'https://sepolia.base.org',
  [avalanche.id]: process.env.NEXT_PUBLIC_RPC_AVALANCHE || 'https://api.avax.network/ext/bc/C/rpc',
  [bsc.id]: process.env.NEXT_PUBLIC_RPC_BNB || 'https://bsc-dataseed.binance.org',
}

export const config = createConfig({
  chains: [mainnet, base, baseSepolia, avalanche, bsc],
  // MetaMask + WalletConnect(Trust Wallet, OKX Wallet 등)
  connectors: [metaMask(), walletConnect({ projectId })],
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
