import { http, PublicClient, WalletClient, parseEther } from "viem";
import { toMultichainNexusAccount, createMeeClient, DEFAULT_CONFIGURATIONS_BY_MEE_VERSION } from "@biconomy/abstractjs";
import type { MultichainSmartAccount, MeeClient } from "@biconomy/abstractjs";

export interface SdkConfig {
  publicClient: PublicClient;
  walletClient: WalletClient;
}

export class GaslessSDK {
  public smartAccount?: MultichainSmartAccount;
  public meeClient?: MeeClient;

  private constructor() {} // 생성자는 비공개로

  // SDK 인스턴스를 비동기적으로 생성하고 초기화합니다.
  public static async initialize(config: SdkConfig): Promise<GaslessSDK> {
    const sdk = new GaslessSDK();

    // 환경변수 검증
    const bundlerUrl = process.env.NEXT_PUBLIC_BICONOMY_BUNDLER_URL;
    const paymasterApiKey = process.env.NEXT_PUBLIC_BICONOMY_API_KEY;
    
    if (!bundlerUrl) {
      throw new Error("NEXT_PUBLIC_BICONOMY_BUNDLER_URL is required");
    }
    if (!paymasterApiKey) {
      throw new Error("NEXT_PUBLIC_BICONOMY_API_KEY is required");
    }
    if (!config.walletClient.chain) {
      throw new Error("Wallet client chain is required");
    }
    if (!config.walletClient.account) {
      throw new Error("Wallet client account is required");
    }

    // Multichain Nexus Account 생성 - WalletClient를 signer로 사용
    sdk.smartAccount = await toMultichainNexusAccount({
      chainConfigurations: [{
        chain: config.walletClient.chain,
        transport: http(),
        version: DEFAULT_CONFIGURATIONS_BY_MEE_VERSION["1.0.0"], // 사용 가능한 버전 사용
      }],
      signer: config.walletClient as any, // 타입 호환성을 위한 임시 단언
    });

    // MEE Client 생성
    sdk.meeClient = await createMeeClient({
      account: sdk.smartAccount,
      apiKey: paymasterApiKey,
    });

    const saAddress = sdk.smartAccount.addressOn(config.walletClient.chain.id);
    console.log("SA Address", saAddress);

    console.log("Gasless SDK (Biconomy) Initialized. Smart Account:", saAddress);
    return sdk;
  }

  // 보상형 광고를 포함한 트랜잭션 전송
  public async sendTransaction(tx: { to: `0x${string}`, value: number, data?: `0x${string}` }): Promise<string> {
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
      
      // MEE Client를 사용하여 트랜잭션 실행
      const quote = await this.meeClient.getQuote({
        instructions: [{
          calls: [{
            to: tx.to,
            value: parseEther(tx.value.toString()),
            data: tx.data || '0x',
            gasLimit: BigInt(100000), // 기본 가스 한도 설정
          }],
          chainId: this.smartAccount.deployments[0].client.chain!.id,
        }],
        sponsorship: true, // 스폰서십 활성화
      });

      // Quote 실행
      const { hash } = await this.meeClient.executeQuote({ quote });

      console.log("Transaction Hash:", hash);
      return hash;

    } catch (error) {
      console.error("Transaction failed:", error);
      throw error;
    }
  }
}

function showMyGoogleAd(): Promise<boolean> {
  return Promise.resolve(true);
}