import { defineChain } from 'viem';

/**
 * GIWA 테스트넷(GIWA Sepolia)
 * @see https://docs.giwa.io/get-started/connect-to-giwa.md
 */
export const giwaSepolia = defineChain({
  id: 91342,
  name: 'GIWA Sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://sepolia-rpc.giwa.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'GIWA Explorer',
      url: 'https://sepolia-explorer.giwa.io',
    },
  },
});
