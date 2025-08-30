// Gasless SDK와 관련된 프론트엔드 타입 정의

import { type PublicClient, type WalletClient } from 'viem';
import { BundlerResponse } from '../../../src';

/**
 * SDK 초기화 설정
 */
export interface GaslessSDKInitConfig {
  publicClient: PublicClient;
  walletClient: WalletClient;
  biconomyApiKey: string;
}

/**
 * 트랜잭션 데이터
 */
export interface TransactionData {
  to: string;
  value: string;
  data?: string;
}

/**
 * SDK 상태
 */
export interface SdkState {
  instance: any | null; // GaslessSDK 타입이 정확히 export되지 않아 임시로 any 사용
  isInitializing: boolean;
  error: string | null;
}

/**
 * 트랜잭션 상태
 */
export interface TransactionState {
  isExecuting: boolean;
  result: BundlerResponse | null;
  error: string | null;
}

/**
 * 로그 엔트리
 */
export interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'success' | 'error' | 'warning';
}

/**
 * 네트워크 정보
 */
export interface NetworkInfo {
  chainId: number;
  name: string;
  rpcUrl?: string;
  blockExplorer?: string;
}

/**
 * 가스리스 전송 옵션
 */
export interface GaslessTransferOptions {
  showAdBeforeTransaction?: boolean;
  adDurationSeconds?: number;
  enableProgressTracking?: boolean;
  autoRetryOnFailure?: boolean;
  maxRetries?: number;
}

/**
 * 전송 단계
 */
export enum TransferStep {
  INITIALIZING = 'initializing',
  SHOWING_AD = 'showing_ad',
  PREPARING_TRANSACTION = 'preparing_transaction',
  SIGNING = 'signing',
  SUBMITTING = 'submitting',
  CONFIRMING = 'confirming',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * 전송 진행 상황
 */
export interface TransferProgress {
  step: TransferStep;
  message: string;
  progress: number; // 0-100
  estimatedTimeRemaining?: number; // seconds
}

/**
 * Hook 반환 타입들
 */
export interface UseGaslessSDKResult {
  sdk: any | null;
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  reinitialize: () => Promise<void>;
}

export interface UseGaslessTransferResult {
  transfer: (data: TransactionData, options?: GaslessTransferOptions) => Promise<BundlerResponse>;
  isTransferring: boolean;
  progress: TransferProgress | null;
  result: BundlerResponse | null;
  error: string | null;
  reset: () => void;
}

