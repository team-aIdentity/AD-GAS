import { getPublicClient } from '@wagmi/core';
import { erc20Abi, type Address, type PublicClient } from 'viem';
import { config } from '@/wagmi.config';
import { findChainToken } from '@/lib/tokens';
import { getSponsoredTransferContractAddress } from '@/lib/sponsoredTransferContracts';
import type { SupportedChainId } from '@/lib/ensureWalletChain';

type PermitDomain = { name: string; version: string };

const verifiedContracts = new Set<string>();
const contractChecks = new Map<string, Promise<void>>();
const permitDomains = new Map<string, Promise<PermitDomain>>();

const permitVersionAbi = [
  {
    inputs: [],
    name: 'version',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

function cacheKey(chainId: SupportedChainId, address: Address): string {
  return `${chainId}:${address.toLowerCase()}`;
}

export async function ensureSponsoredContractCode(
  publicClient: PublicClient,
  chainId: SupportedChainId,
  contractAddress: Address
): Promise<void> {
  const key = cacheKey(chainId, contractAddress);
  if (verifiedContracts.has(key)) return;

  const existing = contractChecks.get(key);
  if (existing) return existing;

  const check = publicClient
    .getBytecode({ address: contractAddress })
    .then(code => {
      if (!code || code === '0x') {
        throw new Error(
          `주소 ${contractAddress}는 컨트랙트가 아닙니다 (EOA 지갑 주소일 수 있습니다). ` +
            'AdWalletSponsoredTransfer 컨트랙트를 배포하고 올바른 컨트랙트 주소를 .env.local에 설정해주세요.'
        );
      }
      verifiedContracts.add(key);
    })
    .catch(error => {
      contractChecks.delete(key);
      throw error;
    });

  contractChecks.set(key, check);
  return check;
}

export function resolvePermitDomain(
  publicClient: PublicClient,
  chainId: SupportedChainId,
  tokenAddress: Address,
  fallback: PermitDomain
): Promise<PermitDomain> {
  const key = cacheKey(chainId, tokenAddress);
  const existing = permitDomains.get(key);
  if (existing) return existing;

  const request = Promise.all([
    publicClient
      .readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'name',
        args: [],
      })
      .catch(() => undefined),
    publicClient
      .readContract({
        address: tokenAddress,
        abi: permitVersionAbi,
        functionName: 'version',
        args: [],
      })
      .catch(() => undefined),
  ]).then(([name, version]) => ({
    name: typeof name === 'string' && name ? name : fallback.name,
    version: typeof version === 'string' && version ? version : fallback.version,
  }));

  permitDomains.set(key, request);
  return request;
}

/** 광고가 재생되는 동안 변하지 않는 컨트랙트·Permit 도메인 정보를 미리 읽는다. */
export function prewarmTransferStaticData(
  chainId: SupportedChainId,
  tokenSymbol: string
): void {
  const publicClient = getPublicClient(config, { chainId }) as PublicClient | undefined;
  const contractAddress = getSponsoredTransferContractAddress(chainId);
  const token = findChainToken(chainId, tokenSymbol);
  if (!publicClient || !contractAddress || !token) return;

  void ensureSponsoredContractCode(publicClient, chainId, contractAddress).catch(() => {});
  if (token.permit) {
    void resolvePermitDomain(
      publicClient,
      chainId,
      token.address,
      token.permit
    ).catch(() => {});
  }
}
