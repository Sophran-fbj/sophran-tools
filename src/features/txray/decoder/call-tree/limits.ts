import type { DecodeLimits } from './types';

// 递归安全限制（见 docs/call-tree/report.md「递归限制」）。
// 达到限制时保留已解析节点、写入结构化 warning，绝不进入无限递归。
export const DEFAULT_DECODE_LIMITS: DecodeLimits = {
  maxDepth: 5,
  maxNodes: 100,
  // 32 KiB 已远超常规合约调用；再大的输入直接停止解析并提示。
  maxInputBytes: 32 * 1024,
  maxArrayItems: 64,
  // 展示预览截断为 256 字节（512 个 hex 字符）。
  maxRawPreviewBytes: 256,
  maxParamChars: 160,
};
