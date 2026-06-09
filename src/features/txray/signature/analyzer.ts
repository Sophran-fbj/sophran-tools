import { isAddress, type Address } from 'viem';

export type SignatureDanger = 'high' | 'medium' | 'low' | 'unknown';
export type SignatureFindingKind =
  | 'spender'
  | 'operator'
  | 'conduit'
  | 'token'
  | 'owner'
  | 'amount'
  | 'nonce'
  | 'deadline';
export type SignatureRiskKind =
  | 'unknown'
  | 'permit2'
  | 'erc20-permit'
  | 'nft-order'
  | 'operator';

export interface FieldFinding {
  label: string;
  kind: SignatureFindingKind;
  value: string;
  severity: SignatureDanger;
  explain: string;
}

export interface SignatureAnalysis {
  domainName?: string;
  verifyingContract?: Address;
  primaryType?: string;
  danger: SignatureDanger;
  riskKind: SignatureRiskKind;
  title: string;
  explain: string;
  findings: FieldFinding[];
  rawMessage?: unknown;
}

interface TypedDataLike {
  domain?: Record<string, unknown>;
  primaryType?: string;
  message?: Record<string, unknown>;
  types?: Record<string, unknown>;
}

const MAX_UINT256 =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';

export function analyzeTypedData(input: string): SignatureAnalysis {
  const parsed = parseJson(input);
  const typedData = normalizeTypedDataShape(parsed);

  if (!typedData.message || typeof typedData.message !== 'object') {
    throw new Error('Typed data must contain a message object.');
  }

  const domain = typedData.domain ?? {};
  const primaryType = typedData.primaryType;
  const verifyingContract = asAddress(domain.verifyingContract);
  const message = typedData.message;
  const findings: FieldFinding[] = [];

  collectAddressFinding(findings, 'Spender', findByKey(message, ['spender']));
  collectAddressFinding(findings, 'Operator', findByKey(message, ['operator']));
  collectAddressFinding(findings, 'Conduit', findByKey(message, ['conduit', 'conduitKey']));
  collectAddressFinding(findings, 'Token', findByKey(message, ['token']));
  collectAddressFinding(findings, 'Owner', findByKey(message, ['owner']));

  const value = findByKey(message, ['value', 'amount']);
  if (value !== undefined) {
    findings.push(amountFinding(value));
  }

  const nonce = findByKey(message, ['nonce']);
  if (nonce !== undefined) {
    findings.push({
      label: 'Nonce',
      kind: 'nonce',
      value: stringifyValue(nonce),
      severity: 'low',
      explain: 'Nonce prevents replay of the same signature.',
    });
  }

  const deadline = findByKey(message, ['deadline', 'expiration', 'sigDeadline']);
  if (deadline !== undefined) {
    findings.push(deadlineFinding(deadline));
  }

  const permitKind = classifyPermit(primaryType, message, domain);
  const hasUnlimited = findings.some(
    (f) => f.label === 'Amount' && f.severity === 'high',
  );
  const hasSpender = findings.some((f) => f.label === 'Spender');
  const hasOperator = findings.some((f) => f.label === 'Operator');
  const hasDeadlineRisk = findings.some(
    (f) => f.label === 'Deadline' && f.severity !== 'low',
  );

  let danger: SignatureDanger = 'unknown';
  let riskKind: SignatureRiskKind = 'unknown';
  let title = 'Unknown typed-data signature';
  let explain =
    'TxRay cannot confidently classify this typed-data payload. Review every address, amount, and deadline before signing.';

  if (permitKind === 'permit2') {
    danger = hasUnlimited || hasSpender ? 'high' : 'medium';
    riskKind = 'permit2';
    title = 'Permit2 token spending approval';
    explain =
      'This signature can grant a spender permission through Uniswap Permit2. It may move tokens later without a separate approval transaction.';
  } else if (permitKind === 'erc20-permit') {
    danger = hasUnlimited || hasSpender ? 'high' : 'medium';
    riskKind = 'erc20-permit';
    title = 'ERC-20 permit approval';
    explain =
      'This signature can approve token spending without sending an on-chain approve transaction first.';
  } else if (permitKind === 'nft-order') {
    danger = 'high';
    riskKind = 'nft-order';
    title = 'NFT or order signature';
    explain =
      'This looks like an order-style signature. Signing can authorize a marketplace or conduit to move NFTs or settle an order.';
  } else if (hasOperator) {
    danger = 'high';
    riskKind = 'operator';
    title = 'Operator authorization';
    explain =
      'This signature names an operator. Operators can be dangerous because they may act on assets after the signature is accepted.';
  } else if (hasDeadlineRisk) {
    danger = 'medium';
  }

  return {
    domainName: typeof domain.name === 'string' ? domain.name : undefined,
    verifyingContract,
    primaryType,
    danger,
    riskKind,
    title,
    explain,
    findings,
    rawMessage: message,
  };
}

function parseJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    throw new Error('Input is not valid JSON.');
  }
}

function normalizeTypedDataShape(parsed: unknown): TypedDataLike {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Input must be a typed-data JSON object.');
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.typedData && typeof obj.typedData === 'object') {
    return obj.typedData as TypedDataLike;
  }

  if (Array.isArray(obj.params)) {
    const maybeTypedData = obj.params.find(
      (p) => p && typeof p === 'object' && 'message' in (p as Record<string, unknown>),
    );
    if (maybeTypedData) return maybeTypedData as TypedDataLike;
  }

  return obj as TypedDataLike;
}

function classifyPermit(
  primaryType: string | undefined,
  message: Record<string, unknown>,
  domain: Record<string, unknown>,
): 'permit2' | 'erc20-permit' | 'nft-order' | 'unknown' {
  const domainName = String(domain.name ?? '').toLowerCase();
  const type = String(primaryType ?? '').toLowerCase();
  const keys = new Set(Object.keys(message).map((k) => k.toLowerCase()));

  if (
    domainName.includes('permit2') ||
    type.includes('permittransferfrom') ||
    type.includes('permitbatch') ||
    keys.has('permitted') ||
    keys.has('sigdeadline')
  ) {
    return 'permit2';
  }

  if (
    type === 'permit' ||
    (keys.has('owner') && keys.has('spender') && keys.has('value') && keys.has('deadline'))
  ) {
    return 'erc20-permit';
  }

  if (
    domainName.includes('seaport') ||
    type.includes('order') ||
    keys.has('offer') ||
    keys.has('consideration')
  ) {
    return 'nft-order';
  }

  return 'unknown';
}

function findByKey(value: unknown, names: string[]): unknown {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  const queue: unknown[] = [value];

  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur || typeof cur !== 'object') continue;

    if (Array.isArray(cur)) {
      queue.push(...cur);
      continue;
    }

    for (const [key, val] of Object.entries(cur as Record<string, unknown>)) {
      if (wanted.has(key.toLowerCase())) return val;
      if (val && typeof val === 'object') queue.push(val);
    }
  }

  return undefined;
}

function collectAddressFinding(
  findings: FieldFinding[],
  label: string,
  value: unknown,
) {
  const addr = asAddress(value);
  if (!addr) return;

  findings.push({
    label,
    kind: label.toLowerCase() as SignatureFindingKind,
    value: addr,
    severity: label === 'Owner' ? 'low' : 'medium',
    explain:
      label === 'Owner'
        ? 'The wallet that owns the assets or approval.'
        : `${label} is an address that may receive permission or participate in settlement.`,
  });
}

function amountFinding(value: unknown): FieldFinding {
  const text = stringifyValue(value);
  const isUnlimited = text === MAX_UINT256;
  return {
    label: 'Amount',
    kind: 'amount',
    value: isUnlimited ? 'Unlimited (max uint256)' : text,
    severity: isUnlimited ? 'high' : 'medium',
    explain: isUnlimited
      ? 'Unlimited amount means the spender may move the full token balance until the approval is revoked or expires.'
      : 'This is the token amount or approval value embedded in the signature.',
  };
}

function deadlineFinding(value: unknown): FieldFinding {
  const text = stringifyValue(value);
  const num = Number(text);
  if (!Number.isFinite(num) || num <= 0) {
    return {
      label: 'Deadline',
      kind: 'deadline',
      value: text,
      severity: 'medium',
      explain: 'The deadline is missing or cannot be interpreted safely.',
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const days = Math.round((num - now) / 86400);
  const farFuture = days > 365;

  return {
    label: 'Deadline',
    kind: 'deadline',
    value: `${new Date(num * 1000).toLocaleString()} (${days} days)`,
    severity: farFuture ? 'medium' : 'low',
    explain: farFuture
      ? 'Long-lived signatures are riskier because they remain usable far into the future.'
      : 'The signature expires relatively soon.',
  };
}

function asAddress(value: unknown): Address | undefined {
  if (typeof value !== 'string') return undefined;
  return isAddress(value) ? value : undefined;
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(stringifyValue).join(', ');
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
