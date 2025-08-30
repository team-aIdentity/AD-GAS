// Core SDK configuration
export interface GaslessSDKConfig {
  networks: NetworkConfig[];
  defaultNetwork: number;
  bundlerEndpoint?: string; // EIP-4337 Bundler endpoint
  entryPointAddress?: string; // EntryPoint contract address
  debug?: boolean;
}

// Network configuration
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  gasTokens: string[];
}

// Wallet interface for signing
export interface WalletInterface {
  getAddress(): Promise<string>;
  signMessage(message: string): Promise<string>;
  signTypedData(domain: any, types: any, value: any): Promise<string>;
  getChainId(): Promise<number>;
}

// Account Abstraction (EIP-4337) Types
export interface UserOperation {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}

export interface UserOperationRequest {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
}

export interface BundlerResponse {
  userOpHash: string;
  bundlerTxHash?: string;
}

export interface UserOperationReceipt {
  userOpHash: string;
  sender: string;
  paymaster: string;
  nonce: string;
  success: boolean;
  actualGasCost: string;
  actualGasUsed: string;
  logs: any[];
  receipt: {
    transactionHash: string;
    transactionIndex: string;
    blockHash: string;
    blockNumber: string;
    from: string;
    to: string;
    cumulativeGasUsed: string;
    gasUsed: string;
    contractAddress?: string;
    logs: any[];
    status: string;
  };
}

// Error handling
export enum ErrorCodes {
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
}

export class GaslessSDKError extends Error {
  public code: ErrorCodes;

  constructor(message: string, code: ErrorCodes) {
    super(message);
    this.name = 'GaslessSDKError';
    this.code = code;
  }
}