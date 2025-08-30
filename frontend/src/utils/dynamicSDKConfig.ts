'use client';

import { GaslessSDKConfig, NetworkConfig } from '../../../src';

/**
 * Provider에서 네트워크 정보를 가져와서 동적으로 SDK 설정 생성
 */
export async function createDynamicSDKConfig(
  provider: any,
  address: string
): Promise<GaslessSDKConfig> {
  try {
    console.log('🔄 Provider에서 네트워크 정보 가져오는 중...');

    // 1. 현재 체인 ID 가져오기
    const chainIdHex = await provider.request({
      method: 'eth_chainId',
      params: []
    });
    const chainId = parseInt(chainIdHex, 16);
    console.log('📡 현재 Chain ID:', chainId);

    // 2. 네트워크 이름 가져오기 (가능한 경우)
    let networkName = getNetworkName(chainId);
    
    // 3. RPC URL 가져오기 (가능한 경우)
    let rpcUrl = getRPCUrl(chainId);

    // 4. 가스 토큰 정보 가져오기
    const gasTokens = getGasTokens(chainId);

    // 5. 네트워크별 Bundler 엔드포인트 설정
    const bundlerEndpoint = getBundlerEndpoint(chainId);
    
    // 6. EntryPoint 주소 (EIP-4337 표준)
    const entryPointAddress = getEntryPointAddress(chainId);

    console.log('✅ 동적 네트워크 설정 생성 완료:', {
      chainId,
      networkName,
      bundlerEndpoint
    });

    const networkConfig: NetworkConfig = {
      chainId,
      name: networkName,
      rpcUrl,
      gasTokens,
    };

    const sdkConfig: GaslessSDKConfig = {
      networks: [networkConfig],
      defaultNetwork: chainId,
      bundlerEndpoint,
      entryPointAddress,
      debug: true,
    };

    return sdkConfig;

  } catch (error) {
    console.error('❌ 동적 SDK 설정 생성 실패:', error);
    
    // 실패 시 기본 설정 반환
    return getDefaultSDKConfig();
  }
}

/**
 * Chain ID에 따른 네트워크 이름 반환
 */
function getNetworkName(chainId: number): string {
  const networkNames: { [key: number]: string } = {
    1: 'Ethereum Mainnet',
    137: 'Polygon Mainnet',
    11155111: 'Sepolia Testnet',
    80001: 'Polygon Mumbai',
    8453: 'Base Mainnet',
    84531: 'Base Goerli',
    10: 'Optimism Mainnet',
    420: 'Optimism Goerli',
  };

  return networkNames[chainId] || `Unknown Network (${chainId})`;
}

/**
 * Chain ID에 따른 RPC URL 반환
 */
function getRPCUrl(chainId: number): string {
  const rpcUrls: { [key: number]: string } = {
    1: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    137: 'https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    11155111: 'https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY',
    80001: 'https://polygon-mumbai.g.alchemy.com/v2/YOUR_API_KEY',
    8453: 'https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    10: 'https://opt-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
  };

  return rpcUrls[chainId] || `https://rpc.ankr.com/eth`;
}

/**
 * Chain ID에 따른 가스 토큰 목록 반환
 */
function getGasTokens(chainId: number): string[] {
  const gasTokens: { [key: number]: string[] } = {
    1: [
      '0x0000000000000000000000000000000000000000', // ETH
      '0xA0b86a33E6441b8C7013E02b5b67E2b4F4d4d4F9', // USDC
    ],
    137: [
      '0x0000000000000000000000000000000000000000', // MATIC
      '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
    ],
    11155111: [
      '0x0000000000000000000000000000000000000000', // Sepolia ETH
    ],
    8453: [
      '0x0000000000000000000000000000000000000000', // Base ETH
    ],
    10: [
      '0x0000000000000000000000000000000000000000', // Optimism ETH
    ],
  };

  return gasTokens[chainId] || ['0x0000000000000000000000000000000000000000'];
}

/**
 * Chain ID에 따른 Bundler 엔드포인트 반환
 */
function getBundlerEndpoint(chainId: number): string {
  const bundlerEndpoints: { [key: number]: string } = {
    1: 'https://bundler.stackup.sh/v1/ethereum/YOUR_API_KEY',
    137: 'https://bundler.stackup.sh/v1/polygon/YOUR_API_KEY', 
    11155111: 'https://bundler.stackup.sh/v1/sepolia/YOUR_API_KEY',
    80001: 'https://bundler.stackup.sh/v1/mumbai/YOUR_API_KEY',
    8453: 'https://bundler.stackup.sh/v1/base/YOUR_API_KEY',
    10: 'https://bundler.stackup.sh/v1/optimism/YOUR_API_KEY',
  };

  return bundlerEndpoints[chainId] || 'https://bundler.example.com/rpc';
}

/**
 * Chain ID에 따른 EntryPoint 주소 반환
 */
function getEntryPointAddress(chainId: number): string {
  // EIP-4337 EntryPoint v0.6 (대부분의 네트워크에서 동일)
  const entryPointAddresses: { [key: number]: string } = {
    1: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    137: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    11155111: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    80001: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    8453: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    10: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  };

  return entryPointAddresses[chainId] || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
}

/**
 * 기본 SDK 설정 (fallback)
 */
function getDefaultSDKConfig(): GaslessSDKConfig {
  return {
    networks: [
      {
        chainId: 137,
        name: 'Polygon Mainnet',
        rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
        gasTokens: ['0x0000000000000000000000000000000000000000'],
      },
    ],
    defaultNetwork: 137,
    bundlerEndpoint: 'https://bundler.stackup.sh/v1/polygon/YOUR_API_KEY',
    entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    debug: true,
  };
}

/**
 * Provider에서 추가 네트워크 정보 가져오기
 */
export async function getProviderNetworkInfo(provider: any) {
  try {
    const [chainId, accounts, networkVersion] = await Promise.all([
      provider.request({ method: 'eth_chainId' }),
      provider.request({ method: 'eth_accounts' }),
      provider.request({ method: 'net_version' }).catch(() => null),
    ]);

    return {
      chainId: parseInt(chainId, 16),
      accounts,
      networkVersion,
      providerInfo: {
        isMetaMask: provider.isMetaMask,
        isCoinbaseWallet: provider.isCoinbaseWallet,
        isWalletConnect: provider.isWalletConnect,
      }
    };
  } catch (error) {
    console.error('Provider 네트워크 정보 가져오기 실패:', error);
    return null;
  }
}