import { http, createConfig } from 'wagmi'
import { mainnet, polygon, sepolia, base, optimism } from 'wagmi/chains'
import { injected, metaMask, walletConnect, coinbaseWallet } from 'wagmi/connectors'

// WalletConnect Project ID - 환경변수로 관리하는 것을 권장합니다
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

export const config = createConfig({
  chains: [sepolia, mainnet, polygon, base, optimism], // Sepolia를 첫 번째로
  connectors: [
    injected(), // MetaMask, Coinbase Wallet 등 브라우저 지갑
    metaMask(), // MetaMask 전용 커넥터
    coinbaseWallet({ 
      appName: 'Gasless SDK Frontend',
      appLogoUrl: 'https://example.com/logo.png'
    }),
    walletConnect({ 
      projectId,
      metadata: {
        name: 'Gasless SDK Frontend',
        description: 'Gasless SDK를 활용한 Next.js 앱',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000',
        icons: ['https://example.com/icon.png']
      },
      showQrModal: true
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http('https://polygon-mainnet.g.alchemy.com/v2/your-api-key'),
    [sepolia.id]: http(),
    [base.id]: http(),
    [optimism.id]: http(),
  },
  ssr: true, // Next.js SSR 지원
})

// Wagmi 타입 확장
declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
