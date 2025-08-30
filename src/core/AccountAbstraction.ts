import { ethers, JsonRpcProvider, keccak256, AbiCoder } from 'ethers';
import {
  UserOperation,
  PaymasterRequest,
  GaslessSDKError,
  ErrorCodes,
  BigNumber,
} from '../types';
import { PaymasterService } from '../paymaster/PaymasterService';
import { Logger } from '../utils/Logger';

export class AccountAbstraction {
  private paymasterService: PaymasterService;
  private logger: Logger;
  private entryPointAddress: string;

  constructor(paymasterService: PaymasterService, logger: Logger, entryPointAddress?: string) {
    this.paymasterService = paymasterService;
    this.logger = logger;
    this.entryPointAddress = entryPointAddress || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'; // Standard EntryPoint v0.6
  }

  /**
   * Create a User Operation for Account Abstraction
   */
  public async createUserOperation(
    sender: string,
    callData: string,
    initCode: string = '0x',
    chainId: number,
    provider: JsonRpcProvider
  ): Promise<UserOperation> {
    try {
      this.logger.info('Creating User Operation for Account Abstraction');

      // Get gas estimates from paymaster
      const gasEstimates = await this.paymasterService.getGasEstimates(
        {
          sender,
          callData,
          initCode,
        },
        chainId
      );

      // Get fee data from network
      const feeData = await provider.getFeeData();

      // Get nonce for the smart account
      const nonce = await this.getAccountNonce(sender, provider);

      const userOp: UserOperation = {
        sender,
        nonce,
        initCode,
        callData,
        callGasLimit: gasEstimates.callGasLimit,
        verificationGasLimit: gasEstimates.verificationGasLimit,
        preVerificationGas: gasEstimates.preVerificationGas,
        maxFeePerGas: feeData.maxFeePerGas || 0,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || 0,
        paymasterAndData: '0x',
        signature: '0x',
      };

      this.logger.debug_log('Created User Operation:', userOp);
      return userOp;
    } catch (error) {
      this.logger.error('Failed to create User Operation:', error);
      throw new GaslessSDKError(
        'Failed to create User Operation',
        ErrorCodes.PAYMASTER_ERROR,
        error
      );
    }
  }

  /**
   * Get paymaster sponsorship for a User Operation
   */
  public async getSponsoredUserOperation(
    userOp: UserOperation,
    chainId: number
  ): Promise<UserOperation> {
    try {
      this.logger.info('Requesting paymaster sponsorship for User Operation');

      const paymasterRequest: PaymasterRequest = {
        userOp,
        entryPoint: this.entryPointAddress,
        chainId,
      };

      const paymasterResponse = await this.paymasterService.requestSponsorship(paymasterRequest);

      // Update the User Operation with paymaster data
      const sponsoredUserOp: UserOperation = {
        ...userOp,
        paymasterAndData: paymasterResponse.paymasterAndData,
        callGasLimit: paymasterResponse.callGasLimit,
        verificationGasLimit: paymasterResponse.verificationGasLimit,
        preVerificationGas: paymasterResponse.preVerificationGas,
      };

      this.logger.info('User Operation sponsored successfully');
      return sponsoredUserOp;
    } catch (error) {
      this.logger.error('Failed to get paymaster sponsorship:', error);
      throw new GaslessSDKError(
        'Failed to get paymaster sponsorship',
        ErrorCodes.PAYMASTER_ERROR,
        error
      );
    }
  }

  /**
   * Submit User Operation to the bundler
   */
  public async submitUserOperation(
    userOp: UserOperation,
    chainId: number,
    bundlerUrl?: string
  ): Promise<{ userOpHash: string; bundlerResponse: any }> {
    try {
      this.logger.info('Submitting User Operation to bundler');

      const bundler = bundlerUrl || `https://bundler.gasless-sdk.com/${chainId}`;
      
      const response = await fetch(bundler, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'eth_sendUserOperation',
          params: [userOp, this.entryPointAddress],
        }),
      });

      const result = await response.json();

      if (result.error) {
        throw new GaslessSDKError(
          result.error.message || 'Bundler error',
          ErrorCodes.TRANSACTION_FAILED,
          result.error
        );
      }

      this.logger.info(`User Operation submitted: ${result.result}`);
      return {
        userOpHash: result.result,
        bundlerResponse: result,
      };
    } catch (error) {
      this.logger.error('Failed to submit User Operation:', error);
      throw new GaslessSDKError(
        'Failed to submit User Operation',
        ErrorCodes.TRANSACTION_FAILED,
        error
      );
    }
  }

  /**
   * Get User Operation receipt
   */
  public async getUserOperationReceipt(
    userOpHash: string,
    chainId: number,
    bundlerUrl?: string
  ): Promise<any> {
    try {
      const bundler = bundlerUrl || `https://bundler.gasless-sdk.com/${chainId}`;
      
      const response = await fetch(bundler, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'eth_getUserOperationReceipt',
          params: [userOpHash],
        }),
      });

      const result = await response.json();

      if (result.error) {
        this.logger.warn(`User Operation receipt not found: ${result.error.message}`);
        return null;
      }

      return result.result;
    } catch (error) {
      this.logger.error('Failed to get User Operation receipt:', error);
      return null;
    }
  }

  /**
   * Get account nonce from EntryPoint
   */
  private async getAccountNonce(account: string, provider: JsonRpcProvider): Promise<BigNumber> {
    try {
      // EntryPoint contract ABI for getNonce function
      const entryPointAbi = [
        'function getNonce(address sender, uint192 key) view returns (uint256 nonce)',
      ];

      const entryPointContract = new ethers.Contract(
        this.entryPointAddress,
        entryPointAbi,
        provider
      );

      const nonce = await entryPointContract.getNonce(account, 0);
      return nonce;
    } catch (error) {
      this.logger.warn('Failed to get account nonce from EntryPoint, using 0:', error);
      return 0;
    }
  }

  /**
   * Calculate User Operation hash
   */
  public calculateUserOperationHash(userOp: UserOperation, chainId: number): string {
    const abiCoder = AbiCoder.defaultAbiCoder();
    
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
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        keccak256(userOp.paymasterAndData),
      ]
    );

    const encoded = abiCoder.encode(
      ['bytes32', 'address', 'uint256'],
      [keccak256(packedUserOp), this.entryPointAddress, chainId]
    );

    return keccak256(encoded);
  }

  /**
   * Set custom EntryPoint address
   */
  public setEntryPointAddress(address: string): void {
    this.entryPointAddress = address;
    this.logger.info(`EntryPoint address updated to: ${address}`);
  }

  /**
   * Get current EntryPoint address
   */
  public getEntryPointAddress(): string {
    return this.entryPointAddress;
  }
}
