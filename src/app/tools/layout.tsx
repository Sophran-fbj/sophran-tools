import type { ReactNode } from 'react';
import { WalletProviders } from './wallet-providers';

export default function ToolsLayout({ children }: { children: ReactNode }) {
  return <WalletProviders>{children}</WalletProviders>;
}
