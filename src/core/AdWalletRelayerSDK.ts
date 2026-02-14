import type { Address } from 'viem';

export type SupportedTokenSymbol = 'USDC' | 'USDT';

export interface SponsoredTransferRequest {
  from: Address;
  to: Address;
  amount: string; // human-readable (e.g. "0.01")
  tokenSymbol: SupportedTokenSymbol;
  chainId: number;
  signature?: string; // EIP-712 서명 (메타트랜잭션용)
  nonce?: number; // 사용자 nonce (메타트랜잭션용)
}

export interface SponsoredTransferResponse {
  txHash: string;
}

interface RelayerSdkConfig {
  /**
   * Relayer API 베이스 URL.
   * 브라우저에서 사용 시 기본값은 '/api' (Next.js app router 라우트).
   */
  baseUrl?: string;
}

/**
 * AD Wallet 전용 대납(스폰서) Relayer SDK.
 * - Biconomy 없이, 우리 쪽 Relayer API(/api/relay/transfer)를 호출해 가스 대납 전송을 수행한다.
 * - 체인/토큰/1일 5회 제한 로직은 서버에서 검증한다.
 */
export class AdWalletRelayerSDK {
  private readonly baseUrl: string;

  constructor(config: RelayerSdkConfig = {}) {
    // 클라이언트에서 상대 경로로 호출하면 Next.js API 라우트로 라우팅된다.
    this.baseUrl = config.baseUrl || '/api';
  }

  /**
   * 광고 시청 완료 후, Relayer를 통해 가스 대납 전송을 요청한다.
   * 실패 시 Error를 throw 하며, 프론트에서는 토스트/에러 UI로 처리하면 된다.
   */
  public async sendSponsoredTransfer(
    payload: SponsoredTransferRequest
  ): Promise<SponsoredTransferResponse> {
    const res = await fetch(`${this.baseUrl}/relay/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let message = '스폰서 전송에 실패했습니다.';
      try {
        const data = await res.json();
        if (data?.error) message = data.error;
      } catch {
        // ignore JSON parse error
      }
      throw new Error(message);
    }

    const data = (await res.json()) as SponsoredTransferResponse;
    if (!data.txHash) {
      throw new Error('스폰서 전송 응답에 txHash가 없습니다.');
    }
    return data;
  }
}

