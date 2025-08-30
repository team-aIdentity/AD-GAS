import {
  GaslessSDKConfig,
  GaslessTransaction,
  MetaTransaction,
  NetworkConfig,
  RelayerRequest,
  RelayerResponse,
  TransactionCallback,
  WalletInterface,
  GaslessSDKError,
  ErrorCodes,
  BigNumber,
  IRelayerService,
  IPaymasterService,
  INetworkManager,
  ITransactionBuilder,
  ISignatureValidator,
} from '../types';
import { RelayerService } from '../relayer/RelayerService';
import { PaymasterService } from '../paymaster/PaymasterService';
import { PaymasterManager } from '../paymaster/PaymasterManager';
import { TokenPaymaster } from '../paymaster/TokenPaymaster';
import { NetworkManager } from '../networks/NetworkManager';
import { TransactionBuilder } from './TransactionBuilder';
import { SignatureValidator } from '../utils/SignatureValidator';
import { Logger } from '../utils/Logger';

export class GaslessSDK {
  private config: GaslessSDKConfig;
  private relayerService: IRelayerService;
  private paymasterService: IPaymasterService;
  private paymasterManager: PaymasterManager;
  private networkManager: INetworkManager;
  private transactionBuilder: ITransactionBuilder;
  private signatureValidator: ISignatureValidator;
  private logger: Logger;
  private wallet?: WalletInterface;

  constructor(
    config: GaslessSDKConfig,
    services?: {
      relayerService?: IRelayerService;
      paymasterService?: IPaymasterService;
      networkManager?: INetworkManager;
      transactionBuilder?: ITransactionBuilder;
      signatureValidator?: ISignatureValidator;
    }
  ) {
    this.config = config;
    this.logger = new Logger(config.debug || false);

    // Use provided services or create default instances
    this.networkManager =
      services?.networkManager || new NetworkManager(config.networks);
    this.relayerService =
      services?.relayerService ||
      new RelayerService(config.relayerEndpoint, this.logger);
    this.paymasterService =
      services?.paymasterService ||
      new PaymasterService(config.paymasterEndpoint, this.logger);
    this.transactionBuilder =
      services?.transactionBuilder || new TransactionBuilder(this.networkManager);
    this.signatureValidator =
      services?.signatureValidator || new SignatureValidator();

    // Initialize paymaster manager
    this.paymasterManager = new PaymasterManager(
      new JsonRpcProvider(this.networkManager.getCurrentNetwork().rpcUrl),
      '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // Standard EntryPoint
      this.logger
    );

    this.logger.info(
      'GaslessSDK initialized with config:',
      this.networkManager.getAvailableNetworks().length,
      'networks'
    );
  }

  /**
   * Connect a wallet to the SDK
   */
  public async connectWallet(wallet: WalletInterface): Promise<void> {
    this.wallet = wallet;
    const address = await wallet.getAddress();
    const chainId = await wallet.getChainId();
    
    this.logger.info(`Wallet connected: ${address} on chain ${chainId}`);
  }

  /**
   * Send a gasless transaction
   */
  public async sendGaslessTransaction(
    transaction: Partial<GaslessTransaction>,
    onProgress?: TransactionCallback
  ): Promise<RelayerResponse> {
    if (!this.wallet) {
      throw new GaslessSDKError('Wallet not connected', ErrorCodes.INVALID_SIGNATURE);
    }

    try {
      // Build the complete transaction
      const completeTransaction = await this.transactionBuilder.buildTransaction(
        transaction,
        this.wallet
      );

      // Sign the transaction
      const signature = await this.signTransaction(completeTransaction);
      completeTransaction.signature = signature;

      // Validate signature
      if (!this.signatureValidator.validateSignature(completeTransaction, signature)) {
        throw new GaslessSDKError('Invalid signature', ErrorCodes.INVALID_SIGNATURE);
      }

      // Create relayer request
      const relayerRequest: RelayerRequest = {
        transaction: completeTransaction,
        signature,
        chainId: await this.wallet.getChainId(),
      };

      // Submit to relayer
      onProgress?.({
        type: 'submitted',
        transactionHash: '', // Will be filled by relayer
      });

      const response = await this.relayerService.submitTransaction(relayerRequest);

      if (response.success && response.transactionHash) {
        onProgress?.({
          type: 'confirmed',
          transactionHash: response.transactionHash,
          gasUsed: response.gasUsed,
        });
      } else {
        onProgress?.({
          type: 'failed',
          transactionHash: '',
          error: response.error,
        });
      }

      return response;
    } catch (error) {
      this.logger.error('Failed to send gasless transaction:', error);
      
      if (error instanceof GaslessSDKError) {
        throw error;
      }
      
      throw new GaslessSDKError(
        'Transaction failed',
        ErrorCodes.TRANSACTION_FAILED,
        error
      );
    }
  }

  /**
   * Send a meta-transaction with EIP-2771 support
   */
  public async sendMetaTransaction(
    transaction: Partial<MetaTransaction>,
    onProgress?: TransactionCallback
  ): Promise<RelayerResponse> {
    if (!this.wallet) {
      throw new GaslessSDKError('Wallet not connected', ErrorCodes.INVALID_SIGNATURE);
    }

    try {
      const metaTransaction = await this.transactionBuilder.buildMetaTransaction(
        transaction,
        this.wallet
      );

      const signature = await this.signMetaTransaction(metaTransaction);
      
      const relayerRequest: RelayerRequest = {
        transaction: {
          to: metaTransaction.to,
          data: metaTransaction.data,
          value: metaTransaction.value,
          gasLimit: metaTransaction.gasLimit,
          nonce: metaTransaction.nonce,
          signature,
        },
        signature,
        chainId: await this.wallet.getChainId(),
      };

      onProgress?.({
        type: 'submitted',
        transactionHash: '',
      });

      const response = await this.relayerService.submitMetaTransaction(relayerRequest);

      if (response.success && response.transactionHash) {
        onProgress?.({
          type: 'confirmed',
          transactionHash: response.transactionHash,
          gasUsed: response.gasUsed,
        });
      } else {
        onProgress?.({
          type: 'failed',
          transactionHash: '',
          error: response.error,
        });
      }

      return response;
    } catch (error) {
      this.logger.error('Failed to send meta-transaction:', error);
      throw new GaslessSDKError(
        'Meta-transaction failed',
        ErrorCodes.TRANSACTION_FAILED,
        error
      );
    }
  }

  /**
   * Estimate gas for a gasless transaction
   */
  public async estimateGas(transaction: Partial<GaslessTransaction>): Promise<BigNumber> {
    if (!this.wallet) {
      throw new GaslessSDKError('Wallet not connected', ErrorCodes.INVALID_SIGNATURE);
    }

    return this.transactionBuilder.estimateGas(transaction, this.wallet);
  }

  /**
   * Get current network configuration
   */
  public getCurrentNetwork(): NetworkConfig {
    return this.networkManager.getCurrentNetwork();
  }

  /**
   * Switch to a different network
   */
  public async switchNetwork(chainId: number): Promise<void> {
    await this.networkManager.switchNetwork(chainId);
    this.logger.info(`Switched to network: ${chainId}`);
  }

  /**
   * Get available networks
   */
  public getAvailableNetworks(): NetworkConfig[] {
    return this.networkManager.getAvailableNetworks();
  }

  /**
   * Sign a gasless transaction
   */
  private async signTransaction(transaction: GaslessTransaction): Promise<string> {
    if (!this.wallet) {
      throw new GaslessSDKError('Wallet not connected', ErrorCodes.INVALID_SIGNATURE);
    }

    const message = this.transactionBuilder.getTransactionMessage(transaction);
    return this.wallet.signMessage(message);
  }

  /**
   * Sign a meta-transaction with EIP-712
   */
  private async signMetaTransaction(metaTransaction: MetaTransaction): Promise<string> {
    if (!this.wallet) {
      throw new GaslessSDKError('Wallet not connected', ErrorCodes.INVALID_SIGNATURE);
    }

    const { domain, types, value } = this.transactionBuilder.getEIP712Data(metaTransaction);
    return this.wallet.signTypedData(domain, types, value);
  }

  /**
   * Disconnect wallet and cleanup
   */
  public disconnect(): void {
    this.wallet = undefined;
    this.logger.info('Wallet disconnected');
  }

  /**
   * Get paymaster service instance
   */
  public getPaymasterService(): IPaymasterService {
    return this.paymasterService;
  }

  /**
   * Get paymaster manager for advanced paymaster operations
   */
  public getPaymasterManager(): PaymasterManager {
    return this.paymasterManager;
  }

  /**
   * Get relayer service instance  
   */
  public getRelayerService(): RelayerService {
    return this.relayerService;
  }

  /**
   * Get SDK configuration
   */
  public getConfig(): GaslessSDKConfig {
    return this.config;
  }

  /**
   * Send gasless transaction with automatic paymaster selection
   */
  public async sendSponsoredTransaction(
    transaction: Partial<GaslessTransaction>,
    onProgress?: TransactionCallback
  ): Promise<RelayerResponse> {
    if (!this.wallet) {
      throw new GaslessSDKError('Wallet not connected', ErrorCodes.INVALID_SIGNATURE);
    }

    try {
      this.logger.info('Sending sponsored transaction with automatic paymaster selection');

      // Build the transaction
      const completeTransaction = await this.transactionBuilder.buildTransaction(
        transaction,
        this.wallet
      );

      // Convert to UserOperation for paymaster processing
      const userOp: UserOperation = {
        sender: await this.wallet.getAddress(),
        nonce: completeTransaction.nonce || 0,
        initCode: '0x',
        callData: completeTransaction.data,
        callGasLimit: completeTransaction.gasLimit || 200000,
        verificationGasLimit: 100000,
        preVerificationGas: 21000,
        maxFeePerGas: await this.transactionBuilder.getGasPrice(),
        maxPriorityFeePerGas: await this.transactionBuilder.getGasPrice(),
        paymasterAndData: '0x',
        signature: '0x',
      };

      // Find best paymaster and get sponsorship
      const chainId = await this.wallet.getChainId();
      const maxCost = BigInt(userOp.callGasLimit) * BigInt(userOp.maxFeePerGas);
      
      const paymasterResult = await this.paymasterManager.validateWithBestPaymaster(
        userOp,
        chainId,
        maxCost
      );

      if (!paymasterResult) {
        throw new GaslessSDKError(
          'No paymaster available for sponsorship',
          ErrorCodes.PAYMASTER_ERROR
        );
      }

      // Update transaction with paymaster data
      const sponsoredTransaction: GaslessTransaction = {
        ...completeTransaction,
        signature: await this.signTransaction(completeTransaction),
      };

      // Submit via relayer with paymaster info
      onProgress?.({
        type: 'submitted',
        transactionHash: '',
      });

      const relayerRequest: RelayerRequest = {
        transaction: sponsoredTransaction,
        signature: sponsoredTransaction.signature!,
        chainId,
      };

      const response = await this.relayerService.submitTransaction(relayerRequest);

      // Execute paymaster postOp if transaction succeeded
      if (response.success && response.transactionHash) {
        try {
          const paymaster = this.paymasterManager.getRegisteredPaymasters()
            .find(p => p.id === paymasterResult.paymasterId)?.paymaster;

          if (paymaster) {
            await paymaster.postOp({
              mode: 1, // opSucceeded
              context: paymasterResult.validation.context,
              actualGasCost: response.gasUsed || 0,
              actualUserOpFeePerGas: response.effectiveGasPrice || 0,
            });
          }
        } catch (postOpError) {
          this.logger.warn('PostOp execution failed:', postOpError);
        }

        onProgress?.({
          type: 'confirmed',
          transactionHash: response.transactionHash,
          gasUsed: response.gasUsed,
        });
      } else {
        onProgress?.({
          type: 'failed',
          transactionHash: '',
          error: response.error,
        });
      }

      return response;
    } catch (error) {
      this.logger.error('Failed to send sponsored transaction:', error);
      throw new GaslessSDKError(
        'Sponsored transaction failed',
        ErrorCodes.TRANSACTION_FAILED,
        error
      );
    }
  }

  /**
   * Register a token paymaster for ERC-20 gas payments
   */
  public async registerTokenPaymaster(
    id: string,
    tokenAddress: string,
    exchangeRate: BigNumber,
    paymasterAddress: string,
    minBalance?: BigNumber
  ): Promise<void> {
    try {
      const network = this.networkManager.getCurrentNetwork();
      const provider = new JsonRpcProvider(network.rpcUrl);

      const tokenConfig = {
        tokenAddress,
        tokenDecimals: 18, // Default, should be fetched from token contract
        exchangeRate,
        minBalance: minBalance || BigInt(1000),
        maxGasPrice: BigInt('100000000000'), // 100 gwei
      };

      const tokenPaymaster = new TokenPaymaster(
        tokenConfig,
        paymasterAddress,
        provider,
        this.logger
      );

      this.paymasterManager.registerPaymaster(id, tokenPaymaster);
      this.logger.info(`Token paymaster registered: ${id} for token: ${tokenAddress}`);
    } catch (error) {
      this.logger.error('Failed to register token paymaster:', error);
      throw new GaslessSDKError(
        'Failed to register token paymaster',
        ErrorCodes.PAYMASTER_ERROR,
        error
      );
    }
  }

  /**
   * Get available paymasters
   */
  public getAvailablePaymasters(): Array<{ id: string; paymaster: IPaymasterService }> {
    return this.paymasterManager.getRegisteredPaymasters();
  }

  /**
   * Get SDK version
   */
  public getVersion(): string {
    return '1.0.0';
  }
}
