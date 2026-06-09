'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { config } from '@/lib/web3/config';
import { I18nProvider } from '@/lib/i18n/provider';

export function Providers({ children }: { children: ReactNode }) {
  // useState 保证 QueryClient 只创建一次，避免每次渲染重建。
  const [queryClient] = useState(() => new QueryClient());

  return (
    <I18nProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={darkTheme()}>{children}</RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </I18nProvider>
  );
}
