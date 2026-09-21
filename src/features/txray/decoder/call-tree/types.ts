// 有界递归交易调用树：纯 TypeScript 模型与类型。
//
// 不依赖 React / DOM / 网络；同一输入产生稳定输出；解码失败不抛异常而是落到
// 明确的 decodeStatus / warning 上。这是静态解码，不是交易模拟——任何节点
// 的「decoded」只代表 ABI 层面解析成功，不代表执行结果或安全性。
//
// decodeStatus 表达产品边界（中英文文案见 src/lib/i18n/messages.ts）：
// - decoded           已按 ABI 准确解析
// - signature-only    仅识别函数签名，参数未能解码
// - partial           部分解析（数组截断 / 个别子节点解码失败）
// - unknown           未知选择器，无法解析
// - recursion-stopped 因安全限制停止递归（子调用未展开）
// - malformed         输入格式错误

/** 单个节点的解码状态（产品边界，不做安全性判断）。 */
export type DecodeStatus =
  | 'decoded'
  | 'signature-only'
  | 'partial'
  | 'unknown'
  | 'recursion-stopped'
  | 'malformed';

export type RiskSeverity = 'high' | 'medium' | 'low' | 'info';

/**
 * 本节点 calldata 进入调用树的方式：
 * - transaction           交易最外层调用
 * - 其余值为已知容器的「子调用槽位」类型（只有这些槽位允许递归）
 */
export type SourceKind =
  | 'transaction'
  | 'multicall3-subcall'
  | 'multicall-bytes-subcall'
  | 'safe-inner-call'
  | 'account-execute-inner-call'
  | 'account-executeBatch-subcall'
  | 'userop-operation'
  | 'userop-call-data';

/** 已知调用容器类型。 */
export type ContainerKind =
  | 'multicall3-aggregate3'
  | 'multicall3-aggregate3Value'
  | 'multicall-bytes'
  | 'safe-execTransaction'
  | 'account-execute'
  | 'account-executeBatch'
  | 'entrypoint-handleOps'
  | 'entrypoint-handleOps-legacy'
  | 'entrypoint-userOperation';

/** 递归停止的具体原因。 */
export type StopReason =
  | 'max-depth'
  | 'max-nodes'
  | 'max-input-bytes';

/** 结构化 warning：code 稳定，UI 按 i18n 文案渲染；detail 是补充说明。 */
export interface StructuredWarning {
  code: WarningCode;
  detail?: string;
}

export type WarningCode =
  | 'empty-calldata'
  | 'max-depth-reached'
  | 'max-nodes-reached'
  | 'max-input-bytes-exceeded'
  | 'max-array-items-truncated'
  | 'child-decode-failed'
  | 'param-value-truncated'
  | 'container-identification-uncertain';

/** 单个节点的调用参数（值已格式化为字符串，BigInt 安全、长度受限制）。 */
export interface CallNodeParam {
  name?: string;
  type: string;
  value: string;
  isAddress: boolean;
  truncated: boolean;
}

/**
 * 风险发现。title / explanation 不内嵌在核心里，而是由稳定的 code
 * 在 i18n 文案表（messages.ts 的 riskCodes）中解析出中英文文本。
 * evidence 记录发现依据（参数名 → 值），指向具体 nodePath。
 */
export interface RiskFinding {
  code: RiskCode;
  severity: RiskSeverity;
  nodePath: string;
  evidence: Record<string, string>;
}

export type RiskCode =
  | 'erc20-max-allowance'
  | 'erc20-increase-allowance'
  | 'nft-approval-for-all'
  | 'erc20-permit'
  | 'permit2-permit'
  | 'transfer-from'
  | 'safe-delegatecall'
  | 'nonzero-native-value'
  | 'batch-contains-high-risk'
  | 'unknown-target'
  | 'unknown-selector'
  | 'parse-incomplete'
  | 'userop-factory'
  | 'userop-paymaster'
  | 'deadline-suspicious'
  | 'subcall-allow-failure'
  | 'depth-limit-reached'
  | 'node-limit-reached';

/** 容器识别信息：kind + 识别依据（selector / ABI 形状 / 官方地址）。 */
export interface ContainerInfo {
  kind: ContainerKind;
  /** 识别依据的稳定 key（i18n: decoder.identification.<key>）。 */
  identification:
    | 'canonical-address-and-abi'
    | 'selector-and-abi-shape'
    | 'entrypoint-canonical-address-and-abi'
    | 'abi-struct-shape';
  /** 容器版本（如 EntryPoint v0.8）；没有版本概念的容器省略。 */
  version?: string;
  /**
   * 识别注意事项的稳定 key（i18n: decoder.identificationNotes.<key>）。
   * 例如同名 selector 也被其他合约使用时必须提示，避免过度断言。
   */
  note?:
    | 'safe-selector-shared'
    | 'multicall-bytes-shared'
    | 'canonical-address-mismatch'
    | 'entrypoint-address-unknown'
    | 'entrypoint-layout-mismatch';
}

/** ERC-4337 UserOperation 摘要信息（挂在 UserOperation 节点上）。 */
export interface UserOpInfo {
  /** v0.6 / v0.7 / v0.8 / v0.9 / v0.7+（按形状识别）。 */
  version: string;
  /** initCode 前 20 字节；initCode 为空时为 null。 */
  factory: string | null;
  /** paymasterAndData 前 20 字节；为空时为 null。 */
  paymaster: string | null;
}

export interface CallNode {
  /** 前序遍历序号 id（n0、n1……），确定且稳定。 */
  id: string;
  /** 树内路径：root、root.0、root.0.2……按子数组下标。 */
  path: string;
  /** 根为 0，逐层 +1。 */
  depth: number;
  /** 目标地址（小写 hex），未知为 null。 */
  target: string | null;
  /** 主链币数量（wei，10 进制字符串）；无 value 概念时为 null。 */
  value: string | null;
  selector: string | null;
  /** 已识别签名（本地表或调用方注入的签名表）。 */
  signature: string | null;
  functionName: string | null;
  params: CallNodeParam[];
  children: CallNode[];
  riskFindings: RiskFinding[];
  warnings: StructuredWarning[];
  decodeStatus: DecodeStatus;
  stopReason: StopReason | null;
  /** 本节点完整 calldata（hex；解析前受 maxInputBytes 约束）。 */
  rawData: string;
  /** 展示用截断预览（长度 ≤ maxRawPreviewBytes 对应 hex 字符数）。 */
  rawPreview: string;
  sourceKind: SourceKind;
  /** 已识别容器信息；叶子调用为 null。 */
  container: ContainerInfo | null;
  /** ERC-4337 UserOperation 摘要（仅 UserOperation 节点）。 */
  userOp: UserOpInfo | null;
  /**
   * Permit2 permit 的结构化字段（仅当选择器精确匹配 Permit2 官方接口时提取；
   * 字段位于嵌套 tuple 中，扁平 params 拿不到）。deadline 为秒的十进制字符串。
   */
  permit2: { spender: string | null; deadline: string | null } | null;
  /** 容器槽位声明的 allowFailure（aggregate3 系）；其他情况为 null。 */
  allowFailure: boolean | null;
}

export interface DecodeLimits {
  /** 最大递归深度（根为 depth 0，允许的最大 depth 即该值）。 */
  maxDepth: number;
  /** 最大节点总数（含根）。 */
  maxNodes: number;
  /** 单次解析接受的最大 calldata 字节数。 */
  maxInputBytes: number;
  /** 单个数组参数最多解码的项目数。 */
  maxArrayItems: number;
  /** 单节点 raw data 展示预览的最大字节数。 */
  maxRawPreviewBytes: number;
  /** 单个参数格式化后的最大字符数。 */
  maxParamChars: number;
}

/** 树级汇总。 */
export interface CallTreeResult {
  root: CallNode;
  nodeCount: number;
  truncated: boolean;
  warnings: StructuredWarning[];
}

export interface CallTreeInput {
  /** 交易/容器调用目标地址（hex），未知为 null/undefined。 */
  to?: string | null;
  /** 随调用携带的主链币数量（wei）。 */
  value?: bigint | null;
  /** calldata（0x 开头 hex）。 */
  data: string;
}

export interface CallTreeOptions {
  limits?: Partial<DecodeLimits>;
  chainId?: number;
  /**
   * 选择器 → 签名注入表（本地已知表 + OpenChain 反查结果合并后传入）。
   * 解析核心本身不做任何网络请求。
   */
  signatures?: Record<string, string>;
  /**
   * 截止时间类检查的参考时刻（毫秒）。默认取当前时间；
   * 需要确定性输出时请显式传入。
   */
  nowMs?: number;
}
