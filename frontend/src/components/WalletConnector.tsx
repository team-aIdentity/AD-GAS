'use client';

import React from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { ProviderDirectSigning } from './ProviderDirectSigning';
import { DebugProviderSigning } from './DebugProviderSigning';
import { NetworkInfo } from './NetworkInfo';

export function WalletConnector() {
  const { address, isConnected, connector } = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();

  // 연결된 상태일 때 표시할 UI
  if (isConnected) {
    return (
      <div className="flex flex-col items-center space-y-4 p-6 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-green-700 font-semibold">지갑 연결됨</span>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-600 mb-1">연결된 지갑:</p>
          <p className="font-mono text-sm bg-white px-3 py-1 rounded border">
            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '주소 로딩 중...'}
          </p>
        </div>

        {connector && <p className="text-xs text-gray-500">{connector.name}로 연결됨</p>}

        {/* 네트워크 정보 */}
        <div className="w-full">
          <NetworkInfo />
        </div>

        <button
          onClick={() => disconnect()}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors duration-200"
        >
          연결 해제
        </button>

        {/* Account Abstraction 송금 컴포넌트 */}
        <div className="w-full space-y-3">
          <DebugProviderSigning />
          <ProviderDirectSigning address={address!} />
        </div>
      </div>
    );
  }

  // 연결되지 않은 상태일 때 표시할 UI
  return (
    <div className="flex flex-col items-center space-y-4 p-6 bg-gray-50 border border-gray-200 rounded-lg">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">지갑 연결</h3>
        <p className="text-sm text-gray-600">아래 지갑 중 하나를 선택하여 연결하세요</p>
      </div>

      <div className="w-full space-y-2">
        {connectors.map(connector => (
          <WalletOption
            key={connector.uid}
            connector={connector}
            onClick={() => connect({ connector })}
            isConnecting={status === 'pending'}
          />
        ))}
      </div>

      {error && (
        <div className="w-full p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm text-center">연결 오류: {error.message}</p>
        </div>
      )}

      {status === 'pending' && (
        <div className="flex items-center space-x-2 text-blue-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm">연결 중...</span>
        </div>
      )}
    </div>
  );
}

// 개별 지갑 옵션 컴포넌트
interface WalletOptionProps {
  connector: any;
  onClick: () => void;
  isConnecting: boolean;
}

function WalletOption({ connector, onClick, isConnecting }: WalletOptionProps) {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const provider = await connector.getProvider();
        setReady(!!provider);
      } catch {
        setReady(false);
      }
    })();
  }, [connector]);

  const getWalletIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'metamask':
        return '🦊';
      case 'walletconnect':
        return '🔗';
      case 'coinbase wallet':
        return '🔵';
      case 'injected':
        return '🔌';
      default:
        return '💳';
    }
  };

  return (
    <button
      disabled={!ready || isConnecting}
      onClick={onClick}
      className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex items-center space-x-3">
        <span className="text-xl">{getWalletIcon(connector.name)}</span>
        <span className="font-medium text-gray-900">{connector.name}</span>
      </div>

      <div className="flex items-center space-x-2">
        {!ready && (
          <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">사용불가</span>
        )}
        {isConnecting && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        )}
        <span className="text-gray-400">→</span>
      </div>
    </button>
  );
}
