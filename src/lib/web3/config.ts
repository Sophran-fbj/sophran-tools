import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { mainnet, arbitrum, optimism, polygon, base } from 'wagmi/chains';

const alchemyId = process.env.NEXT_PUBLIC_ALCHEMY_ID;

// 有 Alchemy key 就用 Alchemy 节点；没填则回退到各链默认公共 RPC（首次跑也能用）。
const rpc = (subdomain: string) =>
  alchemyId ? http(`https://${subdomain}.g.alchemy.com/v2/${alchemyId}`) : http();

export const config = getDefaultConfig({
  appName: 'Sophran Tools',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? '',
  chains: [mainnet, arbitrum, optimism, polygon, base],
  transports: {
    [mainnet.id]: rpc('eth-mainnet'),
    [arbitrum.id]: rpc('arb-mainnet'),
    [optimism.id]: rpc('opt-mainnet'),
    [polygon.id]: rpc('polygon-mainnet'),
    [base.id]: rpc('base-mainnet'),
  },
  ssr: true,
});


