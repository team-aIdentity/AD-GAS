import {
  GaslessSDKConfig,
  WalletInterface,
  GaslessSDKError,
  ErrorCodes,
  UserOperation,
  UserOperationRequest,
  BundlerResponse,
  UserOperationReceipt,
} from '../types';
import { Logger } from '../utils/Logger';

export class GaslessSDK {
  private logger: Logger;
  private wallet?: WalletInterface;
  private bundlerEndpoint: string;
  private entryPointAddress: string;

  constructor(config: GaslessSDKConfig) {
    this.logger = new Logger(config.debug || false);

    // Account Abstraction 설정
    this.bundlerEndpoint = config.bundlerEndpoint || 'https://bundler.example.com/rpc';
    this.entryPointAddress = config.entryPointAddress || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

    this.logger.info('GaslessSDK initialized for Account Abstraction');
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
   * Disconnect wallet
   */
  public disconnect(): void {
    this.wallet = undefined;
    this.logger.info('Wallet disconnected');
  }

  /**
   * Get SDK version
   */
  public getVersion(): string {
    return '1.0.0';
  }

  // ========================================
  // Account Abstraction (EIP-4337) Methods
  // ========================================

  /**
   * Convert regular transaction to UserOperation
   */
  public async createUserOperation(
    transaction: {
      to: string;
      value?: bigint;
      data?: string;
    }
  ): Promise<UserOperationRequest> {
    if (!this.wallet) {
      throw new GaslessSDKError('Wallet not connected', ErrorCodes.INVALID_SIGNATURE);
    }

    const smartAccountAddress = await this.getSmartAccountAddress();
    const nonce = await this.getUserOperationNonce(smartAccountAddress);
    
    // Call data 생성 (Smart Account의 execute 함수 호출)
    const callData = this.encodeExecuteCall({
      to: transaction.to,
      value: transaction.value || BigInt(0),
      data: transaction.data || '0x',
    });

    // 가스 추정
    const gasEstimates = await this.estimateUserOperationGas({
      sender: smartAccountAddress,
      callData,
    });

    return {
      sender: smartAccountAddress,
      nonce: `0x${nonce.toString(16)}`,
      initCode: '0x', // 이미 배포된 Smart Account의 경우
      callData,
      callGasLimit: `0x${gasEstimates.callGasLimit.toString(16)}`,
      verificationGasLimit: `0x${gasEstimates.verificationGasLimit.toString(16)}`,
      preVerificationGas: `0x${gasEstimates.preVerificationGas.toString(16)}`,
      maxFeePerGas: `0x${gasEstimates.maxFeePerGas.toString(16)}`,
      maxPriorityFeePerGas: `0x${gasEstimates.maxPriorityFeePerGas.toString(16)}`,
      paymasterAndData: '0x', // Paymaster 사용 시 설정
    };
  }

  /**
   * Sign UserOperation with connected wallet
   */
  public async signUserOperation(
    userOpRequest: UserOperationRequest,
    provider?: any // Wagmi provider를 직접 전달받을 수 있음
  ): Promise<string> {
    if (!this.wallet) {
      throw new GaslessSDKError('Wallet not connected', ErrorCodes.INVALID_SIGNATURE);
    }

    this.logger.info('🔐 UserOperation 서명 시작');

        // Smart Account 주소를 verifyingContract로 사용
    const smartAccountAddress = await this.getSmartAccountAddress();
    
    // EIP-712 도메인 및 타입 정의
    const domain = {
      name: 'Account Abstraction',
      version: '1',
      chainId: await this.wallet.getChainId(),
      verifyingContract: smartAccountAddress as `0x${string}`, // Smart Account 주소 사용
    };

    const types = {
      UserOperation: [
        { name: 'sender', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'initCode', type: 'bytes' },
        { name: 'callData', type: 'bytes' },
        { name: 'callGasLimit', type: 'uint256' },
        { name: 'verificationGasLimit', type: 'uint256' },
        { name: 'preVerificationGas', type: 'uint256' },
        { name: 'maxFeePerGas', type: 'uint256' },
        { name: 'maxPriorityFeePerGas', type: 'uint256' },
        { name: 'paymasterAndData', type: 'bytes' },
      ],
    };

    // Provider가 전달된 경우 직접 사용
    if (provider) {
      this.logger.info('📡 Provider를 통한 직접 서명 요청');
      
      // verifyingContract 제거로 MetaMask 호환성 향상
      const typedData = {
        domain: {
          name: 'Account Abstraction',
          version: '1',
          chainId: await this.wallet.getChainId(),
          // verifyingContract 제거 - MetaMask 오류 방지
        },
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            // verifyingContract 타입 정의도 제거
          ],
          UserOperation: [
            { name: 'sender', type: 'address' },
            { name: 'nonce', type: 'uint256' },
            { name: 'initCode', type: 'bytes' },
            { name: 'callData', type: 'bytes' },
            { name: 'callGasLimit', type: 'uint256' },
            { name: 'verificationGasLimit', type: 'uint256' },
            { name: 'preVerificationGas', type: 'uint256' },
            { name: 'maxFeePerGas', type: 'uint256' },
            { name: 'maxPriorityFeePerGas', type: 'uint256' },
            { name: 'paymasterAndData', type: 'bytes' },
          ],
        },
        primaryType: 'UserOperation',
        message: {
          sender: userOpRequest.sender,
          nonce: parseInt(userOpRequest.nonce, 16).toString(), // 10진수 문자열로 변환
          initCode: userOpRequest.initCode,
          callData: userOpRequest.callData,
          callGasLimit: parseInt(userOpRequest.callGasLimit, 16).toString(), // 10진수로 변환
          verificationGasLimit: parseInt(userOpRequest.verificationGasLimit, 16).toString(),
          preVerificationGas: parseInt(userOpRequest.preVerificationGas, 16).toString(),
          maxFeePerGas: parseInt(userOpRequest.maxFeePerGas, 16).toString(),
          maxPriorityFeePerGas: parseInt(userOpRequest.maxPriorityFeePerGas, 16).toString(),
          paymasterAndData: userOpRequest.paymasterAndData,
        },
      };

      this.logger.info('📝 MetaMask 호환 EIP-712 데이터:', typedData);
      
      try {
        const signature = await provider.request({
          method: 'eth_signTypedData_v4',
          params: [
            await this.wallet.getAddress(),
            JSON.stringify(typedData)
          ]
        });
        
        this.logger.info('✅ Provider 직접 서명 완료');
        return signature;
    } catch (error) {
        this.logger.error('❌ Provider 직접 서명 실패:', error);
      throw new GaslessSDKError(
          `Provider 서명 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ErrorCodes.INVALID_SIGNATURE
        );
      }
    }

    // 기본 지갑 인터페이스 사용
    return await this.wallet.signTypedData(domain, types, userOpRequest);
  }

  /**
   * Send UserOperation to Bundler with provider-based signing
   */
  public async sendUserOperationToBundler(
    transaction: {
      to: string;
      value?: bigint;
      data?: string;
    },
    provider?: any, // Wagmi provider 직접 전달
    onProgress?: (step: string) => void
  ): Promise<BundlerResponse> {
    if (!this.wallet) {
      throw new GaslessSDKError('Wallet not connected', ErrorCodes.INVALID_SIGNATURE);
    }

    this.logger.info('🚀 Account Abstraction 트랜잭션 시작');
    onProgress?.('UserOperation 생성 중...');

    try {
      // 1단계: UserOperation 생성
      const userOpRequest = await this.createUserOperation(transaction);
      this.logger.info('📦 UserOperation 생성 완료:', userOpRequest);

      // 2단계: UserOperation 서명
      onProgress?.('UserOperation 서명 중...');
      const signature = await this.signUserOperation(userOpRequest, provider);
      
      const signedUserOp: UserOperation = {
        ...userOpRequest,
        signature,
      };

      this.logger.info('✅ UserOperation 서명 완료');

      // 3단계: Bundler로 전송
      onProgress?.('Bundler로 전송 중...');
      const bundlerResult = await this.submitUserOperationToBundler(signedUserOp, onProgress);

      this.logger.info('🎉 Account Abstraction 트랜잭션 완료');
      return bundlerResult;

    } catch (error) {
      this.logger.error('❌ Account Abstraction 트랜잭션 실패:', error);
      throw error;
    }
  }

  /**
   * Submit signed UserOperation to Bundler
   */
  private async submitUserOperationToBundler(
    userOperation: UserOperation,
    onProgress?: (step: string) => void
  ): Promise<BundlerResponse> {
    this.logger.info('📡 Bundler API 호출:', this.bundlerEndpoint);
    
    try {
      const response = await fetch(this.bundlerEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'GaslessSDK/1.0.0',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_sendUserOperation',
          params: [userOperation],
          id: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Bundler HTTP 오류: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(`Bundler RPC 오류: ${result.error.message} (코드: ${result.error.code})`);
      }

      const userOpHash = result.result;
      this.logger.info('✅ UserOperation Hash 받음:', userOpHash);

      // UserOperation Receipt 대기
      onProgress?.('트랜잭션 확인 대기 중...');
      const bundlerTxHash = await this.waitForUserOperationReceipt(userOpHash, onProgress);

      return {
        userOpHash,
        bundlerTxHash,
      };

    } catch (error) {
      this.logger.error('❌ Bundler 전송 실패:', error);
      throw new GaslessSDKError(
        `Bundler 전송 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.TRANSACTION_FAILED
      );
    }
  }

  /**
   * Wait for UserOperation to be included in a transaction
   */
  private async waitForUserOperationReceipt(
    userOpHash: string,
    onProgress?: (step: string) => void
  ): Promise<string> {
    this.logger.info('⏳ UserOperation Receipt 대기 중:', userOpHash);
    
    const maxAttempts = 60; // 최대 60초 대기
    const delayMs = 1000; // 1초마다 확인

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        onProgress?.(`트랜잭션 확인 중... (${attempt}/${maxAttempts})`);
        
        const response = await fetch(this.bundlerEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getUserOperationReceipt',
            params: [userOpHash],
            id: Date.now(),
          }),
        });

        const result = await response.json();
        
        if (result.result && result.result.receipt && result.result.receipt.transactionHash) {
          const txHash = result.result.receipt.transactionHash;
          this.logger.info('✅ UserOperation이 트랜잭션으로 변환됨:', txHash);
          onProgress?.('트랜잭션 완료!');
          return txHash;
        }

        if (result.error && result.error.code !== -32601) { // Method not found는 무시
          this.logger.warn('UserOperation Receipt 조회 오류:', result.error);
        }

      } catch (error) {
        this.logger.warn(`UserOperation Receipt 조회 시도 ${attempt} 실패:`, error);
      }

      // 마지막 시도가 아니면 대기
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw new GaslessSDKError(
      `UserOperation이 ${maxAttempts}초 내에 트랜잭션으로 변환되지 않았습니다`,
      ErrorCodes.TRANSACTION_FAILED
    );
  }

  /**
   * Get Smart Account address for the connected wallet
   */
  public async getSmartAccountAddress(): Promise<string> {
    if (!this.wallet) {
      throw new GaslessSDKError('Wallet not connected', ErrorCodes.INVALID_SIGNATURE);
    }

    const eoaAddress = await this.wallet.getAddress();
    
    // Create2를 사용한 deterministic Smart Account 주소 계산
    // 실제로는 Smart Account Factory 컨트랙트를 통해 계산
    const salt = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const factoryAddress = '0x9406Cc6185a346906296840746125a0E44976454'; // SimpleAccountFactory
    
    // Create2 주소 계산 (간소화된 버전)
    const initCodeHash = this.calculateInitCodeHash(eoaAddress);
    const smartAccountAddress = this.calculateCreate2Address(factoryAddress, salt, initCodeHash);
    
    this.logger.info('🏦 Smart Account 주소 (Create2):', smartAccountAddress);
    return smartAccountAddress;
  }

  /**
   * Calculate init code hash for Smart Account
   */
  private calculateInitCodeHash(ownerAddress: string): string {
    // 실제로는 Smart Account의 bytecode + constructor args의 해시
    // 여기서는 예시를 위해 deterministic 해시 생성
    const ownerHash = ownerAddress.slice(2).toLowerCase();
    const initCodeHash = `0x${ownerHash}${'0'.repeat(64 - ownerHash.length)}`;
    return initCodeHash;
  }

  /**
   * Calculate Create2 address
   */
  private calculateCreate2Address(factory: string, salt: string, initCodeHash: string): string {
    // Create2 주소 계산: keccak256(0xff + factory + salt + initCodeHash)[12:]
    // 실제로는 ethers.js의 getCreate2Address 사용
    // 여기서는 예시를 위해 deterministic 주소 생성
    const factoryHex = factory.slice(2).toLowerCase();
    const saltHex = salt.slice(2);
    const hashHex = initCodeHash.slice(2);
    
    // 간단한 해시 조합 (실제로는 keccak256 사용)
    const combined = factoryHex + saltHex + hashHex;
    const addressHex = combined.slice(0, 40);
    
    return `0x${addressHex}`;
  }

  /**
   * Get nonce for UserOperation
   */
  public async getUserOperationNonce(smartAccountAddress: string): Promise<bigint> {
    try {
      // 실제로는 Smart Account 컨트랙트에서 nonce 조회
      // 또는 Bundler API를 통한 nonce 조회
      this.logger.info('Nonce 조회 for Smart Account:', smartAccountAddress);
      
      // 예시를 위해 랜덤 nonce 반환
      return BigInt(Math.floor(Math.random() * 1000000));
      
    } catch (error) {
      this.logger.warn('Nonce 조회 실패, 기본값 사용:', error);
      return BigInt(0);
    }
  }

  /**
   * Encode execute call data for Smart Account
   */
  public encodeExecuteCall(params: {
    to: string;
    value: bigint;
    data: string;
  }): string {
    // Smart Account의 execute(address to, uint256 value, bytes calldata data) 함수 호출 인코딩
    // 실제로는 ABI 인코딩 라이브러리 사용
    const functionSelector = '0xb61d27f6'; // execute(address,uint256,bytes)
    const toAddress = params.to.slice(2).padStart(64, '0');
    const value = params.value.toString(16).padStart(64, '0');
    const dataOffset = '60'; // 96 bytes offset for dynamic bytes
    const dataLength = (params.data.length - 2) / 2;
    const dataLengthHex = dataLength.toString(16).padStart(64, '0');
    const dataPadded = params.data.slice(2).padEnd(Math.ceil(dataLength / 32) * 64, '0');
    
    return `${functionSelector}${toAddress}${value}${dataOffset}${dataLengthHex}${dataPadded}`;
  }

  /**
   * Estimate gas for UserOperation
   */
  public async estimateUserOperationGas(params: {
    sender: string;
    callData: string;
  }): Promise<{
    callGasLimit: bigint;
    verificationGasLimit: bigint;
    preVerificationGas: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
  }> {
    try {
      const response = await fetch(this.bundlerEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_estimateUserOperationGas',
          params: [
            {
              sender: params.sender,
              nonce: '0x0',
        initCode: '0x',
              callData: params.callData,
        paymasterAndData: '0x',
            },
            this.entryPointAddress
          ],
          id: Date.now(),
        }),
      });

      const result = await response.json();
      
      if (result.error) {
        throw new Error(`가스 추정 실패: ${result.error.message}`);
      }

      const estimates = result.result;
      
      return {
        callGasLimit: BigInt(estimates.callGasLimit || '0x5208'),
        verificationGasLimit: BigInt(estimates.verificationGasLimit || '0x5208'),
        preVerificationGas: BigInt(estimates.preVerificationGas || '0x5208'),
        maxFeePerGas: BigInt(estimates.maxFeePerGas || '0x59682f00'),
        maxPriorityFeePerGas: BigInt(estimates.maxPriorityFeePerGas || '0x59682f00'),
      };
      
    } catch (error) {
      this.logger.warn('가스 추정 실패, 기본값 사용:', error);
      
      // 기본값 반환
      return {
        callGasLimit: BigInt(21000),
        verificationGasLimit: BigInt(100000),
        preVerificationGas: BigInt(21000),
        maxFeePerGas: BigInt(1500000000), // 1.5 gwei
        maxPriorityFeePerGas: BigInt(1500000000),
      };
    }
  }

  /**
   * Get UserOperation receipt from Bundler
   */
  public async getUserOperationReceipt(userOpHash: string): Promise<UserOperationReceipt | null> {
    try {
      const response = await fetch(this.bundlerEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getUserOperationReceipt',
          params: [userOpHash],
          id: Date.now(),
        }),
      });

      const result = await response.json();
      
      if (result.error) {
        if (result.error.code === -32601) {
          // Method not found - UserOperation이 아직 처리되지 않음
          return null;
        }
        throw new Error(`Receipt 조회 오류: ${result.error.message}`);
      }

      return result.result;
      
    } catch (error) {
      this.logger.warn('UserOperation Receipt 조회 실패:', error);
      return null;
    }
  }
}