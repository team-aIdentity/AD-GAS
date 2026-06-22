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
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_AVALANCHE || avalanche.rpcUrls.default.http[0];
    const publicClient = createPublicClient({
      chain: avalanche,
      transport: http(rpcUrl),
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

    // 스폰서 주소(가스 대납 지갑). 키 로테이션 시 환경변수만 갱신하면 됨.
    const sponsorAddress = process.env.NEXT_PUBLIC_SPONSOR_ADDRESS_AVALANCHE;

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
      // 스폰서 주소는 환경변수로 설정(키 로테이션 대응). 미설정 시 판정 보류(null).
      isSponsored: sponsorAddress
        ? tx.from.toLowerCase() === sponsorAddress.toLowerCase()
        : null,
      hasTransferEvent: transferEvent !== null,
    });
  } catch (error: unknown) {
    // 내부 에러 상세는 서버 로그로만 남기고, 클라이언트에는 일반 메시지만 반환
    console.error('[check-tx] error:', error);
    return NextResponse.json(
      { error: '트랜잭션 정보를 조회할 수 없습니다.' },
      { status: 500 }
    );
  }
}
