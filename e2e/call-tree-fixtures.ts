// E2E 专用：直接复用 src 的确定性 fixtures（viem 离线编码），避免手工内联 hex。
export {
  ADDR,
  MAX_UINT256,
  encodeAccountExecute,
  encodeAggregate3,
  encodeApprove,
  encodeHandleOpsPacked,
  encodeMulticallBytes,
  encodeNestedAggregate3,
  encodeSafeExecTransaction,
  encodeTransfer,
} from '../src/features/txray/decoder/call-tree/fixtures';