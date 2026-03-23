/**
 * Types aligned with AD-GAS monorepo `web/src/core/AdWalletRelayerSDK.ts`.
 * Keep in sync when extending B2B fields (e.g. adProof, sessionId).
 */

export type SupportedTokenSymbol = "USDC" | "USDT";

export type HexAddress = `0x${string}`;

export interface SponsoredTransferRequest {
  from: HexAddress;
  to: HexAddress;
  /** Human-readable decimal string, e.g. "0.01" */
  amount: string;
  tokenSymbol: SupportedTokenSymbol;
  chainId: number;
  /** EIP-712 signature for meta-tx */
  signature?: string;
  nonce?: number;
  /** EIP-2612 permit (gasless approve path) */
  permitSignature?: string;
  deadline?: number;
  /** Future: server-verified ad completion payload */
  adProof?: string;
  sessionId?: string;
}

export interface SponsoredTransferResponse {
  txHash: string;
}
