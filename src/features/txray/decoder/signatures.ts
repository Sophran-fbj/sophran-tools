// 常见函数选择器（4 字节）→ 签名 + 危险等级 + 人话解释。
// 这是「内容资产」，也是 TxRay 教育向差异化的核心：不只解出函数名，还讲清风险。
// 未命中的选择器会去 openchain 反查（只得到签名，没有解释）。

export type Danger = 'high' | 'medium' | 'none';
export type KnownExplainKey =
  | 'approve'
  | 'approvalForAll'
  | 'permit'
  | 'transferFrom'
  | 'increaseAllowance'
  | 'transfer'
  | 'safeTransferFrom';

export interface KnownSig {
  signature: string; // 带参数名，便于展示与解码
  danger: Danger;
  explainKey: KnownExplainKey;
}

export const KNOWN_SIGNATURES: Record<string, KnownSig> = {
  '0x095ea7b3': {
    signature: 'approve(address spender, uint256 amount)',
    danger: 'high',
    explainKey: 'approve',
  },
  '0xa22cb465': {
    signature: 'setApprovalForAll(address operator, bool approved)',
    danger: 'high',
    explainKey: 'approvalForAll',
  },
  '0xd505accf': {
    signature:
      'permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
    danger: 'high',
    explainKey: 'permit',
  },
  '0x23b872dd': {
    signature: 'transferFrom(address from, address to, uint256 amount)',
    danger: 'medium',
    explainKey: 'transferFrom',
  },
  '0x39509351': {
    signature: 'increaseAllowance(address spender, uint256 addedValue)',
    danger: 'medium',
    explainKey: 'increaseAllowance',
  },
  '0xa9059cbb': {
    signature: 'transfer(address to, uint256 amount)',
    danger: 'none',
    explainKey: 'transfer',
  },
  '0x42842e0e': {
    signature: 'safeTransferFrom(address from, address to, uint256 tokenId)',
    danger: 'medium',
    explainKey: 'safeTransferFrom',
  },
};
