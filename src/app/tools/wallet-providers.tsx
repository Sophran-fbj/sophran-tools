'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { config } from '@/lib/web3/config';
import { useTheme } from '@/lib/theme/provider';

export function WalletProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const { theme } = useTheme();
  const walletTheme = theme === 'graphite'
    ? darkTheme({ accentColor: '#80d3da', accentColorForeground: '#10272b' })
    : lightTheme({
        accentColor: theme === 'sandstone' ? '#8a4629' : '#096b78',
        accentColorForeground: '#ffffff',
      });

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={walletTheme}>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
