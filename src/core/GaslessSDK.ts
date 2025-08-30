import { http, PublicClient, WalletClient } from "viem";
import { toMultichainNexusAccount, createMeeClient, getMEEVersion, MEEVersion } from "@biconomy/abstractjs";
import type { MultichainSmartAccount, MeeClient } from "@biconomy/abstractjs";

export interface SdkConfig {
  publicClient: PublicClient;
  walletClient: WalletClient;
  apiKey?: string; // MEE API Key (선택사항)
}

export interface TransactionRequest {
  to: `0x${string}`;
  value: bigint;
  data?: `0x${string}`;
  gasLimit?: bigint;
}

export interface QuoteOptions {
  sponsorship?: boolean;
  feeToken?: {
    address: `0x${string}`;
    chainId: number;
  };
}

export class GaslessSDK {
  public smartAccount?: MultichainSmartAccount;
  public meeClient?: MeeClient;

  private constructor() {} // 생성자는 비공개로

  // SDK 인스턴스를 비동기적으로 생성하고 초기화합니다.
  public static async initialize(config: SdkConfig): Promise<GaslessSDK> {
    const sdk = new GaslessSDK();

    // API Key 확인 (환경변수 또는 config에서)
    const apiKey = config.apiKey || process.env.NEXT_PUBLIC_BICONOMY_API_KEY;
    
    if (!config.walletClient.chain) {
      throw new Error("Wallet client chain is required");
    }
    if (!config.walletClient.account) {
      throw new Error("Wallet client account is required");
    }

    // 지원되는 체인 검증
    const supportedChainIds = [1, 137, 8453, 10, 42161, 11155111, 84532, 11155420, 421614, 80002];
    if (!supportedChainIds.includes(config.walletClient.chain.id)) {
      throw new Error(`Chain ${config.walletClient.chain.id} is not supported by MEE`);
    }

    console.log("Initializing MEE SDK...");

    // Multichain Nexus Account 생성
    sdk.smartAccount = await toMultichainNexusAccount({
      chainConfigurations: [{
        chain: config.walletClient.chain,
        transport: http(),
        version: getMEEVersion(MEEVersion.V2_1_0), // 최신 버전 사용
      }],
      signer: config.walletClient.account as any, // 타입 호환성을 위한 임시 단언
    });

    // MEE Client 생성
    sdk.meeClient = await createMeeClient({
      account: sdk.smartAccount,
      apiKey: apiKey,
    });

    const saAddress = sdk.smartAccount.addressOn(config.walletClient.chain.id);
    console.log("MEE SDK Initialized. Smart Account:", saAddress);

    return sdk;
  }

  // MEE Client를 사용한 트랜잭션 전송
  public async sendTransaction(tx: TransactionRequest, options: QuoteOptions = {}): Promise<string> {
    if (!this.smartAccount || !this.meeClient) {
      throw new Error("SDK not initialized properly");
    }

    try {
      // 광고를 보여주고 성공 여부를 기다림
      const adWatched = await showMyGoogleAd();
      if (!adWatched) {
        throw new Error("Ad was not completed. Transaction cancelled.");
      }

      console.log("Ad watched successfully, sending transaction...");
      console.log("Sending MEE transaction...");
      
      // MEE Instruction 생성
      const instruction = {
        calls: [{
          to: tx.to,
          value: tx.value,
          data: tx.data || '0x',
          gasLimit: tx.gasLimit || BigInt(100000),
        }],
        chainId: this.smartAccount.deployments[0].client.chain!.id,
      };

      console.log("Instruction created:", instruction);

      // Quote 생성 (옵션에 따라 스폰서십 또는 feeToken 사용)
      const quoteParams: any = {
        instructions: [instruction],
      };

      if (options.sponsorship) {
        quoteParams.sponsorship = true;
      } else if (options.feeToken) {
        quoteParams.feeToken = options.feeToken;
      } else {
        // 기본값: 네이티브 토큰으로 가스 지불
        quoteParams.feeToken = {
          address: "0x0000000000000000000000000000000000000000",
          chainId: this.smartAccount.deployments[0].client.chain!.id,
        };
      }

      const quote = await this.meeClient.getQuote(quoteParams);
      console.log("Quote generated:", quote);

      // Quote 실행
      const { hash } = await this.meeClient.executeQuote({ quote });
      console.log("Transaction Hash:", hash);

      return hash;

    } catch (error) {
      console.error("MEE Transaction failed:", error);
      throw error;
    }
  }

  // 스마트 계정 주소 가져오기
  public getSmartAccountAddress(chainId?: number): string | undefined {
    if (!this.smartAccount) {
      return undefined;
    }
    
    const targetChainId = chainId || this.smartAccount.deployments[0]?.client.chain?.id;
    if (!targetChainId) {
      return undefined;
    }

    return this.smartAccount.addressOn(targetChainId);
  }

  // 지원되는 체인 목록 확인
  public static getSupportedChains(): number[] {
    return [1, 137, 8453, 10, 42161, 11155111, 84532, 11155420, 421614, 80002];
  }

  // 체인 지원 여부 확인
  public static isChainSupported(chainId: number): boolean {
    return this.getSupportedChains().includes(chainId);
  }

  // 스폰서십을 사용한 gasless 트랜잭션
  public async sendGaslessTransaction(tx: TransactionRequest): Promise<string> {
    return this.sendTransaction(tx, { sponsorship: true });
  }

  // 네이티브 토큰으로 가스비를 지불하는 트랜잭션
  public async sendTransactionWithNativeGas(tx: TransactionRequest): Promise<string> {
    return this.sendTransaction(tx, {
      feeToken: {
        address: "0x0000000000000000000000000000000000000000",
        chainId: this.smartAccount?.deployments[0]?.client.chain?.id || 1,
      }
    });
  }

  // ERC-20 토큰으로 가스비를 지불하는 트랜잭션
  public async sendTransactionWithTokenGas(tx: TransactionRequest, gasToken: { address: `0x${string}`, chainId: number }): Promise<string> {
    return this.sendTransaction(tx, { feeToken: gasToken });
  }

  // Quote 미리보기 (실행하지 않고 비용만 확인)
  public async getQuote(tx: TransactionRequest, options: QuoteOptions = {}): Promise<any> {
    if (!this.smartAccount || !this.meeClient) {
      throw new Error("SDK not initialized properly");
    }

    const instruction = {
      calls: [{
        to: tx.to,
        value: tx.value,
        data: tx.data || '0x',
        gasLimit: tx.gasLimit || BigInt(100000),
      }],
      chainId: this.smartAccount.deployments[0].client.chain!.id,
    };

    const quoteParams: any = {
      instructions: [instruction],
    };

    if (options.sponsorship) {
      quoteParams.sponsorship = true;
    } else if (options.feeToken) {
      quoteParams.feeToken = options.feeToken;
    } else {
      quoteParams.feeToken = {
        address: "0x0000000000000000000000000000000000000000",
        chainId: this.smartAccount.deployments[0].client.chain!.id,
      };
    }

    return await this.meeClient.getQuote(quoteParams);
  }
}

function showMyGoogleAd(): Promise<boolean> {
  return Promise.resolve(true);
}