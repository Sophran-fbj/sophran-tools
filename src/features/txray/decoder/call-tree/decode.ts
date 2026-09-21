import {
  decodeFunctionData,
  parseAbiItem,
  type Abi,
  type AbiFunction,
} from 'viem';
import { KNOWN_SIGNATURES } from '../signatures';
import {
  ENTRYPOINT_ADDRESSES,
  MULTICALL3_ADDRESS,
  PERMIT2_FIELD_PROFILES,
  PERMIT2_PERMIT_ABI_BY_PROFILE,
  abiSignature,
  findContainerDefinitions,
  keccakDigest,
  type ContainerDefinition,
  type Permit2FieldProfile,
} from './abis';
import {
  formatDecodedValue,
  hexByteLength,
  isEmptyHex,
  normalizeHex,
  rawPreview,
} from './format';
import { DEFAULT_DECODE_LIMITS } from './limits';
import { collectRiskFindings } from './risk';
import type {
  CallNode,
  CallNodeParam,
  CallTreeInput,
  CallTreeOptions,
  CallTreeResult,
  ContainerInfo,
  DecodeLimits,
  RiskSeverity,
  SourceKind,
  StructuredWarning,
  UserOpInfo,
  WarningCode,
} from './types';

// 有界递归调用树解码核心（纯 TypeScript，无 React / DOM / 网络）。
//
// 递归规则：只有已知容器 ABI 中「明确代表子调用的字段」才会继续展开
// （Multicall3 calls[].callData、multicall(bytes[]) 的 data 元素、Safe
// execTransaction 的 data、execute/executeBatch 的 data/Call[].data、
// ERC-4337 UserOperation 的 callData）。任意其他 bytes 一律不递归。
//
// 安全限制：深度 / 节点数 / 输入字节数 / 数组项数 / 展示长度全部有界；
// 达到限制时保留已解析内容并写入结构化 warning，绝不抛出未捕获异常。

interface TreeState {
  limits: DecodeLimits;
  signatures: Record<string, string>;
  nodeCount: number;
  truncated: boolean;
}

function addWarningOnce(
  target: { warnings: StructuredWarning[] },
  warning: StructuredWarning,
): void {
  const exists = target.warnings.some(
    (item) => item.code === warning.code && item.detail === warning.detail,
  );
  if (!exists) target.warnings.push(warning);
}

function createNode(
  rawData: string,
  sourceKind: SourceKind,
  depth: number,
  path: string,
  state: TreeState,
  allowFailure: boolean | null,
): CallNode {
  const id = `n${state.nodeCount}`;
  state.nodeCount += 1;
  const preview = rawPreview(rawData, state.limits.maxRawPreviewBytes);
  return {
    id,
    path,
    depth,
    target: null,
    value: null,
    selector: null,
    signature: null,
    functionName: null,
    params: [],
    children: [],
    riskFindings: [],
    warnings: [],
    decodeStatus: 'unknown',
    stopReason: null,
    rawData,
    rawPreview: preview.preview,
    sourceKind,
    container: null,
    userOp: null,
    permit2: null,
    allowFailure,
  };
}

const signatureItemCache = new Map<string, AbiFunction | null>();

function signatureAbiItem(signature: string): AbiFunction | null {
  const cached = signatureItemCache.get(signature);
  if (cached !== undefined) return cached;
  let item: AbiFunction | null = null;
  try {
    const parsed = parseAbiItem(`function ${signature}`);
    if (parsed.type === 'function') item = parsed;
  } catch {
    item = null;
  }
  signatureItemCache.set(signature, item);
  return item;
}

function candidateSignatures(selector: string, state: TreeState): string[] {
  const candidates: string[] = [];
  const known = KNOWN_SIGNATURES[selector]?.signature;
  if (known) candidates.push(known);
  const injected = state.signatures[selector];
  if (injected && injected !== known) candidates.push(injected);
  return candidates;
}

interface DecodedCall {
  functionName: string;
  inputs: readonly { name?: string; type: string }[];
  args: readonly unknown[];
  signature: string;
}

function tryDecodeWithAbi(abi: Abi, data: string): DecodedCall | null {
  try {
    const decoded = decodeFunctionData({ abi, data: data as `0x${string}` });
    return {
      functionName: (abi[0] as AbiFunction).name,
      inputs: (abi[0] as AbiFunction).inputs,
      args: decoded.args ?? [],
      signature: abiSignature(abi),
    };
  } catch {
    return null;
  }
}

interface CallMeta {
  to: string | null;
  value: bigint | null;
}

/**
 * 解码单个调用节点并按容器定义递归展开。
 * 返回 null 表示节点预算已耗尽（父节点负责记录 warning）。
 */
function decodeCall(
  data: string,
  meta: CallMeta,
  sourceKind: SourceKind,
  depth: number,
  path: string,
  state: TreeState,
  allowFailure: boolean | null,
): CallNode | null {
  if (state.nodeCount >= state.limits.maxNodes) {
    state.truncated = true;
    return null;
  }

  const normalized = normalizeHex(data);
  const node = createNode(
    normalized ?? data,
    sourceKind,
    depth,
    path,
    state,
    allowFailure,
  );
  // target 统一小写（参数值保留 viem 的 EIP-55 校验和形式便于展示）。
  node.target = meta.to ? meta.to.toLowerCase() : null;
  node.value = meta.value !== null ? meta.value.toString() : null;

  if (normalized === null) {
    node.decodeStatus = 'malformed';
    addWarningOnce(node, {
      code: 'child-decode-failed',
      detail: 'invalid-hex',
    });
    return node;
  }
  if (isEmptyHex(normalized)) {
    // 空 calldata：纯转账，没有可解码的调用数据（不是格式错误）。
    node.decodeStatus = 'decoded';
    addWarningOnce(node, { code: 'empty-calldata' });
    return node;
  }
  if (hexByteLength(normalized) < 4) {
    node.decodeStatus = 'malformed';
    addWarningOnce(node, {
      code: 'child-decode-failed',
      detail: 'selector-truncated',
    });
    return node;
  }

  const selector = normalized.slice(0, 10).toLowerCase();
  node.selector = selector;

  if (hexByteLength(normalized) > state.limits.maxInputBytes) {
    node.decodeStatus = 'recursion-stopped';
    node.stopReason = 'max-input-bytes';
    addWarningOnce(node, { code: 'max-input-bytes-exceeded' });
    return node;
  }

  // 1) 已知容器：selector 匹配 + 官方 ABI 形状解码成功才认定。
  for (const definition of findContainerDefinitions(selector)) {
    const decoded = tryDecodeWithAbi(definition.abi as unknown as Abi, normalized);
    if (decoded) {
      expandContainer(node, definition, decoded, meta, depth, path, state);
      return node;
    }
  }

  // 2) Permit2 permit：官方 ABI 本地解码（不依赖签名库），并提取嵌套字段。
  const permit2Profile = PERMIT2_FIELD_PROFILES[selector];
  if (permit2Profile) {
    const decoded = tryDecodeWithAbi(
      [
        PERMIT2_PERMIT_ABI_BY_PROFILE[permit2Profile],
      ] as unknown as Abi,
      normalized,
    );
    if (decoded) {
      node.functionName = decoded.functionName;
      node.signature = decoded.signature;
      node.params = formatParams(decoded.inputs, decoded.args, state.limits);
      node.decodeStatus = 'decoded';
      node.permit2 = extractPermit2Fields(permit2Profile, decoded.args);
      return node;
    }
    // 形状对不上时继续走签名表路径（可能 signature-only）。
  }

  // 3) 普通调用：本地已知签名表 / 注入签名表（可能有歧义，逐个尝试）。
  const candidates = candidateSignatures(selector, state);
  node.signature = candidates[0] ?? null;
  if (candidates.length === 0) {
    node.decodeStatus = 'unknown';
    return node;
  }
  for (const signature of candidates) {
    const item = signatureAbiItem(signature);
    if (!item) continue;
    const decoded = tryDecodeWithAbi([item] as unknown as Abi, normalized);
    if (!decoded) continue;
    node.functionName = decoded.functionName;
    node.params = formatParams(decoded.inputs, decoded.args, state.limits);
    node.decodeStatus = 'decoded';
    return node;
  }
  // 签名能识别但参数解不出来：仅识别签名。
  node.decodeStatus = 'signature-only';
  return node;
}

/**
 * 从 Permit2 permit 的解码参数里提取 spender / deadline。
 * 字段位置与官方接口一致（见 abis.ts 注释）：
 * - allowance-single/batch: args[1] = (details, spender, sigDeadline)
 * - signature-single/batch: args[0] = (permitted, nonce, deadline)；无 spender 字段
 */
function extractPermit2Fields(
  profile: Permit2FieldProfile,
  args: readonly unknown[],
): { spender: string | null; deadline: string | null } {
  const holder = profile.startsWith('allowance') ? args[1] : args[0];
  const spender =
    profile.startsWith('allowance') && holder !== null && typeof holder === 'object'
      ? readString(holder, 'spender')
      : null;
  const deadlineRaw =
    holder !== null && typeof holder === 'object'
      ? readBigint(holder, profile.startsWith('allowance') ? 'sigDeadline' : 'deadline')
      : null;
  return {
    spender,
    deadline: deadlineRaw !== null ? deadlineRaw.toString() : null,
  };
}

function formatParams(
  inputs: readonly { name?: string; type: string }[],
  args: readonly unknown[],
  limits: DecodeLimits,
): CallNodeParam[] {
  return inputs.map((input, index) => {
    const formatted = formatDecodedValue(args[index], limits.maxParamChars);
    return {
      name: input.name || undefined,
      type: input.type,
      value: formatted.value,
      isAddress: input.type === 'address',
      truncated: formatted.truncated,
    };
  });
}

function expandContainer(
  node: CallNode,
  definition: ContainerDefinition,
  decoded: DecodedCall,
  meta: CallMeta,
  depth: number,
  path: string,
  state: TreeState,
): void {
  node.functionName = decoded.functionName;
  node.signature = decoded.signature;
  node.decodeStatus = 'decoded';
  node.container = buildContainerInfo(definition, meta);

  switch (definition.kind) {
    case 'multicall3-aggregate3':
    case 'multicall3-aggregate3Value':
    case 'multicall-bytes':
    case 'account-executeBatch':
      expandArrayContainer(node, definition, decoded, depth, path, state);
      return;
    case 'safe-execTransaction':
      expandSafe(node, decoded, depth, path, state);
      return;
    case 'account-execute':
      expandExecute(node, decoded, depth, path, state);
      return;
    case 'entrypoint-handleOps':
    case 'entrypoint-handleOps-legacy':
      expandHandleOps(node, definition, decoded, depth, path, state);
      return;
    default:
      return;
  }
}

// EntryPoint 地址版本 → 官方 UserOperation 布局（release notes，见 abis.ts）。
const ENTRYPOINT_LAYOUT_BY_VERSION: Record<string, 'packed' | 'legacy'> = {
  'v0.6': 'legacy',
  'v0.7': 'packed',
  'v0.8': 'packed',
  'v0.9 (ABI 兼容 v0.8)': 'packed',
};

function buildContainerInfo(
  definition: ContainerDefinition,
  meta: CallMeta,
): ContainerInfo {
  const target = meta.to?.toLowerCase() ?? null;
  switch (definition.kind) {
    case 'multicall3-aggregate3':
    case 'multicall3-aggregate3Value': {
      const canonical = target === MULTICALL3_ADDRESS.toLowerCase();
      return {
        kind: definition.kind,
        identification: canonical
          ? 'canonical-address-and-abi'
          : 'selector-and-abi-shape',
        note: canonical ? undefined : 'canonical-address-mismatch',
      };
    }
    case 'entrypoint-handleOps':
    case 'entrypoint-handleOps-legacy': {
      const packed = definition.kind === 'entrypoint-handleOps';
      const layout: 'packed' | 'legacy' = packed ? 'packed' : 'legacy';
      const fallbackVersion = packed ? 'v0.7+' : 'v0.6';
      const addressVersion = target
        ? ENTRYPOINT_ADDRESSES[target]
        : undefined;
      // 地址已知但官方布局与实际 calldata 布局不一致时，不能声称
      // 「官方地址 + 官方 ABI 均匹配」，必须降级为形状识别并提示矛盾。
      if (addressVersion) {
        if (ENTRYPOINT_LAYOUT_BY_VERSION[addressVersion] === layout) {
          return {
            kind: definition.kind,
            identification: 'entrypoint-canonical-address-and-abi',
            version: addressVersion,
          };
        }
        return {
          kind: definition.kind,
          identification: 'selector-and-abi-shape',
          version: fallbackVersion,
          note: 'entrypoint-layout-mismatch',
        };
      }
      return {
        kind: definition.kind,
        identification: 'selector-and-abi-shape',
        version: fallbackVersion,
        note: 'entrypoint-address-unknown',
      };
    }
    case 'multicall-bytes':
      return {
        kind: definition.kind,
        identification: 'selector-and-abi-shape',
        note: 'multicall-bytes-shared',
      };
    case 'safe-execTransaction':
      return {
        kind: definition.kind,
        identification: 'selector-and-abi-shape',
        note: 'safe-selector-shared',
      };
    case 'account-execute':
    case 'account-executeBatch':
      return {
        kind: definition.kind,
        identification: 'selector-and-abi-shape',
      };
    default:
      return {
        kind: definition.kind,
        identification: 'selector-and-abi-shape',
      };
  }
}

// ─── 子节点展开 ──────────────────────────────────────────────────────────

function canExpandChildren(depth: number, state: TreeState): boolean {
  return depth < state.limits.maxDepth;
}

function markRecursionStopped(
  node: CallNode,
  stopReason: 'max-depth' | 'max-nodes',
): void {
  node.decodeStatus = 'recursion-stopped';
  node.stopReason = stopReason;
  addWarningOnce(node, {
    code: stopReason === 'max-depth' ? 'max-depth-reached' : 'max-nodes-reached',
  });
}

interface ChildSlot {
  target: string | null;
  value: bigint | null;
  callData: string;
  allowFailure: boolean | null;
}

/** 展开 aggregate3 / aggregate3Value / multicall(bytes[]) / executeBatch。 */
function expandArrayContainer(
  node: CallNode,
  definition: ContainerDefinition,
  decoded: DecodedCall,
  depth: number,
  path: string,
  state: TreeState,
): void {
  const items = asArray(decoded.args[0]);
  const slots: ChildSlot[] = [];

  if (definition.kind === 'account-executeBatch') {
    for (const call of items) {
      slots.push({
        target: readString(call, 'target'),
        value: readBigint(call, 'value'),
        callData: readString(call, 'data') ?? '0x',
        allowFailure: null,
      });
    }
  } else if (definition.kind === 'multicall-bytes') {
    for (const item of items) {
      slots.push({
        // multicall(bytes[]) 的每个元素都在容器合约自身上下文执行。
        target: node.target,
        value: null,
        callData: typeof item === 'string' ? item : '0x',
        allowFailure: null,
      });
    }
  } else {
    for (const call of items) {
      slots.push({
        target: readString(call, 'target'),
        value:
          definition.kind === 'multicall3-aggregate3Value'
            ? readBigint(call, 'value')
            : null,
        callData: readString(call, 'callData') ?? '0x',
        allowFailure: readBoolean(call, 'allowFailure'),
      });
    }
  }

  // 数组项数限制：超出部分不解析，保留已解析内容。
  let capped = false;
  if (slots.length > state.limits.maxArrayItems) {
    slots.length = state.limits.maxArrayItems;
    capped = true;
  }

  node.params = containerParams(decoded, items.length, state.limits);

  if (slots.length === 0) return;
  if (!canExpandChildren(depth, state)) {
    markRecursionStopped(node, 'max-depth');
    return;
  }

  const sourceKind: SourceKind =
    definition.kind === 'multicall3-aggregate3' ||
    definition.kind === 'multicall3-aggregate3Value'
      ? 'multicall3-subcall'
      : definition.kind === 'multicall-bytes'
        ? 'multicall-bytes-subcall'
        : 'account-executeBatch-subcall';

  let budgetTruncated = false;
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const child = decodeCall(
      slot.callData,
      { to: slot.target, value: slot.value },
      sourceKind,
      depth + 1,
      `${path}.${index}`,
      state,
      slot.allowFailure,
    );
    if (child === null) {
      budgetTruncated = true;
      break;
    }
    node.children.push(child);
  }
  finishExpansion(node, {
    arrayTruncated: capped,
    budgetTruncated,
    expected: items.length,
    actual: node.children.length,
    state,
  });
}

/** Safe execTransaction：单个内部调用（data），区分 CALL / DELEGATECALL。 */
function expandSafe(
  node: CallNode,
  decoded: DecodedCall,
  depth: number,
  path: string,
  state: TreeState,
): void {
  const to = readString(decoded.args[0]) ?? null;
  const value = readBigint(decoded.args[1]);
  const data = readString(decoded.args[2]) ?? '0x';
  // 保留 to / value / data / operation；跳过 gas 与 signatures 等展示价值低的字段。
  node.params = scalarParams(decoded, [4, 5, 6, 7, 8, 9], state.limits);
  if (!canExpandChildren(depth, state)) {
    markRecursionStopped(node, 'max-depth');
    return;
  }
  const child = decodeCall(
    data,
    { to, value },
    'safe-inner-call',
    depth + 1,
    `${path}.0`,
    state,
    null,
  );
  finishExpansion(node, {
    budgetTruncated: child === null,
    expected: 1,
    actual: child ? 1 : 0,
    state,
  });
  if (child) node.children.push(child);
}

/** execute(address,uint256,bytes)：单个内部调用。 */
function expandExecute(
  node: CallNode,
  decoded: DecodedCall,
  depth: number,
  path: string,
  state: TreeState,
): void {
  const to = readString(decoded.args[0]) ?? null;
  const value = readBigint(decoded.args[1]);
  const data = readString(decoded.args[2]) ?? '0x';
  // execute 的三个参数完全由子节点呈现，不重复展示。
  node.params = [];
  if (!canExpandChildren(depth, state)) {
    markRecursionStopped(node, 'max-depth');
    return;
  }
  const child = decodeCall(
    data,
    { to, value },
    'account-execute-inner-call',
    depth + 1,
    `${path}.0`,
    state,
    null,
  );
  finishExpansion(node, {
    budgetTruncated: child === null,
    expected: 1,
    actual: child ? 1 : 0,
    state,
  });
  if (child) node.children.push(child);
}

/** handleOps：每个 UserOperation 一个子节点，其 callData 再展开一层。 */
function expandHandleOps(
  node: CallNode,
  definition: ContainerDefinition,
  decoded: DecodedCall,
  depth: number,
  path: string,
  state: TreeState,
): void {
  const items = asArray(decoded.args[0]);
  node.params = [
    {
      name: 'opsCount',
      type: 'uint256',
      value: String(items.length),
      isAddress: false,
      truncated: false,
    },
    {
      name: 'beneficiary',
      type: 'address',
      value: formatDecodedValue(decoded.args[1], state.limits.maxParamChars).value,
      isAddress: true,
      truncated: false,
    },
  ];

  if (items.length === 0) return;
  if (!canExpandChildren(depth, state)) {
    markRecursionStopped(node, 'max-depth');
    return;
  }

  const capped = items.length > state.limits.maxArrayItems;
  const visible = capped ? items.slice(0, state.limits.maxArrayItems) : items;
  let budgetTruncated = false;
  for (let index = 0; index < visible.length; index += 1) {
    const opNode = createUserOpNode(
      visible[index],
      definition,
      depth + 1,
      `${path}.${index}`,
      state,
    );
    if (opNode === null) {
      budgetTruncated = true;
      break;
    }
    node.children.push(opNode);
  }
  finishExpansion(node, {
    arrayTruncated: capped,
    budgetTruncated,
    expected: items.length,
    actual: node.children.length,
    state,
  });
}

function createUserOpNode(
  op: unknown,
  definition: ContainerDefinition,
  depth: number,
  path: string,
  state: TreeState,
): CallNode | null {
  if (state.nodeCount >= state.limits.maxNodes) {
    state.truncated = true;
    return null;
  }
  const packed = definition.kind === 'entrypoint-handleOps';
  const userOp = packed ? readUserOpInfo(op, 'v0.7+') : readUserOpInfo(op, 'v0.6');
  const callData = readString(op, 'callData') ?? '0x';
  const sender = readString(op, 'sender');
  const node = createNode(callData, 'userop-operation', depth, path, state, null);
  node.target = sender;
  node.functionName = 'UserOperation';
  node.decodeStatus = 'decoded';
  node.userOp = userOp;
  node.container = {
    kind: 'entrypoint-userOperation',
    identification: 'abi-struct-shape',
    version: userOp.version,
  };
  node.params = userOpParams(op, userOp, callData, state.limits);

  if (isEmptyHex(callData)) {
    addWarningOnce(node, { code: 'empty-calldata' });
    return node;
  }
  if (!canExpandChildren(depth, state)) {
    markRecursionStopped(node, 'max-depth');
    return node;
  }
  // callData 由 sender 账户合约执行：该节点目标即 sender（EntryPoint 调 sender）。
  const child = decodeCall(
    callData,
    { to: sender, value: 0n },
    'userop-call-data',
    depth + 1,
    `${path}.0`,
    state,
    null,
  );
  if (child === null) {
    state.truncated = true;
    markRecursionStopped(node, 'max-nodes');
    return node;
  }
  node.children.push(child);
  return node;
}

// ─── UserOperation 字段摘要 ──────────────────────────────────────────────

function readUserOpInfo(op: unknown, version: string): UserOpInfo {
  const initCode = readString(op, 'initCode') ?? '0x';
  const paymasterAndData = readString(op, 'paymasterAndData') ?? '0x';
  return {
    version,
    factory: extractAddress(initCode),
    paymaster: extractAddress(paymasterAndData),
  };
}

function extractAddress(bytes: string): string | null {
  if (isEmptyHex(bytes) || bytes.length < 42) return null;
  return bytes.slice(0, 42).toLowerCase();
}

function userOpParams(
  op: unknown,
  userOp: UserOpInfo,
  callData: string,
  limits: DecodeLimits,
): CallNodeParam[] {
  const params: CallNodeParam[] = [];
  const push = (name: string, type: string, raw: unknown, isAddress = false): void => {
    const formatted = formatDecodedValue(raw, limits.maxParamChars);
    params.push({
      name,
      type,
      value: formatted.value,
      isAddress,
      truncated: formatted.truncated,
    });
  };

  push('sender', 'address', readString(op, 'sender'), true);
  push('nonce', 'uint256', readBigint(op, 'nonce'));
  push('initCode', 'bytes', readString(op, 'initCode') ?? '0x');
  if (userOp.factory) push('factory', 'address', userOp.factory, true);
  push('callData', 'bytes', callData);

  const packedGas = readString(op, 'accountGasLimits');
  if (packedGas) {
    // packed（v0.7+）：从 bytes32 解出 4 个 uint128 gas 字段（官方布局：
    // accountGasLimits = verificationGasLimit(16B) ++ callGasLimit(16B)，
    // gasFees = maxPriorityFeePerGas(16B) ++ maxFeePerGas(16B)）。
    push('verificationGasLimit', 'uint128', hexSliceBigint(packedGas, 2, 34));
    push('callGasLimit', 'uint128', hexSliceBigint(packedGas, 34, 66));
    push('preVerificationGas', 'uint256', readBigint(op, 'preVerificationGas'));
    const gasFees = readString(op, 'gasFees');
    if (gasFees) {
      push('maxPriorityFeePerGas', 'uint128', hexSliceBigint(gasFees, 2, 34));
      push('maxFeePerGas', 'uint128', hexSliceBigint(gasFees, 34, 66));
    }
  } else {
    push('callGasLimit', 'uint256', readBigint(op, 'callGasLimit'));
    push('verificationGasLimit', 'uint256', readBigint(op, 'verificationGasLimit'));
    push('preVerificationGas', 'uint256', readBigint(op, 'preVerificationGas'));
    push('maxFeePerGas', 'uint256', readBigint(op, 'maxFeePerGas'));
    push('maxPriorityFeePerGas', 'uint256', readBigint(op, 'maxPriorityFeePerGas'));
  }

  push('paymasterAndData', 'bytes', readString(op, 'paymasterAndData') ?? '0x');
  if (userOp.paymaster) push('paymaster', 'address', userOp.paymaster, true);

  // 签名只展示长度和摘要，避免巨大输出；不验证签名。
  const signature = readString(op, 'signature') ?? '0x';
  const signatureBytes = isEmptyHex(signature) ? 0 : (signature.length - 2) / 2;
  params.push({
    name: 'signature',
    type: 'bytes',
    value: `len=${signatureBytes}, keccak256=${keccakDigest(signature as `0x${string}`)}`,
    isAddress: false,
    truncated: false,
  });
  return params;
}

function hexSliceBigint(hex: string, start: number, end: number): bigint {
  const slice = hex.slice(start, end);
  return BigInt(slice.length > 0 ? `0x${slice}` : '0x0');
}

// ─── 容器参数展示（数组 → 计数，避免超长输出） ───────────────────────────

function containerParams(
  decoded: DecodedCall,
  itemCount: number,
  limits: DecodeLimits,
): CallNodeParam[] {
  const params: CallNodeParam[] = [];
  decoded.inputs.forEach((input, index) => {
    const name = input.name || `arg${index}`;
    if (input.type.endsWith('[]')) {
      params.push({
        name: `${name}Count`,
        type: 'uint256',
        value: String(itemCount),
        isAddress: false,
        truncated: false,
      });
      return;
    }
    const formatted = formatDecodedValue(decoded.args[index], limits.maxParamChars);
    params.push({
      name,
      type: input.type,
      value: formatted.value,
      isAddress: input.type === 'address',
      truncated: formatted.truncated,
    });
  });
  return params;
}

/** 标量参数列表（跳过 skipIndexes，例如 Safe 的 gas / signatures 字段）。 */
function scalarParams(
  decoded: DecodedCall,
  skipIndexes: number[],
  limits: DecodeLimits,
): CallNodeParam[] {
  const params: CallNodeParam[] = [];
  decoded.inputs.forEach((input, index) => {
    if (skipIndexes.includes(index)) return;
    const name = input.name || `arg${index}`;
    const formatted = formatDecodedValue(decoded.args[index], limits.maxParamChars);
    params.push({
      name,
      type: input.type,
      value: formatted.value,
      isAddress: input.type === 'address',
      truncated: formatted.truncated,
    });
  });
  return params;
}

// ─── 展开收尾：截断 / 失败标记 ────────────────────────────────────────────

interface ExpansionOutcome {
  arrayTruncated?: boolean;
  budgetTruncated: boolean;
  expected: number;
  actual: number;
  state: TreeState;
}

function finishExpansion(node: CallNode, outcome: ExpansionOutcome): void {
  let degraded = false;
  if (outcome.arrayTruncated) {
    addWarningOnce(node, { code: 'max-array-items-truncated' });
    degraded = true;
  }
  if (outcome.budgetTruncated) {
    addWarningOnce(node, { code: 'max-nodes-reached' });
    if (!node.stopReason) node.stopReason = 'max-nodes';
    outcome.state.truncated = true;
    degraded = true;
  }
  if (degraded && node.decodeStatus === 'decoded') {
    node.decodeStatus = 'partial';
  }
  void outcome.expected;
  void outcome.actual;
}

function markChildFailures(node: CallNode): void {
  const failed = node.children.find((child) => child.decodeStatus === 'malformed');
  if (!failed) return;
  addWarningOnce(node, {
    code: 'child-decode-failed',
    detail: failed.path,
  });
  if (node.decodeStatus === 'decoded') {
    node.decodeStatus = 'partial';
  }
}

// ─── 类型窄化辅助（不信任解码结果结构） ───────────────────────────────────

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown, key?: string): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && key) {
    const field = (value as Record<string, unknown>)[key];
    return typeof field === 'string' ? field : null;
  }
  return null;
}

function readBigint(value: unknown, key?: string): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'object' && value !== null && key) {
    const field = (value as Record<string, unknown>)[key];
    return typeof field === 'bigint' ? field : null;
  }
  return null;
}

function readBoolean(value: unknown, key: string): boolean | null {
  if (typeof value !== 'object' || value === null) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'boolean' ? field : null;
}

// ─── 对外入口 ────────────────────────────────────────────────────────────

export function buildCallTree(
  input: CallTreeInput,
  options: CallTreeOptions = {},
): CallTreeResult {
  const limits: DecodeLimits = { ...DEFAULT_DECODE_LIMITS, ...options.limits };
  const state: TreeState = {
    limits,
    signatures: options.signatures ?? {},
    nodeCount: 0,
    truncated: false,
  };

  const meta: CallMeta = {
    to: input.to ?? null,
    value: typeof input.value === 'bigint' ? input.value : null,
  };
  const root =
    decodeCall(input.data ?? '0x', meta, 'transaction', 0, 'root', state, null) ??
    createNode('0x', 'transaction', 0, 'root', state, null);

  // 子节点失败不能让整棵树失败：逐层标记部分解析。
  markSubtreeIssues(root);
  // 风险规则在树构建完成后统一扫描（nowMs 可注入保证确定性）。
  collectRiskFindings(root, { nowMs: options.nowMs ?? Date.now(), limits });

  return {
    root,
    nodeCount: countNodes(root),
    truncated: state.truncated,
    warnings: collectTreeWarnings(root),
  };
}

/** 树级 warning 汇总：按 code 去重，保留首次出现的 detail。 */
function collectTreeWarnings(root: CallNode): StructuredWarning[] {
  const seen = new Map<WarningCode, string | undefined>();
  const visit = (node: CallNode): void => {
    for (const warning of node.warnings) {
      if (!seen.has(warning.code)) {
        seen.set(warning.code, warning.detail);
      }
    }
    for (const child of node.children) visit(child);
  };
  visit(root);
  return [...seen].map(([code, detail]) => ({
    code,
    ...(detail !== undefined ? { detail } : {}),
  }));
}

function markSubtreeIssues(node: CallNode): void {
  for (const child of node.children) {
    markSubtreeIssues(child);
  }
  markChildFailures(node);
}

function countNodes(node: CallNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}

/** 节点或其子树是否包含高风险 finding（UI 默认展开用）。 */
export function subtreeHasHighRisk(node: CallNode): boolean {
  if (
    node.riskFindings.some((finding) => finding.severity === ('high' satisfies RiskSeverity))
  ) {
    return true;
  }
  return node.children.some(subtreeHasHighRisk);
}
