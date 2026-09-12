import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { mainnet, arbitrum, optimism, polygon, base } from 'wagmi/chains';

const alchemyId = process.env.NEXT_PUBLIC_ALCHEMY_ID;

const rpc = (subdomain: string) =>
  alchemyId ? http(`https://${subdomain}.g.alchemy.com/v2/${alchemyId}`) : http();

const chains = [mainnet, arbitrum, optimism, polygon, base] as const;
const transports = {
  [mainnet.id]: rpc('eth-mainnet'),
  [arbitrum.id]: rpc('arb-mainnet'),
  [optimism.id]: rpc('opt-mainnet'),
  [polygon.id]: rpc('polygon-mainnet'),
  [base.id]: rpc('base-mainnet'),
};
const walletConnectProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID?.trim();

// Missing WalletConnect configuration must not break unrelated static pages.
// Injected wallets remain available locally; production should provide a project id.
export const config = walletConnectProjectId
  ? getDefaultConfig({
      appName: 'Sophran Tools',
      projectId: walletConnectProjectId,
      chains,
      transports,
      ssr: true,
    })
  : createConfig({
      chains,
      connectors: [injected()],
      transports,
      ssr: true,
    });
