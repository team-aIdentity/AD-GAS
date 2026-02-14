import { mainnet, base, baseSepolia, avalanche, bsc } from 'wagmi/chains';
import type { Network } from '@/types/adgasfe';

const CHAIN_TO_ICON: Record<number, string> = {
  1: '⟠',
  56: '🟡',
  8453: '🔵',
  84532: '🔵',
  43114: '🔺',
};

export const SUPPORTED_NETWORKS: Network[] = [
  {
    id: 'ethereum',
    name: mainnet.name,
    chainId: mainnet.id,
    type: 'Mainnet',
    icon: CHAIN_TO_ICON[mainnet.id] ?? '◆',
    nativeToken: mainnet.nativeCurrency.symbol,
  },
  {
    id: 'base',
    name: base.name,
    chainId: base.id,
    type: 'Mainnet',
    icon: CHAIN_TO_ICON[base.id] ?? '◆',
    nativeToken: base.nativeCurrency.symbol,
  },
  {
    id: 'base-sepolia',
    name: baseSepolia.name,
    chainId: baseSepolia.id,
    type: 'Testnet',
    icon: CHAIN_TO_ICON[baseSepolia.id] ?? '◆',
    nativeToken: baseSepolia.nativeCurrency.symbol,
  },
  {
    id: 'avalanche',
    name: avalanche.name,
    chainId: avalanche.id,
    type: 'C-Chain',
    icon: CHAIN_TO_ICON[avalanche.id] ?? '◆',
    nativeToken: avalanche.nativeCurrency.symbol,
  },
  {
    id: 'bnb',
    name: bsc.name,
    chainId: bsc.id,
    type: 'Mainnet',
    icon: CHAIN_TO_ICON[bsc.id] ?? '◆',
    nativeToken: bsc.nativeCurrency.symbol,
  },
];
