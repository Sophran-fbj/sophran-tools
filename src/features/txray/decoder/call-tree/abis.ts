import {
  keccak256,
  parseAbiItem,
  toFunctionSelector,
  type Abi,
  type AbiFunction,
  type AbiParameter,
} from 'viem';
import type { ContainerKind } from './types';

// ─── 已知调用容器 ABI（识别依据均为官方来源，注释注明出处与版本） ───────────────
//
// 1. Multicall3：官方仓库 mds1/multicall（src/Multicall3.sol）+ 主网部署合约
//    0xcA11bde05977b3631167028862bE2a173976CA11 的已验证源码（Blockscout）。
//    注意：部署版 Multicall3 不含 multicall(bytes[])；该选择器属于
//    Uniswap 路由 / MakerDAO Multicall 等其他合约（见 MULTICALL_BYTES_ABI 说明）。
// 2. Safe：safe-global/safe-contracts v1.4.1（contracts/Safe.sol execTransaction）。
// 3. 智能账户：eth-infinitism/account-abstraction v0.8.0（contracts/core/BaseAccount.sol
//    的 execute / executeBatch(Call[])，Call = (address,uint256,bytes)）。
// 4. ERC-4337：eth-infinitism/account-abstraction v0.8.0
//    （contracts/interfaces/PackedUserOperation.sol、contracts/interfaces/IEntryPoint.sol），
//    v0.9 EntryPoint 与 v0.8 ABI 兼容；v0.6 布局来自 EIP-4337 规范正文。
//    EntryPoint 官方地址（release notes）：
//      v0.6 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
//      v0.7 0x0000000071727De22E5E9d8BAf0edAc6f37da032
//      v0.8 0x4337084d9e255ff0702461cf8895ce9e3b5ff108
//      v0.9 0x433709009B8330FDa32311DF1C2AFA402eD8D009
// 5. Permit2：Uniswap/permit2 main（src/interfaces/IAllowanceTransfer.sol、
//    src/interfaces/ISignatureTransfer.sol），仅用于风险规则识别，不递归。

export const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
// Permit2 在所有链上同一地址（与 approvals/permit2.ts 相同；此处独立定义，
// 遵守「features 模块间不互相 import」约定）。
export const PERMIT2_ADDRESS = '0x000000000022D473030f116dDEE9F6B43aC78BA3';

// EntryPoint 官方地址 → 版本（eth-infinitism release notes，见文件头注释）。
export const ENTRYPOINT_ADDRESSES: Record<string, string> = {
  '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789': 'v0.6',
  '0x0000000071727de22e5e9d8baf0edac6f37da032': 'v0.7',
  '0x4337084d9e255ff0702461cf8895ce9e3b5ff108': 'v0.8',
  '0x433709009b8330fda32311df1c2afa402ed8d009': 'v0.9 (ABI 兼容 v0.8)',
};

// PackedUserOperation（v0.7+，优先支持）：结构定义与官方一致。
export const PACKED_USER_OPERATION_ABI = [
  parseAbiItem(
    'function handleOps((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops, address beneficiary)',
  ),
];

// UserOperation（v0.6 布局，EIP-4337 规范正文）：作为 fallback 尝试。
export const LEGACY_USER_OPERATION_ABI = [
  parseAbiItem(
    'function handleOps((address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary)',
  ),
];

export const MULTICALL3_AGGREGATE3_ABI = [
  parseAbiItem(
    'function aggregate3((address target, bool allowFailure, bytes callData)[] calls)',
  ),
];

export const MULTICALL3_AGGREGATE3_VALUE_ABI = [
  parseAbiItem(
    'function aggregate3Value((address target, bool allowFailure, uint256 value, bytes callData)[] calls)',
  ),
];

// multicall(bytes[])：多个合约使用同一选择器（Uniswap 路由、MakerDAO Multicall 等）。
// 识别依据只能是「选择器 + ABI 形状」，子调用在容器合约自身上下文执行，
// 具体语义（call / delegatecall、是否要求全部成功）取决于实现方。
export const MULTICALL_BYTES_ABI = [parseAbiItem('function multicall(bytes[] data)')];

export const SAFE_EXEC_TRANSACTION_ABI = [
  parseAbiItem(
    'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)',
  ),
];

export const ACCOUNT_EXECUTE_ABI = [
  parseAbiItem('function execute(address target, uint256 value, bytes data)'),
];

export const ACCOUNT_EXECUTE_BATCH_ABI = [
  parseAbiItem(
    'function executeBatch((address target, uint256 value, bytes data)[] calls)',
  ),
];

// Permit2 风险识别（不递归展开其中的 bytes）。字段布局与官方接口一致：
// - IAllowanceTransfer.permit(address owner, PermitSingle/PermitBatch, bytes signature)
//   PermitSingle  = (PermitDetails details, address spender, uint256 sigDeadline)
//   PermitDetails = (address token, uint160 amount, uint48 expiration, uint48 nonce)
// - ISignatureTransfer.permitTransferFrom(PermitTransferFrom, SignatureTransferDetails, address owner, bytes signature)
//   PermitTransferFrom = (TokenPermissions permitted, uint256 nonce, uint256 deadline)
//   TokenPermissions   = (address token, uint256 amount)
//   （这类 permit 没有 spender 字段：被授权方是调用 Permit2 的合约本身）
export const PERMIT2_PERMIT_ABIS = [
  parseAbiItem(
    'function permit(address owner, ((address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline) permitSingle, bytes signature)',
  ),
  parseAbiItem(
    'function permit(address owner, ((address token, uint160 amount, uint48 expiration, uint48 nonce)[] details, address spender, uint256 sigDeadline) permitBatch, bytes signature)',
  ),
  parseAbiItem(
    'function permitTransferFrom(((address token, uint256 amount) permitted, uint256 nonce, uint256 deadline) permit, (address to, uint256 requestedAmount) transferDetails, address owner, bytes signature)',
  ),
  parseAbiItem(
    'function permitTransferFrom(((address token, uint256 amount)[] permitted, uint256 nonce, uint256 deadline) permit, (address to, uint256 requestedAmount)[] transferDetails, address owner, bytes signature)',
  ),
];

export interface ContainerDefinition {
  kind: ContainerKind;
  abi: Abi;
  selector: string;
}

/**
 * Permit2 各 permit 函数的结构化字段位置（spender / deadline 在嵌套 tuple 里，
 * 扁平展示参数拿不到）。选择器 → 字段读取方式。
 */
export type Permit2FieldProfile =
  | 'allowance-single'
  | 'allowance-batch'
  | 'signature-single'
  | 'signature-batch';

export const PERMIT2_FIELD_PROFILES: Record<string, Permit2FieldProfile> = {
  [toFunctionSelector(PERMIT2_PERMIT_ABIS[0])]: 'allowance-single',
  [toFunctionSelector(PERMIT2_PERMIT_ABIS[1])]: 'allowance-batch',
  [toFunctionSelector(PERMIT2_PERMIT_ABIS[2])]: 'signature-single',
  [toFunctionSelector(PERMIT2_PERMIT_ABIS[3])]: 'signature-batch',
};

export const PERMIT2_PERMIT_ABI_BY_PROFILE: Record<Permit2FieldProfile, Abi> = {
  'allowance-single': PERMIT2_PERMIT_ABIS[0] as unknown as Abi,
  'allowance-batch': PERMIT2_PERMIT_ABIS[1] as unknown as Abi,
  'signature-single': PERMIT2_PERMIT_ABIS[2] as unknown as Abi,
  'signature-batch': PERMIT2_PERMIT_ABIS[3] as unknown as Abi,
};

// 选择器在模块加载时从官方 ABI 计算，避免手抄 4 字节出错。
function defineContainer(kind: ContainerKind, abi: Abi): ContainerDefinition {
  return { kind, abi, selector: toFunctionSelector(abi[0] as AbiFunction) };
}

export const CONTAINER_DEFINITIONS: ContainerDefinition[] = [
  defineContainer('entrypoint-handleOps', PACKED_USER_OPERATION_ABI),
  defineContainer('entrypoint-handleOps-legacy', LEGACY_USER_OPERATION_ABI),
  defineContainer('multicall3-aggregate3', MULTICALL3_AGGREGATE3_ABI),
  defineContainer('multicall3-aggregate3Value', MULTICALL3_AGGREGATE3_VALUE_ABI),
  defineContainer('multicall-bytes', MULTICALL_BYTES_ABI),
  defineContainer('safe-execTransaction', SAFE_EXEC_TRANSACTION_ABI),
  defineContainer('account-execute', ACCOUNT_EXECUTE_ABI),
  defineContainer('account-executeBatch', ACCOUNT_EXECUTE_BATCH_ABI),
];

/** bytes 字段的摘要（keccak256），用于 signature 等超长字段的有界展示。 */
export function keccakDigest(hex: `0x${string}`): string {
  return keccak256(hex);
}

/** ABI 参数类型的规范文本（tuple 递归展开，不影响 selector）。 */
function formatParamType(param: AbiParameter): string {
  const components = (param as { components?: readonly AbiParameter[] }).components;
  if (param.type === 'tuple' && components) {
    return `(${components.map(formatParamType).join(',')})`;
  }
  if (param.type.endsWith('[]')) {
    const base = param.type.slice(0, -2);
    return `${formatParamType({ ...param, type: base })}[]`;
  }
  return param.type;
}

/** ABI 项的人类可读规范签名（function name(types)，用于展示）。 */
export function abiSignature(abi: Abi): string {
  const item = abi[0] as AbiFunction;
  return `function ${item.name}(${item.inputs.map(formatParamType).join(',')})`;
}

/** 找到与选择器匹配的容器定义（可能多个，按声明顺序尝试）。 */
export function findContainerDefinitions(
  selector: string,
): ContainerDefinition[] {
  return CONTAINER_DEFINITIONS.filter((def) => def.selector === selector);
}
