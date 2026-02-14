import { http, PublicClient, WalletClient } from "viem";
import { toMultichainNexusAccount, createMeeClient, getMEEVersion, MEEVersion } from "@biconomy/abstractjs";
import type { MultichainSmartAccount, MeeClient } from "@biconomy/abstractjs";

export interface SdkConfig {
  publicClient: PublicClient;
  walletClient: WalletClient;
  /** MEE(Biconomy) API Key. apiKey 또는 biconomyApiKey 둘 중 하나 사용 */
  apiKey?: string;
  biconomyApiKey?: string;
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

/** 형태 1: 트랜잭션 직전 광고 시청 플로우. beforeTransaction이 resolve되어야 트랜잭션 제출. */
export interface AdTrigger {
  /** 트랜잭션 전송 직전 호출. 광고 시청 완료 시 resolve, 실패 시 reject */
  beforeTransaction?: () => Promise<void>;
  /** 트랜잭션 성공 후 호출 */
  afterTransaction?: (txHash: string) => Promise<void>;
  /** 에러 시 호출 */
  onError?: (error: Error) => void;
}

export class GaslessSDK {
  public smartAccount?: MultichainSmartAccount;
  public meeClient?: MeeClient;

  /** 형태 1: 광고 트리거. setAdTrigger()로 주입. 없으면 기본 동작(테스트용). */
  private adTrigger?: AdTrigger;

  private constructor() {} // 생성자는 비공개로

  /** 형태 1: 트랜잭션 직전 광고 시청 플로우 설정. sendGaslessTransaction 시 beforeTransaction 호출 */
  public setAdTrigger(trigger: AdTrigger): void {
    this.adTrigger = trigger;
  }

  /** 형태 1: 현재 설정된 광고 트리거 반환 */
  public getAdTrigger(): AdTrigger | undefined {
    return this.adTrigger;
  }

  // SDK 인스턴스를 비동기적으로 생성하고 초기화합니다.
  public static async initialize(config: SdkConfig): Promise<GaslessSDK> {
    const sdk = new GaslessSDK();

    // API Key 확인 (config.apiKey > config.biconomyApiKey > 환경변수)
    const apiKey = config.apiKey ?? config.biconomyApiKey ?? process.env.NEXT_PUBLIC_BICONOMY_API_KEY;
    
    if (!config.walletClient.chain) {
      throw new Error("Wallet client chain is required");
    }
    if (!config.walletClient.account) {
      throw new Error("Wallet client account is required");
    }

    // 지원 체인: 이더리움(1), 베이스(8453), 아발란체(43114), BNB(56), 세폴리아(11155111) — eth.merkle.io 회피용 RPC
    const supportedChainIds = [1, 8453, 43114, 56, 11155111];
    const rpcUrls: Record<number, string> = {
      1: process.env.NEXT_PUBLIC_RPC_MAINNET || "https://eth.llamarpc.com",
      11155111: process.env.NEXT_PUBLIC_RPC_SEPOLIA || "https://rpc.sepolia.org",
      8453: process.env.NEXT_PUBLIC_RPC_BASE || "https://mainnet.base.org",
      43114: process.env.NEXT_PUBLIC_RPC_AVALANCHE || "https://api.avax.network/ext/bc/C/rpc",
      56: process.env.NEXT_PUBLIC_RPC_BNB || "https://bsc-dataseed.binance.org",
    };
    if (!supportedChainIds.includes(config.walletClient.chain.id)) {
      throw new Error(`Chain ${config.walletClient.chain.id} is not supported. 지원: Ethereum, Base, Avalanche, Sepolia`);
    }

    const chainId = config.walletClient.chain.id;
    const transport = http(rpcUrls[chainId] ?? undefined);

    console.log("Initializing MEE SDK...");

    // Multichain Nexus Account 생성 (명시 RPC 사용으로 merkle 등 실패 방지)
    sdk.smartAccount = await toMultichainNexusAccount({
      chainConfigurations: [{
        chain: config.walletClient.chain,
        transport,
        version: getMEEVersion(MEEVersion.V2_1_0), // 최신 버전 사용
      }],
      // Biconomy AbstractJS는 Viem WalletClient를 기대하므로 전체 walletClient를 signer로 전달
      signer: config.walletClient as any,
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
      // 형태 1: 광고 트리거 실행 (beforeTransaction). 설정 없으면 기본 동작
      if (options.sponsorship) {
        if (this.adTrigger?.beforeTransaction) {
          await this.adTrigger.beforeTransaction();
        } else {
          const adWatched = await defaultAdTrigger();
          if (!adWatched) {
            throw new Error("Ad was not completed. Transaction cancelled.");
          }
        }
        console.log("Ad trigger completed, sending transaction...");
      }

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
      let hash: string;
      try {
        const result = await this.meeClient.executeQuote({ quote });
        hash = result.hash || result.transactionHash || '';
        if (!hash) {
          throw new Error("Transaction hash not returned from executeQuote");
        }
      } catch (executeError: any) {
        // executeQuote에서 발생한 에러를 더 명확하게 처리
        const errorMessage = executeError?.message || executeError?.reason || JSON.stringify(executeError) || 'Unknown error';
        const errorDetails = executeError?.data || executeError?.error || executeError;
        console.error("executeQuote failed:", {
          message: errorMessage,
          details: errorDetails,
          fullError: executeError,
        });
        
        // 네이티브 가스비 사용 시 잔액 부족 에러 체크
        if (errorMessage.toLowerCase().includes('insufficient') || 
            errorMessage.toLowerCase().includes('balance') ||
            errorMessage.toLowerCase().includes('fund')) {
          throw new Error("Smart Account에 네이티브 토큰 잔액이 부족합니다. Smart Account로 먼저 자금을 입금해주세요.");
        }
        
        throw new Error(`트랜잭션 실행 실패: ${errorMessage}`);
      }
      
      console.log("Transaction Hash:", hash);

      // 형태 1: 트랜잭션 성공 후 콜백
      if (options.sponsorship && this.adTrigger?.afterTransaction) {
        await this.adTrigger.afterTransaction(hash).catch(() => {});
      }

      return hash;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.adTrigger?.onError?.(err);
      console.error("MEE Transaction failed:", error);
      throw err;
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

  // 지원 체인: 이더리움, 베이스, 아발란체, 세폴리아
  public static getSupportedChains(): number[] {
    return [1, 8453, 43114, 56, 11155111];
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

/** 기본 광고 트리거 (테스트/폴백용). setAdTrigger로 교체 권장 */
function defaultAdTrigger(): Promise<boolean> {
  return Promise.resolve(true);
}