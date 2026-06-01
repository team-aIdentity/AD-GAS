import { base, avalanche, bsc } from 'wagmi/chains';
import type { Network } from '@/types/adgasfe';
import { giwaSepolia } from '@/lib/chains/giwaSepolia';

const CHAIN_TO_ICON: Record<number, string> = {
  56: '🟡',
  8453: '🔵',
  91342: '🏛️',
  43114: '🔺',
};

export const SUPPORTED_NETWORKS: Network[] = [
  {
    id: 'base',
    name: base.name,
    chainId: base.id,
    type: 'Mainnet',
    icon: CHAIN_TO_ICON[base.id] ?? '◆',
    nativeToken: base.nativeCurrency.symbol,
    enabled: true,
  },
  {
    id: 'avalanche',
    name: avalanche.name,
    chainId: avalanche.id,
    type: 'C-Chain',
    icon: CHAIN_TO_ICON[avalanche.id] ?? '◆',
    nativeToken: avalanche.nativeCurrency.symbol,
    enabled: true,
  },
  {
    id: 'bnb',
    name: bsc.name,
    chainId: bsc.id,
    type: 'Mainnet',
    icon: CHAIN_TO_ICON[bsc.id] ?? '◆',
    nativeToken: bsc.nativeCurrency.symbol,
    enabled: false, // 배포 전 — 가스 충전 후 활성화
  },
  {
    id: 'giwa-sepolia',
    name: giwaSepolia.name,
    chainId: giwaSepolia.id,
    type: 'Testnet',
    icon: CHAIN_TO_ICON[giwaSepolia.id] ?? '◆',
    nativeToken: giwaSepolia.nativeCurrency.symbol,
    enabled: false, // 배포 전 — 가스 충전 후 활성화
  },
];

// 활성화된 체인만 선택 가능. 기본 네트워크는 첫 번째 활성 체인(Base).
export const DEFAULT_NETWORK: Network =
  SUPPORTED_NETWORKS.find(n => n.enabled !== false) ?? SUPPORTED_NETWORKS[0];
