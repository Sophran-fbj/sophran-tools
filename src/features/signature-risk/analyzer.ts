import { isAddress, type Address } from 'viem';
import { isRecord } from '@/lib/validation';

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
  path?: string;
  expired?: boolean;
}

export interface SignatureAnalysis {
  domainName?: string;
  chainId?: string;
  verifyingContract?: Address;
  primaryType?: string;
  danger: SignatureDanger;
  riskKind: SignatureRiskKind;
  title: string;
  explain: string;
  findings: FieldFinding[];
  rawMessage?: unknown;
  schemaValidated: boolean;
  signatureExpired: boolean;
}

interface TypedDataField {
  name: string;
  type: string;
}

interface TypedDataLike {
  domain: Record<string, unknown>;
  primaryType?: string;
  message: Record<string, unknown>;
  types?: Record<string, TypedDataField[]>;
}

interface TypedLeaf {
  name: string;
  type?: string;
  value: unknown;
  path: string;
}

const MAX_UINT160 = (2n ** 160n - 1n).toString();
const MAX_UINT256 = (2n ** 256n - 1n).toString();
const MAX_SCHEMA_DEPTH = 16;

export function analyzeTypedData(input: string): SignatureAnalysis {
  const typedData = normalizeTypedDataShape(parseJson(input));
  const { domain, primaryType, message, types } = typedData;
  const verifyingContract = asAddress(domain.verifyingContract);
  const leaves = types && primaryType
    ? collectTypedLeaves(types, primaryType, message)
    : collectFallbackLeaves(message);
  const findings = leaves.flatMap(findingFromLeaf);

  const permitKind = classifyPermit(primaryType, message, domain);
  const hasUnlimited = findings.some(
    (finding) => finding.kind === 'amount' && finding.severity === 'high',
  );
  const hasPositiveAmount = findings.some(
    (finding) =>
      finding.kind === 'amount' &&
      finding.value !== '0' &&
      !finding.value.startsWith('0 '),
  );
  const hasSpender = findings.some((finding) => finding.kind === 'spender');
  const hasOperator = findings.some((finding) => finding.kind === 'operator');
  const signatureExpired = findings.some(
    (finding) =>
      finding.kind === 'deadline' &&
      finding.expired &&
      /(?:^|\.)(?:deadline|sigDeadline)$/i.test(finding.path ?? ''),
  );
  const hasDeadlineRisk = findings.some(
    (finding) => finding.kind === 'deadline' && finding.severity === 'medium',
  );

  let danger: SignatureDanger = 'unknown';
  let riskKind: SignatureRiskKind = 'unknown';
  let title = 'Unknown typed-data signature';
  let explain =
    'Signature Risk cannot confidently classify this typed-data payload. Review every address, amount, and deadline before signing.';

  if (permitKind === 'permit2') {
    danger = hasUnlimited || (hasSpender && hasPositiveAmount)
      ? 'high'
      : 'medium';
    riskKind = 'permit2';
    title = 'Permit2 token spending approval';
    explain = 'This signature can grant a spender permission through Uniswap Permit2. It may move tokens later without a separate approval transaction.';
  } else if (permitKind === 'erc20-permit') {
    danger = hasUnlimited || (hasSpender && hasPositiveAmount)
      ? 'high'
      : 'medium';
    riskKind = 'erc20-permit';
    title = 'ERC-20 permit approval';
    explain = 'This signature can approve token spending without sending an on-chain approve transaction first.';
  } else if (permitKind === 'nft-order') {
    danger = 'high';
    riskKind = 'nft-order';
    title = 'NFT or order signature';
    explain = 'This looks like an order-style signature. Signing can authorize a marketplace or conduit to move NFTs or settle an order.';
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
    chainId: scalarText(domain.chainId),
    verifyingContract,
    primaryType,
    danger,
    riskKind,
    title,
    explain,
    findings,
    rawMessage: message,
    schemaValidated: Boolean(types && primaryType),
    signatureExpired,
  };
}

function parseJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    throw new Error('Input is not valid JSON.');
  }
}

function parseTypedDataCandidate(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return isRecord(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return isRecord(value) ? value : undefined;
}

function parseTypes(value: unknown): Record<string, TypedDataField[]> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error('Typed data types must be an object.');

  const output: Record<string, TypedDataField[]> = {};
  for (const [typeName, fields] of Object.entries(value)) {
    if (!Array.isArray(fields)) throw new Error(`Type ${typeName} must be an array.`);
    output[typeName] = fields.map((field) => {
      if (
        !isRecord(field) ||
        typeof field.name !== 'string' ||
        typeof field.type !== 'string'
      ) {
        throw new Error(`Type ${typeName} contains an invalid field.`);
      }
      return { name: field.name, type: field.type };
    });
  }
  return output;
}

function normalizeTypedDataShape(parsed: unknown): TypedDataLike {
  if (!isRecord(parsed)) throw new Error('Input must be a typed-data JSON object.');

  let candidate = parsed;
  if (parsed.typedData !== undefined) {
    const nested = parseTypedDataCandidate(parsed.typedData);
    if (!nested) throw new Error('typedData must contain a JSON object.');
    candidate = nested;
  } else if (Array.isArray(parsed.params)) {
    const nested = parsed.params
      .map(parseTypedDataCandidate)
      .find((item) => item && isRecord(item.message));
    if (nested) candidate = nested;
  }

  if (!isRecord(candidate.message)) {
    throw new Error('Typed data must contain a message object.');
  }
  if (candidate.domain !== undefined && !isRecord(candidate.domain)) {
    throw new Error('Typed data domain must be an object.');
  }
  if (candidate.primaryType !== undefined && typeof candidate.primaryType !== 'string') {
    throw new Error('Typed data primaryType must be a string.');
  }

  const types = parseTypes(candidate.types);
  const primaryType =
    typeof candidate.primaryType === 'string' ? candidate.primaryType : undefined;
  if (types && primaryType && !types[primaryType]) {
    throw new Error(`primaryType ${primaryType} is missing from types.`);
  }

  return {
    domain: isRecord(candidate.domain) ? candidate.domain : {},
    primaryType,
    message: candidate.message,
    types,
  };
}

function collectTypedLeaves(
  types: Record<string, TypedDataField[]>,
  primaryType: string,
  message: Record<string, unknown>,
): TypedLeaf[] {
  const leaves: TypedLeaf[] = [];

  function visit(type: string, value: unknown, name: string, path: string, depth: number) {
    if (depth > MAX_SCHEMA_DEPTH) throw new Error('Typed-data schema nesting is too deep.');

    const arrayMatch = /^(.*)\[(\d*)\]$/.exec(type);
    if (arrayMatch) {
      if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
      const expectedLength = arrayMatch[2] ? Number(arrayMatch[2]) : undefined;
      if (expectedLength !== undefined && value.length !== expectedLength) {
        throw new Error(`${path} must contain ${expectedLength} items.`);
      }
      value.forEach((item, index) =>
        visit(arrayMatch[1], item, name, `${path}[${index}]`, depth + 1),
      );
      return;
    }

    const struct = types[type];
    if (struct) {
      if (!isRecord(value)) throw new Error(`${path} must be an object of type ${type}.`);
      for (const field of struct) {
        if (!(field.name in value)) throw new Error(`${path}.${field.name} is missing.`);
        visit(
          field.type,
          value[field.name],
          field.name,
          `${path}.${field.name}`,
          depth + 1,
        );
      }
      return;
    }

    leaves.push({ name, type, value, path });
  }

  visit(primaryType, message, primaryType, 'message', 0);
  return leaves;
}

function collectFallbackLeaves(value: unknown): TypedLeaf[] {
  const leaves: TypedLeaf[] = [];
  function visit(current: unknown, path: string, depth: number) {
    if (depth > MAX_SCHEMA_DEPTH) throw new Error('Typed-data message nesting is too deep.');
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1));
      return;
    }
    if (!isRecord(current)) return;
    for (const [name, item] of Object.entries(current)) {
      const itemPath = `${path}.${name}`;
      if (item && typeof item === 'object') visit(item, itemPath, depth + 1);
      else leaves.push({ name, value: item, path: itemPath });
    }
  }
  visit(value, 'message', 0);
  return leaves;
}

function findingFromLeaf(leaf: TypedLeaf): FieldFinding[] {
  const key = leaf.name.toLowerCase();
  const addressKinds: Partial<Record<string, SignatureFindingKind>> = {
    spender: 'spender',
    operator: 'operator',
    conduit: 'conduit',
    token: 'token',
    owner: 'owner',
  };
  const addressKind = addressKinds[key];
  if (addressKind) {
    const address = asAddress(leaf.value);
    if (!address || (leaf.type && leaf.type !== 'address')) return [];
    const label = addressKind[0].toUpperCase() + addressKind.slice(1);
    return [
      {
        label,
        kind: addressKind,
        value: address,
        severity: addressKind === 'owner' ? 'low' : 'medium',
        explain:
          addressKind === 'owner'
            ? 'The wallet that owns the assets or approval.'
            : `${label} may receive permission or participate in settlement.`,
        path: leaf.path,
      },
    ];
  }

  if ((key === 'amount' || key === 'value') && (!leaf.type || /^uint\d*$/.test(leaf.type))) {
    return [amountFinding(leaf.value, leaf.type, leaf.path)];
  }
  if (key === 'nonce' && (!leaf.type || /^uint\d*$/.test(leaf.type))) {
    return [
      {
        label: 'Nonce',
        kind: 'nonce',
        value: stringifyValue(leaf.value),
        severity: 'low',
        explain: 'Nonce prevents replay of the same signature.',
        path: leaf.path,
      },
    ];
  }
  if (['deadline', 'expiration', 'sigdeadline'].includes(key)) {
    return [deadlineFinding(leaf.value, leaf.path)];
  }
  return [];
}

function classifyPermit(
  primaryType: string | undefined,
  message: Record<string, unknown>,
  domain: Record<string, unknown>,
): 'permit2' | 'erc20-permit' | 'nft-order' | 'unknown' {
  const domainName = String(domain.name ?? '').toLowerCase();
  const type = String(primaryType ?? '').toLowerCase();
  const keys = new Set(Object.keys(message).map((key) => key.toLowerCase()));

  if (
    domainName.includes('permit2') ||
    type.includes('permittransferfrom') ||
    type.includes('permitbatch') ||
    type === 'permitsingle' ||
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

function amountFinding(value: unknown, type: string | undefined, path: string): FieldFinding {
  const text = stringifyValue(value);
  const numeric = parseUnsignedInteger(text);
  const declaredMax = maxValueForUint(type);
  const isUnlimited =
    numeric !== undefined &&
    (numeric === declaredMax || numeric.toString() === MAX_UINT160 || numeric.toString() === MAX_UINT256);
  const isZero = numeric === 0n;
  const maxType = type ?? (text === MAX_UINT160 ? 'uint160' : text === MAX_UINT256 ? 'uint256' : 'integer');
  return {
    label: 'Amount',
    kind: 'amount',
    value: isUnlimited ? `Unlimited (${maxType} max)` : text,
    severity: isUnlimited ? 'high' : isZero ? 'low' : 'medium',
    explain: isUnlimited
      ? 'Unlimited amount means the spender may move the full token balance until the approval is revoked or expires.'
      : isZero
        ? 'A zero amount does not grant token spending value.'
        : 'This is the token amount or approval value embedded in the signature.',
    path,
  };
}

function maxValueForUint(type: string | undefined): bigint | undefined {
  if (!type) return undefined;
  const match = /^uint(\d*)$/.exec(type);
  if (!match) return undefined;
  const bits = match[1] ? Number(match[1]) : 256;
  if (!Number.isInteger(bits) || bits < 8 || bits > 256 || bits % 8 !== 0) return undefined;
  return 2n ** BigInt(bits) - 1n;
}

function parseUnsignedInteger(value: string): bigint | undefined {
  if (!/^\d+$/.test(value)) return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function deadlineFinding(value: unknown, path: string): FieldFinding {
  const text = stringifyValue(value);
  const seconds = Number(text);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    return {
      label: 'Deadline',
      kind: 'deadline',
      value: text,
      severity: 'medium',
      explain: 'The deadline cannot be interpreted safely.',
      path,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const days = Math.ceil((seconds - now) / 86400);
  const expired = seconds <= now;
  const farFuture = days > 365;
  const date = new Date(seconds * 1000).toLocaleString();
  return {
    label: 'Deadline',
    kind: 'deadline',
    value: expired ? `${date} (expired)` : `${date} (${days} days)`,
    severity: expired ? 'unknown' : farFuture ? 'medium' : 'low',
    explain: expired
      ? 'This deadline has passed, but this tool cannot verify how the receiving contract handles it.'
      : farFuture
        ? 'Long-lived signatures are riskier because they remain usable far into the future.'
        : 'The signature expires relatively soon.',
    path,
    expired,
  };
}

function asAddress(value: unknown): Address | undefined {
  return typeof value === 'string' && isAddress(value) ? value : undefined;
}

function scalarText(value: unknown): string | undefined {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : undefined;
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(stringifyValue).join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
