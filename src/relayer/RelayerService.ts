import axios, { AxiosInstance } from 'axios';
import {
  RelayerRequest,
  RelayerResponse,
  GaslessSDKError,
  ErrorCodes,
  IRelayerService,
} from '../types';
import { Logger } from '../utils/Logger';

export class RelayerService implements IRelayerService {
  private baseURL: string;
  private httpClient: AxiosInstance;
  private logger: Logger;

  constructor(baseURL?: string, logger?: Logger) {
    this.baseURL = baseURL || 'https://relayer.gasless-sdk.com';
    this.logger = logger || new Logger(false);

    this.httpClient = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GaslessSDK/1.0.0',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Setup axios interceptors for logging and error handling
   */
  private setupInterceptors(): void {
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug_log('Relayer request:', config);
        return config;
      },
      (error) => {
        this.logger.error('Relayer request error:', error);
        return Promise.reject(error);
      }
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug_log('Relayer response:', response.data);
        return response;
      },
      (error) => {
        this.logger.error('Relayer response error:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Submit a gasless transaction to the relayer
   */
  public async submitTransaction(
    request: RelayerRequest
  ): Promise<RelayerResponse> {
    try {
      this.logger.info('Submitting gasless transaction to relayer');

      const response = await this.httpClient.post('/api/v1/relay', {
        transaction: {
          to: request.transaction.to,
          data: request.transaction.data,
          value: request.transaction.value?.toString() || '0',
          gasLimit: request.transaction.gasLimit?.toString(),
          deadline: request.transaction.deadline,
          nonce: request.transaction.nonce?.toString(),
        },
        signature: request.signature,
        chainId: request.chainId,
        gasPrice: request.gasPrice?.toString(),
        gasLimit: request.gasLimit?.toString(),
      });

      if (response.data.success) {
        this.logger.info(
          `Transaction submitted successfully: ${response.data.transactionHash}`
        );
        return {
          success: true,
          transactionHash: response.data.transactionHash,
          gasUsed: response.data.gasUsed ? response.data.gasUsed : undefined,
          effectiveGasPrice: response.data.effectiveGasPrice
            ? response.data.effectiveGasPrice
            : undefined,
        };
      } else {
        this.logger.warn(
          `Transaction submission failed: ${response.data.error}`
        );
        return {
          success: false,
          error: response.data.error || 'Unknown relayer error',
        };
      }
    } catch (error) {
      this.logger.error('Failed to submit transaction to relayer:', error);

      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        throw new GaslessSDKError(
          `Relayer error: ${message}`,
          ErrorCodes.RELAYER_ERROR,
          error
        );
      }

      throw new GaslessSDKError(
        'Failed to communicate with relayer',
        ErrorCodes.NETWORK_ERROR,
        error
      );
    }
  }

  /**
   * Submit a meta-transaction to the relayer
   */
  public async submitMetaTransaction(
    request: RelayerRequest
  ): Promise<RelayerResponse> {
    try {
      this.logger.info('Submitting meta-transaction to relayer');

      const response = await this.httpClient.post('/api/v1/meta-relay', {
        transaction: {
          to: request.transaction.to,
          data: request.transaction.data,
          value: request.transaction.value?.toString() || '0',
          gasLimit: request.transaction.gasLimit?.toString(),
          deadline: request.transaction.deadline,
          nonce: request.transaction.nonce?.toString(),
        },
        signature: request.signature,
        chainId: request.chainId,
      });

      if (response.data.success) {
        this.logger.info(
          `Meta-transaction submitted successfully: ${response.data.transactionHash}`
        );
        return {
          success: true,
          transactionHash: response.data.transactionHash,
          gasUsed: response.data.gasUsed ? response.data.gasUsed : undefined,
          effectiveGasPrice: response.data.effectiveGasPrice
            ? response.data.effectiveGasPrice
            : undefined,
        };
      } else {
        this.logger.warn(
          `Meta-transaction submission failed: ${response.data.error}`
        );
        return {
          success: false,
          error: response.data.error || 'Unknown relayer error',
        };
      }
    } catch (error) {
      this.logger.error('Failed to submit meta-transaction to relayer:', error);

      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        throw new GaslessSDKError(
          `Relayer error: ${message}`,
          ErrorCodes.RELAYER_ERROR,
          error
        );
      }

      throw new GaslessSDKError(
        'Failed to communicate with relayer',
        ErrorCodes.NETWORK_ERROR,
        error
      );
    }
  }

  public async getTransactionStatus(
    transactionHash: string
  ): Promise<RelayerResponse> {
    try {
      this.logger.info(
        `Checking transaction status for: ${transactionHash}`
      );

      const response = await this.httpClient.get(
        `/api/v1/status/${transactionHash}`
      );

      if (response.data.success) {
        return {
          success: true,
          transactionHash: response.data.transactionHash,
          gasUsed: response.data.gasUsed,
          effectiveGasPrice: response.data.effectiveGasPrice,
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Transaction not found or failed',
        };
      }
    } catch (error) {
      this.logger.error('Failed to get transaction status:', error);

      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        throw new GaslessSDKError(
          `Relayer error: ${message}`,
          ErrorCodes.RELAYER_ERROR,
          error
        );
      }

      throw new GaslessSDKError(
        'Failed to communicate with relayer',
        ErrorCodes.NETWORK_ERROR,
        error
      );
    }
  }

  /**
   * Check relayer status and health
   */
  public async checkStatus(): Promise<{ status: string; chainIds: number[] }> {
    try {
      const response = await this.httpClient.get('/api/v1/status');
      return {
        status: response.data.status || 'unknown',
        chainIds: response.data.supportedChains || [],
      };
    } catch (error) {
      this.logger.error('Failed to check relayer status:', error);
      throw new GaslessSDKError(
        'Failed to check relayer status',
        ErrorCodes.RELAYER_ERROR,
        error
      );
    }
  }

  /**
   * Get relayer fee information for a chain
   */
  public async getRelayerFees(
    chainId: number
  ): Promise<{ baseFee: string; gasPrice: string }> {
    try {
      const response = await this.httpClient.get(`/api/v1/fees/${chainId}`);
      return {
        baseFee: response.data.baseFee || '0',
        gasPrice: response.data.gasPrice || '0',
      };
    } catch (error) {
      this.logger.error('Failed to get relayer fees:', error);
      throw new GaslessSDKError(
        'Failed to get relayer fees',
        ErrorCodes.RELAYER_ERROR,
        error
      );
    }
  }

  /**
   * Update relayer endpoint
   */
  public updateEndpoint(newBaseURL: string): void {
    this.baseURL = newBaseURL;
    this.httpClient.defaults.baseURL = newBaseURL;
    this.logger.info(`Relayer endpoint updated to: ${newBaseURL}`);
  }
}
