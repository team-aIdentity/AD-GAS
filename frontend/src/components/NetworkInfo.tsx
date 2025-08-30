'use client';

import React from 'react';
import { useChainId, useSwitchChain } from 'wagmi';
import { mainnet, polygon, sepolia, base, optimism } from 'wagmi/chains';

export function NetworkInfo() {
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  const supportedChains = [mainnet, polygon, sepolia, base, optimism];
  const currentChain = supportedChains.find(chain => chain.id === chainId);

  const getChainIcon = (chainName: string) => {
    switch (chainName.toLowerCase()) {
      case 'ethereum':
        return '⟠';
      case 'polygon':
        return '⬟';
      case 'sepolia':
        return '🧪';
      case 'base':
        return '🔵';
      case 'optimism':
        return '🔴';
      default:
        return '🔗';
    }
  };

  return (
    <div className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-700">현재 네트워크</h4>
        {currentChain && (
          <div className="flex items-center space-x-1">
            <span className="text-lg">{getChainIcon(currentChain.name)}</span>
            <span className="text-sm font-medium text-gray-900">{currentChain.name}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1">
        {supportedChains.map(chain => (
          <button
            key={chain.id}
            onClick={() => switchChain({ chainId: chain.id })}
            disabled={isPending || chainId === chain.id}
            className={`p-2 text-xs rounded transition-colors duration-200 ${
              chainId === chain.id
                ? 'bg-blue-500 text-white'
                : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-center justify-center space-x-1">
              <span>{getChainIcon(chain.name)}</span>
              <span>{chain.name}</span>
            </div>
          </button>
        ))}
      </div>

      {isPending && (
        <div className="mt-2 flex items-center justify-center space-x-2 text-blue-600">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
          <span className="text-xs">네트워크 변경 중...</span>
        </div>
      )}
    </div>
  );
}
