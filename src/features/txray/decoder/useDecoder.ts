'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import {
  decodeFunctionData,
  parseAbiItem,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
} from 'viem';
import {
  KNOWN_SIGNATURES,
  type Danger,
  type KnownExplainKey,
} from './signatures';
import { isRecord } from '@/lib/validation';

export interface DecodedParam {
  name?: string;
  type: string;
  value: string;
  isAddress: boolean;
}

export interface DecodedResult {
  source: 'calldata' | 'tx';
  to?: Address;
  selector: string;
  signature: string | null;
  functionName: string | null;
  params: DecodedParam[];
  danger: Danger;
  explainKey?: KnownExplainKey;
  raw: Hex;
}

type SignatureLookup = (selector: string) => Promise<string | null>;

function isTxHash(value: string): value is Hash {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

function isCalldata(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{8,}$/.test(value) && (value.length - 2) % 2 === 0;
}

export function useDecoder(input: string, chainId = 1) {
  const client = usePublicClient({ chainId });
  const value = input.trim();
  const enabled = Boolean(client) && value.startsWith('0x') && value.length >= 10;

  return useQuery<DecodedResult>({
    queryKey: ['decode', chainId, value.toLowerCase()],
    enabled,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      if (!client) throw new Error('目标链 RPC 不可用');
      return decodeInput(client, value);
    },
  });
}

export async function decodeInput(
  client: PublicClient | undefined,
  value: string,
  lookupSignature: SignatureLookup = fetchSignature,
): Promise<DecodedResult> {
  let calldata: string;
  let to: Address | undefined;
  let source: 'calldata' | 'tx';

  if (isTxHash(value)) {
    if (!client) throw new Error('读取交易 hash 需要目标链 RPC');
    source = 'tx';
    const transaction = await client.getTransaction({ hash: value });
    calldata = transaction.input;
    to = transaction.to ?? undefined;
    if (!calldata || calldata === '0x') {
      throw new Error('这是一笔普通转账（没有 calldata 可解码）');
    }
  } else {
    source = 'calldata';
    calldata = value;
  }

  if (!isCalldata(calldata)) {
    throw new Error('不是有效的 calldata（应为 0x + 至少 4 字节方法选择器）');
  }

  const selector = calldata.slice(0, 10).toLowerCase();
  const known = KNOWN_SIGNATURES[selector];
  const signature = known?.signature ?? (await lookupSignature(selector));

  let params: DecodedParam[] = [];
  let functionName: string | null = null;
  if (signature) {
    try {
      const item = parseAbiItem(`function ${signature}`);
      if (item.type === 'function') {
        functionName = item.name;
        const decoded = decodeFunctionData({ abi: [item], data: calldata });
        const args = decoded.args ?? [];
        params = item.inputs.map((input, index) => ({
          name: input.name,
          type: input.type,
          value: formatValue(args[index]),
          isAddress: input.type === 'address',
        }));
      }
    } catch {
      // A signature database match can be ambiguous; preserve the signature and raw data.
    }
  }

  return {
    source,
    to,
    selector,
    signature,
    functionName,
    params,
    danger: known?.danger ?? 'none',
    explainKey: known?.explainKey,
    raw: calldata,
  };
}

async function fetchSignature(selector: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/decode-sig?selector=${selector}`);
    if (!response.ok) return null;
    const value: unknown = await response.json();
    if (!isRecord(value)) return null;
    return typeof value.signature === 'string' ? value.signature : null;
  } catch {
    return null;
  }
}

function formatValue(value: unknown): string {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return `[${value.map(formatValue).join(', ')}]`;
  if (value && typeof value === 'object') {
    return JSON.stringify(value, (_, nested) =>
      typeof nested === 'bigint' ? nested.toString() : nested,
    );
  }
  return String(value);
}

export function isMaxUintValue(type: string, value: string): boolean {
  const match = /^uint(\d{0,3})$/.exec(type);
  if (!match || !/^\d+$/.test(value)) return false;
  const bits = match[1] ? Number(match[1]) : 256;
  if (bits < 8 || bits > 256 || bits % 8 !== 0) return false;
  return BigInt(value) === 2n ** BigInt(bits) - 1n;
}
