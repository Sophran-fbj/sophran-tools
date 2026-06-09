'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useI18n } from '@/lib/i18n/provider';

export function WalletButton() {
  const { locale } = useI18n();

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        openAccountModal,
        openChainModal,
        openConnectModal,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!ready) {
          return (
            <button className="btn btn-neutral btn-sm opacity-0" type="button">
              ...
            </button>
          );
        }

        if (!connected) {
          return (
            <button className="btn btn-primary btn-sm" onClick={openConnectModal} type="button">
              {locale === 'zh' ? '连接钱包' : 'Connect'}
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button className="btn btn-error btn-sm" onClick={openChainModal} type="button">
              {locale === 'zh' ? '切换网络' : 'Wrong network'}
            </button>
          );
        }

        return (
          <div className="flex max-w-full items-center gap-2">
            <button
              className="btn btn-neutral btn-sm min-h-9 rounded-full px-3"
              onClick={openChainModal}
              type="button"
            >
              {chain.hasIcon && chain.iconUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={chain.name ?? 'Chain'}
                  className="h-4 w-4 rounded-full"
                  src={chain.iconUrl}
                />
              )}
              <span className="max-w-24 truncate">{chain.name}</span>
            </button>
            <button
              className="btn btn-neutral btn-sm min-h-9 rounded-full px-3 font-mono"
              onClick={openAccountModal}
              type="button"
            >
              {account.displayName}
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
