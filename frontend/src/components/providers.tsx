'use client';

import React from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '../wagmi.config';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { CapacitorWalletBootstrap } from '@/components/CapacitorWalletBootstrap';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
    },
  },
});

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <LocaleProvider>
      <WagmiProvider config={config} reconnectOnMount>
        <QueryClientProvider client={queryClient}>
          <CapacitorWalletBootstrap />
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </LocaleProvider>
  );
}
