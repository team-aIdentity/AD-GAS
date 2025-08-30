import { BigNumberish } from 'ethers';

// Type alias for backward compatibility
export type BigNumber = BigNumberish;

// Core transaction types
export interface GaslessTransaction {
  to: string;
  data: string;
  value?: BigNumber;
  gasLimit?: BigNumber;
  deadline?: number;
  nonce?: BigNumber;
  signature?: string;
}

export interface MetaTransaction {
  from: string;
  to: string;
  value: BigNumber;
  data: string;
  operation: number;
  gasToken: string;
  gasPrice: BigNumber;
  gasLimit: BigNumber;
  deadline: number;
  nonce: BigNumber;
}

// Network configuration
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  relayerUrl?: string;
  paymasterAddress?: string;
  forwarderAddress?: string;
  gasTokens: string[];
}

// SDK configuration
export interface GaslessSDKConfig {
  networks: NetworkConfig[];
  defaultNetwork: number;
  apiKey?: string;
  relayerEndpoint?: string;
  paymasterEndpoint?: string;
  debug?: boolean;
}

// Relayer interfaces
export interface IRelayerService {
  submitTransaction(request: RelayerRequest): Promise<RelayerResponse>;
  submitMetaTransaction(request: RelayerRequest): Promise<RelayerResponse>;
  getTransactionStatus(transactionHash: string): Promise<RelayerResponse>;
}

export interface IPaymasterService {
  requestSponsorship(request: PaymasterRequest): Promise<PaymasterResponse>;
  validatePaymasterUserOp(userOp: UserOperation, maxCost: BigNumber): Promise<PaymasterValidationResult>;
  postOp(context: PaymasterPostOpContext): Promise<void>;
  canSponsor(sender: string, callData: string, chainId: number): Promise<{ canSponsor: boolean; reason?: string }>;
  getGasEstimates(userOp: Partial<UserOperation>, chainId: number): Promise<{
    preVerificationGas: BigNumber;
    verificationGasLimit: BigNumber;
    callGasLimit: BigNumber;
  }>;
  getStatus(): Promise<{
    status: string;
    supportedChains: number[];
    sponsorshipLimits: Record<string, any>;
  }>;
  getStakeInfo(): Promise<PaymasterStakeInfo>;
}

export interface INetworkManager {
  getCurrentNetwork(): NetworkConfig;
  switchNetwork(chainId: number): Promise<void>;
  getAvailableNetworks(): NetworkConfig[];
}

export interface ITransactionBuilder {
  buildTransaction(
    transaction: Partial<GaslessTransaction>,
    wallet: WalletInterface
  ): Promise<GaslessTransaction>;
  buildMetaTransaction(
    transaction: Partial<MetaTransaction>,
    wallet: WalletInterface
  ): Promise<MetaTransaction>;
  estimateGas(
    transaction: Partial<GaslessTransaction>,
    wallet: WalletInterface
  ): Promise<BigNumber>;
  getTransactionMessage(transaction: GaslessTransaction): string;
  getEIP712Data(metaTransaction: MetaTransaction): {
    domain: any;
    types: any;
    value: any;
  };
}

export interface ISignatureValidator {
  validateSignature(
    transaction: GaslessTransaction,
    signature: string
  ): boolean;
}

export interface RelayerRequest {
  transaction: GaslessTransaction;
  signature: string;
  chainId: number;
  gasPrice?: BigNumber;
  gasLimit?: BigNumber;
}

export interface RelayerResponse {
  success: boolean;
  transactionHash?: string;
  error?: string;
  gasUsed?: BigNumber;
  effectiveGasPrice?: BigNumber;
}

// Paymaster interfaces
export interface PaymasterRequest {
  userOp: UserOperation;
  entryPoint: string;
  chainId: number;
  context?: any;
}

export interface PaymasterResponse {
  paymasterAndData: string;
  preVerificationGas: BigNumber;
  verificationGasLimit: BigNumber;
  callGasLimit: BigNumber;
  maxFeePerGas?: BigNumber;
  maxPriorityFeePerGas?: BigNumber;
}

// Enhanced paymaster types for EIP-4337 compliance
export interface PaymasterValidationResult {
  context: string;
  validAfter: number;
  validUntil: number;
  authorizer?: string;
}

export interface PaymasterPostOpContext {
  mode: number; // 0 = postOpReverted, 1 = opSucceeded, 2 = opReverted
  context: string;
  actualGasCost: BigNumber;
  actualUserOpFeePerGas: BigNumber;
}

export interface PaymasterStakeInfo {
  stake: BigNumber;
  unstakeDelaySec: number;
  withdrawTime: number;
}

export interface TokenPaymasterConfig {
  tokenAddress: string;
  tokenDecimals: number;
  exchangeRate: BigNumber; // tokens per ETH
  minBalance: BigNumber;
  maxGasPrice: BigNumber;
}

export interface PaymasterPolicy {
  sponsorshipLimit: BigNumber;
  timeWindow: number;
  maxOperationsPerTimeWindow: number;
  allowedTargets?: string[];
  blockedTargets?: string[];
  requireWhitelist: boolean;
}

// ERC-4337 User Operation
export interface UserOperation {
  sender: string;
  nonce: BigNumber;
  initCode: string;
  callData: string;
  callGasLimit: BigNumber;
  verificationGasLimit: BigNumber;
  preVerificationGas: BigNumber;
  maxFeePerGas: BigNumber;
  maxPriorityFeePerGas: BigNumber;
  paymasterAndData: string;
  signature: string;
}

// Event types
export interface TransactionEvent {
  type: 'submitted' | 'confirmed' | 'failed' | 'replaced';
  transactionHash: string;
  blockNumber?: number;
  gasUsed?: BigNumber;
  error?: string;
}

// Error types
export class GaslessSDKError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'GaslessSDKError';
  }
}

export enum ErrorCodes {
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RELAYER_ERROR = 'RELAYER_ERROR',
  PAYMASTER_ERROR = 'PAYMASTER_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  INVALID_NONCE = 'INVALID_NONCE',
  EXPIRED_TRANSACTION = 'EXPIRED_TRANSACTION',
}

// Utility types
export type EventCallback<T = any> = (event: T) => void;
export type TransactionCallback = EventCallback<TransactionEvent>;

export interface WalletInterface {
  getAddress(): Promise<string>;
  signMessage(message: string): Promise<string>;
  signTypedData(domain: any, types: any, value: any): Promise<string>;
  getChainId(): Promise<number>;
}
