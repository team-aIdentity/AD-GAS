import axios, { AxiosInstance } from 'axios';
import { ethers, Contract, JsonRpcProvider } from 'ethers';
import { BigNumber } from '../types';
import {
  PaymasterRequest,
  PaymasterResponse,
  UserOperation,
  GaslessSDKError,
  ErrorCodes,
  PaymasterValidationResult,
  PaymasterPostOpContext,
  PaymasterStakeInfo,
  TokenPaymasterConfig,
  PaymasterPolicy,
  IPaymasterService,
} from '../types';
import { Logger } from '../utils/Logger';

export class PaymasterService implements IPaymasterService {
  private baseURL: string;
  private httpClient: AxiosInstance;
  private logger: Logger;
  private provider?: JsonRpcProvider;
  private paymasterAddress?: string;
  private entryPointAddress: string;

  constructor(
    baseURL?: string, 
    logger?: Logger, 
    provider?: JsonRpcProvider,
    paymasterAddress?: string,
    entryPointAddress?: string
  ) {
    this.baseURL = baseURL || 'https://paymaster.gasless-sdk.com';
    this.logger = logger || new Logger(false);
    this.provider = provider;
    this.paymasterAddress = paymasterAddress;
    this.entryPointAddress = entryPointAddress || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
    
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
      config => {
        this.logger.debug_log('Paymaster request:', config);
        return config;
      },
      error => {
        this.logger.error('Paymaster request error:', error);
        return Promise.reject(error);
      }
    );

    this.httpClient.interceptors.response.use(
      response => {
        this.logger.debug_log('Paymaster response:', response.data);
        return response;
      },
      error => {
        this.logger.error('Paymaster response error:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Request paymaster sponsorship for a user operation
   */
  public async sponsorTransaction(
    request: PaymasterRequest
  ): Promise<PaymasterResponse> {
    try {
      this.logger.info('Requesting paymaster sponsorship');

      const response = await this.httpClient.post('/api/v1/sponsor', {
        userOp: {
          sender: request.userOp.sender,
          nonce: request.userOp.nonce.toString(),
          initCode: request.userOp.initCode,
          callData: request.userOp.callData,
          callGasLimit: request.userOp.callGasLimit.toString(),
          verificationGasLimit:
            request.userOp.verificationGasLimit.toString(),
          preVerificationGas: request.userOp.preVerificationGas.toString(),
          maxFeePerGas: request.userOp.maxFeePerGas.toString(),
          maxPriorityFeePerGas:
            request.userOp.maxPriorityFeePerGas.toString(),
          paymasterAndData: request.userOp.paymasterAndData,
          signature: request.userOp.signature,
        },
        entryPoint: request.entryPoint,
        chainId: request.chainId,
      });

      if (response.data.success) {
        this.logger.info('Paymaster sponsorship approved');
        return {
          paymasterAndData: response.data.paymasterAndData,
          preVerificationGas: response.data.preVerificationGas,
          verificationGasLimit: response.data.verificationGasLimit,
          callGasLimit: response.data.callGasLimit,
        };
      } else {
        throw new GaslessSDKError(
          response.data.error || 'Paymaster sponsorship denied',
          ErrorCodes.PAYMASTER_ERROR
        );
      }
    } catch (error) {
      this.logger.error('Failed to request paymaster sponsorship:', error);

      if (error instanceof GaslessSDKError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        throw new GaslessSDKError(
          `Paymaster error: ${message}`,
          ErrorCodes.PAYMASTER_ERROR,
          error
        );
      }

      throw new GaslessSDKError(
        'Failed to communicate with paymaster',
        ErrorCodes.NETWORK_ERROR,
        error
      );
    }
  }

  public async getPaymasterInfo(): Promise<any> {
    return this.getStatus();
  }

  /**
   * Check if paymaster can sponsor a user operation
   */
  public async canSponsor(
    sender: string,
    callData: string,
    chainId: number
  ): Promise<{ canSponsor: boolean; reason?: string }> {
    try {
      this.logger.info('Checking paymaster sponsorship eligibility');

      const response = await this.httpClient.post('/api/v1/can-sponsor', {
        sender,
        callData,
        chainId,
      });

      return {
        canSponsor: response.data.canSponsor || false,
        reason: response.data.reason,
      };
    } catch (error) {
      this.logger.error('Failed to check paymaster sponsorship eligibility:', error);
      return {
        canSponsor: false,
        reason: 'Failed to communicate with paymaster',
      };
    }
  }

  /**
   * Get paymaster gas estimates
   */
  public async getGasEstimates(
    userOp: Partial<UserOperation>,
    chainId: number
  ): Promise<{
    preVerificationGas: BigNumber;
    verificationGasLimit: BigNumber;
    callGasLimit: BigNumber;
  }> {
    try {
      this.logger.info('Getting paymaster gas estimates');

      const response = await this.httpClient.post('/api/v1/gas-estimates', {
        userOp: {
          sender: userOp.sender,
          nonce: userOp.nonce?.toString(),
          initCode: userOp.initCode || '0x',
          callData: userOp.callData || '0x',
        },
        chainId,
      });

      return {
        preVerificationGas: response.data.preVerificationGas || '21000',
        verificationGasLimit: response.data.verificationGasLimit || '100000',
        callGasLimit: response.data.callGasLimit || '200000',
      };
    } catch (error) {
      this.logger.error('Failed to get paymaster gas estimates:', error);
      
      // Return default estimates if service is unavailable
      return {
        preVerificationGas: '21000',
        verificationGasLimit: '100000',
        callGasLimit: '200000',
      };
    }
  }

  /**
   * Get paymaster status and supported features
   */
  public async getStatus(): Promise<{
    status: string;
    supportedChains: number[];
    sponsorshipLimits: Record<string, any>;
  }> {
    try {
      const response = await this.httpClient.get('/api/v1/status');
      return {
        status: response.data.status || 'unknown',
        supportedChains: response.data.supportedChains || [],
        sponsorshipLimits: response.data.sponsorshipLimits || {},
      };
    } catch (error) {
      this.logger.error('Failed to get paymaster status:', error);
      throw new GaslessSDKError(
        'Failed to get paymaster status',
        ErrorCodes.PAYMASTER_ERROR,
        error
      );
    }
  }

  /**
   * Update paymaster endpoint
   */
  public updateEndpoint(newBaseURL: string): void {
    this.baseURL = newBaseURL;
    this.httpClient.defaults.baseURL = newBaseURL;
    this.logger.info(`Paymaster endpoint updated to: ${newBaseURL}`);
  }

  /**
   * Set authentication token for paymaster requests
   */
  public setAuthToken(token: string): void {
    this.httpClient.defaults.headers.Authorization = `Bearer ${token}`;
    this.logger.info('Paymaster authentication token updated');
  }

  /**
   * Validate paymaster user operation (EIP-4337 compliant)
   */
  public async validatePaymasterUserOp(
    userOp: UserOperation,
    maxCost: BigNumber
  ): Promise<PaymasterValidationResult> {
    try {
      this.logger.info('Validating paymaster user operation');

      if (!this.paymasterAddress || !this.provider) {
        throw new GaslessSDKError(
          'Paymaster address and provider required for validation',
          ErrorCodes.PAYMASTER_ERROR
        );
      }

      // EIP-4337 paymaster validation ABI
      const paymasterAbi = [
        'function validatePaymasterUserOp(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash, uint256 maxCost) external returns (bytes context, uint256 validationData)',
      ];

      const paymasterContract = new Contract(
        this.paymasterAddress,
        paymasterAbi,
        this.provider
      );

      // Calculate user operation hash
      const userOpHash = this.calculateUserOpHash(userOp);

      // Call validatePaymasterUserOp
      const result = await paymasterContract.validatePaymasterUserOp(
        [
          userOp.sender,
          userOp.nonce,
          userOp.initCode,
          userOp.callData,
          userOp.callGasLimit,
          userOp.verificationGasLimit,
          userOp.preVerificationGas,
          userOp.maxFeePerGas,
          userOp.maxPriorityFeePerGas,
          userOp.paymasterAndData,
          userOp.signature,
        ],
        userOpHash,
        maxCost
      );

      // Parse validation data (EIP-4337 format)
      const validationData = result[1];
      const context = result[0];

      // Extract validation info from packed data
      const validAfter = Number((validationData >> BigInt(160)) & BigInt(0xffffffffffff));
      const validUntil = Number((validationData >> BigInt(208)) & BigInt(0xffffffffffff));
      const authorizer = validationData & BigInt(0xffffffffffffffffffffffffffffffffffffffff);

      return {
        context,
        validAfter,
        validUntil,
        authorizer: authorizer !== BigInt(0) ? `0x${authorizer.toString(16).padStart(40, '0')}` : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to validate paymaster user operation:', error);
      throw new GaslessSDKError(
        'Failed to validate paymaster user operation',
        ErrorCodes.PAYMASTER_ERROR,
        error
      );
    }
  }

  /**
   * Post-operation hook for paymaster (EIP-4337 compliant)
   */
  public async postOp(context: PaymasterPostOpContext): Promise<void> {
    try {
      this.logger.info('Executing paymaster post-operation hook');

      if (!this.paymasterAddress || !this.provider) {
        this.logger.warn('Paymaster address and provider required for postOp, skipping');
        return;
      }

      const paymasterAbi = [
        'function postOp(uint8 mode, bytes context, uint256 actualGasCost, uint256 actualUserOpFeePerGas) external',
      ];

      const paymasterContract = new Contract(
        this.paymasterAddress,
        paymasterAbi,
        this.provider
      );

      // Execute postOp hook
      await paymasterContract.postOp(
        context.mode,
        context.context,
        context.actualGasCost,
        context.actualUserOpFeePerGas
      );

      this.logger.info('Paymaster post-operation hook executed successfully');
    } catch (error) {
      this.logger.error('Failed to execute paymaster post-operation hook:', error);
      // Don't throw error as postOp failures shouldn't block the main operation
    }
  }

  /**
   * Get paymaster stake information
   */
  public async getStakeInfo(): Promise<PaymasterStakeInfo> {
    try {
      if (!this.paymasterAddress || !this.provider) {
        throw new GaslessSDKError(
          'Paymaster address and provider required',
          ErrorCodes.PAYMASTER_ERROR
        );
      }

      // EntryPoint contract ABI for deposit info
      const entryPointAbi = [
        'function getDepositInfo(address account) view returns (tuple(uint256 deposit, bool staked, uint256 stake, uint32 unstakeDelaySec, uint48 withdrawTime))',
      ];

      const entryPointContract = new Contract(
        this.entryPointAddress,
        entryPointAbi,
        this.provider
      );

      const depositInfo = await entryPointContract.getDepositInfo(this.paymasterAddress);

      return {
        stake: depositInfo.stake,
        unstakeDelaySec: depositInfo.unstakeDelaySec,
        withdrawTime: depositInfo.withdrawTime,
      };
    } catch (error) {
      this.logger.error('Failed to get paymaster stake info:', error);
      throw new GaslessSDKError(
        'Failed to get paymaster stake info',
        ErrorCodes.PAYMASTER_ERROR,
        error
      );
    }
  }

  /**
   * Calculate user operation hash according to EIP-4337
   */
  private calculateUserOpHash(userOp: UserOperation): string {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    
    // Pack user operation according to EIP-4337
    const packedUserOp = abiCoder.encode(
      [
        'address',
        'uint256',
        'bytes32',
        'bytes32', 
        'uint256',
        'uint256',
        'uint256',
        'uint256',
        'uint256',
        'bytes32',
      ],
      [
        userOp.sender,
        userOp.nonce,
        ethers.keccak256(userOp.initCode),
        ethers.keccak256(userOp.callData),
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        ethers.keccak256(userOp.paymasterAndData),
      ]
    );

    const encoded = abiCoder.encode(
      ['bytes32', 'address', 'uint256'],
      [ethers.keccak256(packedUserOp), this.entryPointAddress, 1] // chainId would be dynamic
    );

    return ethers.keccak256(encoded);
  }

  /**
   * Set provider for on-chain operations
   */
  public setProvider(provider: JsonRpcProvider): void {
    this.provider = provider;
    this.logger.info('Paymaster provider updated');
  }

  /**
   * Set paymaster contract address
   */
  public setPaymasterAddress(address: string): void {
    this.paymasterAddress = address;
    this.logger.info(`Paymaster address updated to: ${address}`);
  }

  /**
   * Get current paymaster address
   */
  public getPaymasterAddress(): string | undefined {
    return this.paymasterAddress;
  }

  /**
   * Set EntryPoint address
   */
  public setEntryPointAddress(address: string): void {
    this.entryPointAddress = address;
    this.logger.info(`EntryPoint address updated to: ${address}`);
  }
}
