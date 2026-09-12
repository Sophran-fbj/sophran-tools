import { getAddress } from 'viem';
import type { Approval } from './useApprovals';
import type { SpenderRisk } from './useSpenderRisk';

export const demoApprovals: Approval[] = [
  {
    kind: 'erc20',
    id: 'demo-usdc-unlimited',
    token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    spender: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    allowance:
      115792089237316195423570985008687907853269984665640564039457584007913129639935n,
    unlimited: true,
    symbol: 'USDC',
    decimals: 6,
    amountText: '无限',
    atRiskAmountRaw: 2500000000n,
    atRiskAmountText: '2500',
  },
  {
    kind: 'permit2',
    id: 'demo-permit2-universal-router',
    token: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    spender: '0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B',
    amount: 1461501637330902918203684832716283019655932542975n,
    expiration: 4102444800,
    unlimited: true,
    symbol: 'WETH',
    decimals: 18,
    amountText: '无限',
    atRiskAmountRaw: 1500000000000000000n,
    atRiskAmountText: '1.5',
  },
  {
    kind: 'nft',
    id: 'demo-nft-unknown-operator',
    token: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
    spender: '0xFb3C2B2769A2119f349233A44A640F090C907667',
    symbol: 'BAYC',
  },
];

export const demoRiskMap: Record<string, SpenderRisk> = {
  ['0xE592427A0AEce92De3Edee1F18E0157C05861564'.toLowerCase()]: {
    level: 'known',
    labelName: 'Uniswap V3 Router',
    isEoa: false,
    codeVerified: true,
    reason: 'Uniswap V3 Router',
  },
  ['0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B'.toLowerCase()]: {
    level: 'known',
    labelName: 'Uniswap Universal Router',
    isEoa: false,
    codeVerified: true,
    reason: 'Uniswap Universal Router',
  },
  ['0xFb3C2B2769A2119f349233A44A640F090C907667'.toLowerCase()]: {
    level: 'eoa',
    isEoa: true,
    codeVerified: true,
    reason: '被授权方是普通钱包（无合约代码）——正常 dApp 不会这样，极可能是钓鱼',
  },
};

export const DEMO_OWNER = getAddress(
  '0x000000000000000000000000000000000000dEaD',
);
