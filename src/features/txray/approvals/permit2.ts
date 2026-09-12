import { getAddress } from 'viem';

// Permit2 在所有链上都是同一个地址
export const PERMIT2_ADDRESS = getAddress(
  '0x000000000022d473030f116ddee9f6b43ac78ba3',
);

// 超过此量级即视为无限（uint160 最大值约 2^160）
export const PERMIT2_UNLIMITED_THRESHOLD = 2n ** 150n;

export const permit2Abi = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
    ],
    outputs: [],
  },
] as const;

// 事件签名（topic0 在服务端用 viem 的 toEventSelector 运行时计算，避免硬编码哈希出错）
// 两个事件里 owner/token/spender 均为 indexed：topic1=owner, topic2=token, topic3=spender
export const PERMIT2_APPROVAL_EVENT =
  'Approval(address,address,address,uint160,uint48)';
export const PERMIT2_PERMIT_EVENT =
  'Permit(address,address,address,uint160,uint48,uint48)';
