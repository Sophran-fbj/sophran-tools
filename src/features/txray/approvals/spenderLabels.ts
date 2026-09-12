import { type Address } from 'viem';

export interface SpenderLabel {
  name: string;
  trusted: boolean;
}

// 常见合约标签（地址用小写）。这是「内容资产」，可持续扩充或日后接公开标签库。
// 命中 = 显示名称 + 可信标记；未命中 = 「未知合约」黄色警示（风险更高）。
const MAINNET_LABELS: Record<string, SpenderLabel> = {
  // Uniswap
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': { name: 'Uniswap V2 Router', trusted: true },
  '0xe592427a0aece92de3edee1f18e0157c05861564': { name: 'Uniswap V3 Router', trusted: true },
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': { name: 'Uniswap SwapRouter02', trusted: true },
  '0x000000000022d473030f116ddee9f6b43ac78ba3': { name: 'Uniswap Permit2', trusted: true },
  // 聚合器
  '0x1111111254eeb25477b68fb85ed929f73a960582': { name: '1inch V5 Router', trusted: true },
  '0x111111125421ca6dc452d289314280a0f8842a65': { name: '1inch V6 Router', trusted: true },
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': { name: '0x Exchange Proxy', trusted: true },
  '0x881d40237659c251811cec9c364ef91dc08d300c': { name: 'MetaMask Swap Router', trusted: true },
  // NFT 市场
  '0x00000000000000adc04c56bf30ac9d3c0aaf14dc': { name: 'OpenSea Seaport 1.5', trusted: true },
  '0x0000000000000068f116a894984e2db1123eb395': { name: 'OpenSea Seaport 1.6', trusted: true },
  '0x000000000000ad05ccc4f10045630fb830b95127': { name: 'Blur Marketplace', trusted: true },
};

const LABELS_BY_CHAIN: Partial<Record<number, Record<string, SpenderLabel>>> = {
  1: MAINNET_LABELS,
};

export function getSpenderLabel(
  addr: Address,
  chainId = 1,
): SpenderLabel | undefined {
  return LABELS_BY_CHAIN[chainId]?.[addr.toLowerCase()];
}
