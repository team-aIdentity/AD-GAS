import type { Address, Chain, PublicClient, Transport } from 'viem';

const VERIFIED_TOKEN_ABI = [
  {
    inputs: [],
    name: 'dojangScroll',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAttesterIds',
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const DOJANG_SCROLL_ABI = [
  {
    inputs: [
      { name: 'addr', type: 'address' },
      { name: 'attesterId', type: 'bytes32' },
    ],
    name: 'isVerified',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * GIWA VerifiedToken이 현재 허용하는 attester 중 하나라도 수신자를
 * 검증했는지 확인한다. 토큰이 업그레이드되거나 attester가 바뀌어도
 * 하드코딩된 목록 대신 온체인 설정을 그대로 따른다.
 */
export async function isGiwaDojangRecipientVerified<
  transport extends Transport,
  chain extends Chain | undefined,
>(
  publicClient: PublicClient<transport, chain>,
  token: Address,
  recipient: Address
): Promise<boolean> {
  const [dojangScroll, attesterIds] = await Promise.all([
    publicClient.readContract({
      address: token,
      abi: VERIFIED_TOKEN_ABI,
      functionName: 'dojangScroll',
    }),
    publicClient.readContract({
      address: token,
      abi: VERIFIED_TOKEN_ABI,
      functionName: 'getAttesterIds',
    }),
  ]);

  if (attesterIds.length === 0) return false;

  // GIWA 체인 정의에는 Multicall3 주소가 없으므로 viem.multicall 대신
  // 개별 eth_call을 병렬 실행한다.
  const results = await Promise.all(
    attesterIds.map(attesterId =>
      publicClient.readContract({
        address: dojangScroll,
        abi: DOJANG_SCROLL_ABI,
        functionName: 'isVerified',
        args: [recipient, attesterId],
      })
    )
  );

  return results.some(Boolean);
}
