import {
  encodeFunctionData,
  getAddress,
  parseAbiItem,
  type Address,
  type Hex,
} from 'viem';

// 离线确定性 fixtures：全部用 viem encodeFunctionData 从固定输入生成，
// 不访问网络、不依赖时间，可在 CI 重复执行。
//
// 地址都是公开的知名合约（USDC / Permit2 / Multicall3 / EntryPoint v0.7/v0.8），
// 仅作解码 fixture 使用，不代表任何风险判断。

export const ADDR = {
  usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
  spender: '0xe592427a0aece92de3edee1f18e0157c05861564' as Address,
  recipient: getAddress('0x00000000000000000000000000000000dead1234'),
  zero: '0x0000000000000000000000000000000000000000' as Address,
  permit2: '0x000000000022D473030f116dDEE9F6B43aC78BA3' as Address,
  multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11' as Address,
  otherMulticall: '0x5ba1e12693dc8f9c48aad8770482f4739beed696' as Address,
  safeProxy: '0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552' as Address,
  entrypointV07: '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address,
  entrypointV08: '0x4337084d9e255ff0702461cf8895ce9e3b5ff108' as Address,
  account: '0x6b175474e89094c44da98b954eedeac495271d0f' as Address,
  beneficiary: '0x1111111111111111111111111111111111111111' as Address,
} as const;

export const MAX_UINT256 = 2n ** 256n - 1n;
export const MAX_UINT160 = 2n ** 160n - 1n;

const approveAbi = [
  parseAbiItem('function approve(address spender, uint256 amount)'),
];
const transferAbi = [
  parseAbiItem('function transfer(address to, uint256 amount)'),
];
const transferFromAbi = [
  parseAbiItem('function transferFrom(address from, address to, uint256 amount)'),
];
const setApprovalForAllAbi = [
  parseAbiItem('function setApprovalForAll(address operator, bool approved)'),
];
const increaseAllowanceAbi = [
  parseAbiItem('function increaseAllowance(address spender, uint256 addedValue)'),
];
const permitAbi = [
  parseAbiItem(
    'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  ),
];
const safeAbi = [
  parseAbiItem(
    'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)',
  ),
];
const executeAbi = [
  parseAbiItem('function execute(address target, uint256 value, bytes data)'),
];
const executeBatchAbi = [
  parseAbiItem(
    'function executeBatch((address target, uint256 value, bytes data)[] calls)',
  ),
];
const aggregate3Abi = [
  parseAbiItem(
    'function aggregate3((address target, bool allowFailure, bytes callData)[] calls)',
  ),
];
const aggregate3ValueAbi = [
  parseAbiItem(
    'function aggregate3Value((address target, bool allowFailure, uint256 value, bytes callData)[] calls)',
  ),
];
const multicallBytesAbi = [parseAbiItem('function multicall(bytes[] data)')];
const handleOpsPackedAbi = [
  parseAbiItem(
    'function handleOps((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops, address beneficiary)',
  ),
];
const handleOpsLegacyAbi = [
  parseAbiItem(
    'function handleOps((address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary)',
  ),
];
const permit2PermitTransferFromAbi = [
  parseAbiItem(
    'function permitTransferFrom(((address token, uint256 amount) permitted, uint256 nonce, uint256 deadline) permit, (address to, uint256 requestedAmount) transferDetails, address owner, bytes signature)',
  ),
];
const permit2AllowancePermitAbi = [
  parseAbiItem(
    'function permit(address owner, ((address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline) permitSingle, bytes signature)',
  ),
];

export function encodeApprove(
  spender: Address = ADDR.spender,
  amount: bigint = MAX_UINT256,
): Hex {
  return encodeFunctionData({
    abi: approveAbi,
    functionName: 'approve',
    args: [spender, amount],
  });
}

export function encodeTransfer(to: Address, amount: bigint): Hex {
  return encodeFunctionData({ abi: transferAbi, functionName: 'transfer', args: [to, amount] });
}

export function encodeTransferFrom(
  from: Address,
  to: Address,
  amount: bigint,
): Hex {
  return encodeFunctionData({
    abi: transferFromAbi,
    functionName: 'transferFrom',
    args: [from, to, amount],
  });
}

export function encodeSetApprovalForAll(approved: boolean): Hex {
  return encodeFunctionData({
    abi: setApprovalForAllAbi,
    functionName: 'setApprovalForAll',
    args: [ADDR.spender, approved],
  });
}

export function encodeIncreaseAllowance(addedValue: bigint): Hex {
  return encodeFunctionData({
    abi: increaseAllowanceAbi,
    functionName: 'increaseAllowance',
    args: [ADDR.spender, addedValue],
  });
}

/** ERC-20 permit；v/r/s 用固定值（fixture 不验证签名）。 */
export function encodePermit(deadline: bigint): Hex {
  return encodeFunctionData({
    abi: permitAbi,
    functionName: 'permit',
    args: [
      ADDR.recipient,
      ADDR.spender,
      1000n,
      deadline,
      27,
      keccakLike('r'),
      keccakLike('s'),
    ],
  });
}

function keccakLike(seed: string): `0x${string}` {
  // 固定 32 字节值（非真实签名，fixture 只关心布局）。
  const filler = seed === 'r' ? '11' : '22';
  return (`0x${filler.repeat(32)}`) as `0x${string}`;
}

export function encodeSafeExecTransaction(options: {
  to?: Address;
  value?: bigint;
  data?: Hex;
  operation?: number;
  signatures?: Hex;
}): Hex {
  return encodeFunctionData({
    abi: safeAbi,
    functionName: 'execTransaction',
    args: [
      options.to ?? ADDR.spender,
      options.value ?? 0n,
      options.data ?? '0x',
      (options.operation ?? 0) as 0 | 1 | 2 | 3,
      0n,
      0n,
      0n,
      ADDR.zero,
      ADDR.zero,
      options.signatures ?? '0x',
    ],
  });
}

export function encodeAccountExecute(
  to: Address,
  value: bigint,
  data: Hex,
): Hex {
  return encodeFunctionData({
    abi: executeAbi,
    functionName: 'execute',
    args: [to, value, data],
  });
}

export function encodeAccountExecuteBatch(
  calls: Array<{ target: Address; value: bigint; data: Hex }>,
): Hex {
  return encodeFunctionData({
    abi: executeBatchAbi,
    functionName: 'executeBatch',
    args: [calls],
  });
}

export interface Call3 {
  target: Address;
  allowFailure: boolean;
  callData: Hex;
}

export function encodeAggregate3(calls: Call3[]): Hex {
  return encodeFunctionData({
    abi: aggregate3Abi,
    functionName: 'aggregate3',
    args: [calls],
  });
}

export interface Call3Value {
  target: Address;
  allowFailure: boolean;
  value: bigint;
  callData: Hex;
}

export function encodeAggregate3Value(calls: Call3Value[]): Hex {
  return encodeFunctionData({
    abi: aggregate3ValueAbi,
    functionName: 'aggregate3Value',
    args: [calls],
  });
}

export function encodeMulticallBytes(datas: Hex[]): Hex {
  return encodeFunctionData({
    abi: multicallBytesAbi,
    functionName: 'multicall',
    args: [datas],
  });
}

export interface PackedUserOperationLike {
  sender: Address;
  nonce?: bigint;
  initCode?: Hex;
  callData?: Hex;
  verificationGasLimit?: bigint;
  callGasLimit?: bigint;
  preVerificationGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  maxFeePerGas?: bigint;
  paymasterAndData?: Hex;
  signature?: Hex;
}

function pack128(low: bigint, high: bigint): Hex {
  const to128 = (value: bigint): string =>
    value.toString(16).padStart(32, '0');
  return (`0x${to128(low)}${to128(high)}`) as Hex;
}

/** v0.7+ PackedUserOperation → handleOps（EntryPoint 官方布局）。 */
export function encodeHandleOpsPacked(
  ops: PackedUserOperationLike[],
  beneficiary: Address = ADDR.beneficiary,
): Hex {
  const packed = ops.map((op) => ({
    sender: op.sender,
    nonce: op.nonce ?? 0n,
    initCode: op.initCode ?? '0x',
    callData: op.callData ?? '0x',
    accountGasLimits: pack128(
      op.verificationGasLimit ?? 150_000n,
      op.callGasLimit ?? 300_000n,
    ),
    preVerificationGas: op.preVerificationGas ?? 50_000n,
    gasFees: pack128(
      op.maxPriorityFeePerGas ?? 1_000_000_000n,
      op.maxFeePerGas ?? 2_000_000_000n,
    ),
    paymasterAndData: op.paymasterAndData ?? '0x',
    signature: op.signature ?? `0x${'ab'.repeat(65)}`,
  }));
  return encodeFunctionData({
    abi: handleOpsPackedAbi,
    functionName: 'handleOps',
    args: [packed, beneficiary],
  });
}

/** v0.6 UserOperation → handleOps（EIP-4337 规范布局）。 */
export function encodeHandleOpsLegacy(
  ops: PackedUserOperationLike[],
  beneficiary: Address = ADDR.beneficiary,
): Hex {
  const legacy = ops.map((op) => ({
    sender: op.sender,
    nonce: op.nonce ?? 0n,
    initCode: op.initCode ?? '0x',
    callData: op.callData ?? '0x',
    callGasLimit: op.callGasLimit ?? 300_000n,
    verificationGasLimit: op.verificationGasLimit ?? 150_000n,
    preVerificationGas: op.preVerificationGas ?? 50_000n,
    maxFeePerGas: op.maxFeePerGas ?? 2_000_000_000n,
    maxPriorityFeePerGas: op.maxPriorityFeePerGas ?? 1_000_000_000n,
    paymasterAndData: op.paymasterAndData ?? '0x',
    signature: op.signature ?? `0x${'ab'.repeat(65)}`,
  }));
  return encodeFunctionData({
    abi: handleOpsLegacyAbi,
    functionName: 'handleOps',
    args: [legacy, beneficiary],
  });
}

/** Permit2 permitTransferFrom（单 token）。 */
export function encodePermit2PermitTransferFrom(
  deadline: bigint,
  amount: bigint = MAX_UINT160,
): Hex {
  return encodeFunctionData({
    abi: permit2PermitTransferFromAbi,
    functionName: 'permitTransferFrom',
    args: [
      {
        permitted: { token: ADDR.usdc, amount },
        nonce: 0n,
        deadline,
      },
      { to: ADDR.recipient, requestedAmount: 1n },
      ADDR.recipient,
      `0x${'cd'.repeat(65)}`,
    ],
  });
}

/** Permit2 allowance permit（PermitSingle：spender/sigDeadline 在嵌套 tuple 中）。 */
export function encodePermit2AllowancePermit(
  deadline: bigint,
  spender: Address = ADDR.spender,
): Hex {
  return encodeFunctionData({
    abi: permit2AllowancePermitAbi,
    functionName: 'permit',
    args: [
      ADDR.recipient,
      {
        details: { token: ADDR.usdc, amount: MAX_UINT160, expiration: 0, nonce: 0 },
        spender,
        sigDeadline: deadline,
      },
      `0x${'ef'.repeat(65)}`,
    ],
  });
}

/** 把 approve 包进 N 层 aggregate3（第 1 层是最外层容器）。 */
export function encodeNestedAggregate3(depth: number): Hex {
  let inner: Hex = encodeApprove();
  for (let level = 0; level < depth; level += 1) {
    inner = encodeAggregate3([
      { target: ADDR.multicall3, allowFailure: false, callData: inner },
    ]);
  }
  return inner;
}

// ─── 畸形 / 对抗 fixtures ────────────────────────────────────────────────

export const MALFORMED = {
  oddLengthHex: '0x095ea7b33',
  notHex: '0xzzzz1234',
  tooShort: '0x1234',
  /** approve selector + 半个 word（参数截断）。 */
  truncatedArgs: '0x095ea7b3000000000000000000000000e592427a0aece92de3edee1f',
  /** aggregate3 selector + 无法解析的偏移量。 */
  badOffset: `0x82ad56cb${'ff'.repeat(32)}${'00'.repeat(64)}`,
  /** 未知 selector + 不足以解码的长度。 */
  unknownSelector: '0xdeadbeef00000000',
} as const;

/** 生成 0x + n 字节的伪随机但确定的数据。 */
export function deterministicBlob(nBytes: number, seed = 7): Hex {
  let state = seed;
  const bytes: string[] = [];
  for (let index = 0; index < nBytes; index += 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    bytes.push((state % 256).toString(16).padStart(2, '0'));
  }
  return (`0x${bytes.join('')}`) as Hex;
}

/** 超大 aggregate3（每个子调用都是 approve）。 */
export function encodeHugeAggregate3(count: number): Hex {
  const calls: Call3[] = [];
  for (let index = 0; index < count; index += 1) {
    calls.push({
      target: ADDR.usdc,
      allowFailure: false,
      callData: encodeApprove(ADDR.spender, BigInt(index + 1)),
    });
  }
  return encodeAggregate3(calls);
}

/** bytes 参数碰巧以合法 selector 开头但不应递归：Safe 的 signatures 字段。 */
export const SAFE_SIGNATURES_LOOKS_LIKE_APPROVE = encodeApprove();

/** 空 batch。 */
export const EMPTY_AGGREGATE3 = encodeAggregate3([]);
export const EMPTY_EXECUTE_BATCH = encodeAccountExecuteBatch([]);
