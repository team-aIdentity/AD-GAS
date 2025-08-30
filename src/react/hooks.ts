import { useState, useEffect, useCallback } from 'react';
import { GaslessSDK } from '../core/GaslessSDK';
import {
  GaslessSDKConfig,
  GaslessTransaction,
  MetaTransaction,
  RelayerResponse,
  TransactionEvent,
  WalletInterface,
  NetworkConfig,
  GaslessSDKError,
} from '../types';

// Hook for managing GaslessSDK instance
export function useGaslessSDK(config: GaslessSDKConfig) {
  const [sdk, setSdk] = useState<GaslessSDK | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const sdkInstance = new GaslessSDK(config);
      setSdk(sdkInstance);
      setIsInitialized(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize SDK');
      setIsInitialized(false);
    }
  }, [config]);

  return {
    sdk,
    isInitialized,
    error,
  };
}

// Hook for wallet connection management
export function useWalletConnection(sdk: GaslessSDK | null) {
  const [wallet, setWallet] = useState<WalletInterface | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (walletInterface: WalletInterface) => {
    if (!sdk) {
      setError('SDK not initialized');
      return;
    }

    try {
      await sdk.connectWallet(walletInterface);
      const userAddress = await walletInterface.getAddress();
      const userChainId = await walletInterface.getChainId();

      setWallet(walletInterface);
      setAddress(userAddress);
      setChainId(userChainId);
      setIsConnected(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    }
  }, [sdk]);

  const disconnect = useCallback(() => {
    if (sdk) {
      sdk.disconnect();
    }
    setWallet(null);
    setAddress(null);
    setChainId(null);
    setIsConnected(false);
    setError(null);
  }, [sdk]);

  return {
    wallet,
    isConnected,
    address,
    chainId,
    error,
    connect,
    disconnect,
  };
}

// Hook for sending gasless transactions
export function useGaslessTransaction(sdk: GaslessSDK | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<RelayerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<TransactionEvent[]>([]);

  const sendTransaction = useCallback(async (transaction: Partial<GaslessTransaction>) => {
    if (!sdk) {
      setError('SDK not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);
    setEvents([]);
    setResponse(null);

    try {
             const result = await sdk.sendGaslessTransaction(transaction, (event) => {
         setEvents((prev: TransactionEvent[]) => [...prev, event]);
       });

      setResponse(result);
    } catch (err) {
      const errorMessage = err instanceof GaslessSDKError 
        ? `${err.code}: ${err.message}`
        : err instanceof Error 
        ? err.message 
        : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [sdk]);

  const reset = useCallback(() => {
    setResponse(null);
    setError(null);
    setEvents([]);
    setIsLoading(false);
  }, []);

  return {
    sendTransaction,
    isLoading,
    response,
    error,
    events,
    reset,
  };
}

// Hook for meta-transactions
export function useMetaTransaction(sdk: GaslessSDK | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<RelayerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<TransactionEvent[]>([]);

  const sendMetaTransaction = useCallback(async (transaction: Partial<MetaTransaction>) => {
    if (!sdk) {
      setError('SDK not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);
    setEvents([]);
    setResponse(null);

    try {
             const result = await sdk.sendMetaTransaction(transaction, (event) => {
         setEvents((prev: TransactionEvent[]) => [...prev, event]);
       });

      setResponse(result);
    } catch (err) {
      const errorMessage = err instanceof GaslessSDKError 
        ? `${err.code}: ${err.message}`
        : err instanceof Error 
        ? err.message 
        : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [sdk]);

  const reset = useCallback(() => {
    setResponse(null);
    setError(null);
    setEvents([]);
    setIsLoading(false);
  }, []);

  return {
    sendMetaTransaction,
    isLoading,
    response,
    error,
    events,
    reset,
  };
}

// Hook for network management
export function useNetworkManager(sdk: GaslessSDK | null) {
  const [currentNetwork, setCurrentNetwork] = useState<NetworkConfig | null>(null);
  const [availableNetworks, setAvailableNetworks] = useState<NetworkConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sdk) {
      try {
        setCurrentNetwork(sdk.getCurrentNetwork());
        setAvailableNetworks(sdk.getAvailableNetworks());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get network info');
      }
    }
  }, [sdk]);

  const switchNetwork = useCallback(async (chainId: number) => {
    if (!sdk) {
      setError('SDK not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await sdk.switchNetwork(chainId);
      setCurrentNetwork(sdk.getCurrentNetwork());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch network');
    } finally {
      setIsLoading(false);
    }
  }, [sdk]);

  return {
    currentNetwork,
    availableNetworks,
    switchNetwork,
    isLoading,
    error,
  };
}

// Hook for gas estimation
export function useGasEstimation(sdk: GaslessSDK | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [estimate, setEstimate] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const estimateGas = useCallback(async (transaction: Partial<GaslessTransaction>) => {
    if (!sdk) {
      setError('SDK not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

         try {
       const gasEstimate = await sdk.estimateGas(transaction);
       setEstimate(typeof gasEstimate === 'bigint' ? gasEstimate : BigInt(gasEstimate.toString()));
     } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to estimate gas');
    } finally {
      setIsLoading(false);
    }
  }, [sdk]);

  const reset = useCallback(() => {
    setEstimate(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    estimateGas,
    estimate,
    isLoading,
    error,
    reset,
  };
}

// Combined hook for complete gasless transaction flow
export function useGaslessSDKComplete(config: GaslessSDKConfig) {
  const { sdk, isInitialized, error: sdkError } = useGaslessSDK(config);
  const walletConnection = useWalletConnection(sdk);
  const gaslessTransaction = useGaslessTransaction(sdk);
  const metaTransaction = useMetaTransaction(sdk);
  const networkManager = useNetworkManager(sdk);
  const gasEstimation = useGasEstimation(sdk);

  return {
    // SDK instance and status
    sdk,
    isInitialized,
    sdkError,

    // Wallet connection
    ...walletConnection,

    // Transaction hooks
    gaslessTransaction,
    metaTransaction,

    // Network management
    networkManager,

    // Gas estimation
    gasEstimation,
  };
}
