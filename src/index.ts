// Main SDK exports
export { GaslessSDK } from './core/GaslessSDK';
export type { SdkConfig, TransactionRequest, QuoteOptions, AdTrigger } from './core/GaslessSDK';

// Relayer-based sponsorship SDK (Biconomy 미사용)
export { AdWalletRelayerSDK } from './core/AdWalletRelayerSDK';
export type {
  SponsoredTransferRequest,
  SponsoredTransferResponse,
  SupportedTokenSymbol,
} from './core/AdWalletRelayerSDK';

// Essential utilities
export { Logger } from './utils/Logger';

// Types and interfaces
export * from './types';

// Default export (기존 가스리스 SDK를 유지)
import { GaslessSDK } from './core/GaslessSDK';
export default GaslessSDK;