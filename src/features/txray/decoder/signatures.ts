// 常见函数选择器（4 字节）→ 签名 + 危险等级 + 人话解释。
// 这是「内容资产」，也是 TxRay 教育向差异化的核心：不只解出函数名，还讲清风险。
// 未命中的选择器会去 openchain 反查（只得到签名，没有解释）。

export type Danger = 'high' | 'medium' | 'none';

export interface KnownSig {
  signature: string; // 带参数名，便于展示与解码
  danger: Danger;
  explain: string;
}

export const KNOWN_SIGNATURES: Record<string, KnownSig> = {
  '0x095ea7b3': {
    signature: 'approve(address spender, uint256 amount)',
    danger: 'high',
    explain:
      '授权 spender 花费你的代币。若 amount 是无限值，spender 可随时转走你全部该代币——这是最常见的高风险授权，务必确认 spender 可信。',
  },
  '0xa22cb465': {
    signature: 'setApprovalForAll(address operator, bool approved)',
    danger: 'high',
    explain:
      '把你某个 NFT 合集里「全部 NFT」的处置权交给 operator。approved=true 即整集合授权——NFT 被盗的常见入口，高风险。',
  },
  '0xd505accf': {
    signature:
      'permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
    danger: 'high',
    explain:
      'EIP-2612 离线签名授权：一个签名就能让 spender 获得额度，不需要单独发交易。钓鱼网站常诱导你签 permit——高风险，确认 spender。',
  },
  '0x23b872dd': {
    signature: 'transferFrom(address from, address to, uint256 amount)',
    danger: 'medium',
    explain:
      '从 from 向 to 转账。通常由「被授权方」调用，意味着有人正在动用对你的授权把币转走。',
  },
  '0x39509351': {
    signature: 'increaseAllowance(address spender, uint256 addedValue)',
    danger: 'medium',
    explain: '增加 spender 的可花费额度。',
  },
  '0xa9059cbb': {
    signature: 'transfer(address to, uint256 amount)',
    danger: 'none',
    explain: '把代币转给 to。普通转账，风险低。',
  },
  '0x42842e0e': {
    signature: 'safeTransferFrom(address from, address to, uint256 tokenId)',
    danger: 'medium',
    explain: '转移一个 NFT（tokenId）。',
  },
};
