import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, decodeEventLog } from 'viem';
import { avalanche } from 'viem/chains';

const CONTRACT_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'token', type: 'address' },
      { indexed: false, name: 'nonce', type: 'uint256' },
    ],
    name: 'SponsoredTransfer',
    type: 'event',
  },
] as const;

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const txHash = searchParams.get('hash');

  if (!txHash) {
    return NextResponse.json({ error: '트랜잭션 해시가 필요합니다.' }, { status: 400 });
  }

  try {
    const publicClient = createPublicClient({
      chain: avalanche,
      transport: http(
        process.env.NEXT_PUBLIC_RPC_AVALANCHE ||
          'https://avax-mainnet.g.alchemy.com/v2/Vx00GcGcS_QJVmhBGJrNj'
      ),
    });

    // 트랜잭션 정보 조회
    const tx = await publicClient.getTransaction({ hash: txHash as `0x${string}` });
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });

    // SponsoredTransfer 이벤트 로그 파싱
    const contractAddress = process.env
      .NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_AVALANCHE as `0x${string}`;
    const logs = receipt.logs.filter(
      log => log.address.toLowerCase() === contractAddress.toLowerCase()
    );

    let transferEvent: { from?: string; to?: string; amount?: bigint; token?: string; nonce?: bigint } | null = null;
    const allEvents: { eventName?: string; args?: unknown; error?: string; rawLog?: unknown }[] = [];

    for (const log of logs) {
      try {
        const decoded = decodeEventLog({
          abi: CONTRACT_ABI,
          data: log.data,
          topics: log.topics,
        });
        allEvents.push({
          eventName: decoded.eventName,
          args: decoded.args,
        });
        if (decoded.eventName === 'SponsoredTransfer') {
          transferEvent = decoded.args;
        }
      } catch (err: unknown) {
        // 이벤트 파싱 실패 (다른 이벤트일 수 있음)
        allEvents.push({
          error: err instanceof Error ? err.message : String(err),
          rawLog: log,
        });
      }
    }

    // 컨트랙트 잔액 확인 (네이티브 토큰인 경우)
    let contractBalance = null;
    try {
      contractBalance = await publicClient.getBalance({ address: contractAddress });
    } catch {
      // 무시
    }

    return NextResponse.json({
      success: true,
      transaction: {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value.toString(),
        gasPrice: tx.gasPrice?.toString(),
        gas: tx.gas?.toString(),
      },
      receipt: {
        status: receipt.status,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber.toString(),
      },
      transferEvent: transferEvent
        ? {
            from: transferEvent.from,
            to: transferEvent.to,
            amount: transferEvent.amount?.toString() ?? '',
            token: transferEvent.token,
            nonce: transferEvent.nonce?.toString() ?? '',
            isNative: transferEvent.token === '0x0000000000000000000000000000000000000000',
          }
        : null,
      allEvents: allEvents,
      contractBalance: contractBalance?.toString() || null,
      gasPaidBy: tx.from, // From 주소가 가스비를 지불한 주소
      isSponsored: tx.from.toLowerCase() === '0x39f1e010fb6832dbf81da5eb2ff8f631987a212d',
      hasTransferEvent: transferEvent !== null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
