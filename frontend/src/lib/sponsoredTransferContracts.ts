import type { SupportedChainId } from '@/lib/ensureWalletChain';

const PUBLIC_FALLBACKS: Partial<Record<SupportedChainId, `0x${string}`>> = {
  8453: '0x82D97b3F0e53756f2E32778d243cbe7Fc0DAF4Fc',
  43114: '0xe64ffA4b21b8e8cE44Be6D44096dF7f0ba47849d',
  91342: '0x3BFB6639e2dc9ef17da299a8EBC7e00ade90Ef05',
};

function normalizeAddress(value: string | undefined): `0x${string}` | undefined {
  const address = value?.trim();
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return undefined;
  return address as `0x${string}`;
}

/**
 * NEXT_PUBLIC 값이 없는 정적 Android 빌드에서도 이미 배포된 공개 컨트랙트를 사용한다.
 * 환경 변수로 지정한 주소가 있으면 그 값을 우선한다.
 */
export function getSponsoredTransferContractAddress(
  chainId: SupportedChainId
): `0x${string}` | undefined {
  const configured = (() => {
    switch (chainId) {
      case 8453:
        return process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_BASE;
      case 43114:
        return process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_AVALANCHE;
      case 56:
        return process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_BNB;
      case 91342:
        return process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_GIWA_SEPOLIA;
    }
  })();

  return normalizeAddress(configured) ?? PUBLIC_FALLBACKS[chainId];
}
