'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import {
  decodeFunctionData,
  parseAbiItem,
  type AbiFunction,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { KNOWN_SIGNATURES, type Danger } from './signatures';

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
  explain?: string;
  raw: Hex;
}

const isTxHash = (s: string) => /^0x[0-9a-fA-F]{64}$/.test(s);
const isCalldata = (s: string) =>
  /^0x[0-9a-fA-F]{8,}$/.test(s) && (s.length - 2) % 2 === 0;

export function useDecoder(input: string, chainId = 1) {
  const client = usePublicClient({ chainId });
  const value = input.trim();
  const enabled = Boolean(client) && value.startsWith('0x') && value.length >= 10;

  return useQuery<DecodedResult>({
    queryKey: ['decode', chainId, value.toLowerCase()],
    enabled,
    staleTime: 60_000,
    retry: false,
    queryFn: () => decode(client as PublicClient, value),
  });
}

async function decode(client: PublicClient, value: string): Promise<DecodedResult> {
  let calldata: string;
  let to: Address | undefined;
  let source: 'calldata' | 'tx';

  if (isTxHash(value)) {
    source = 'tx';
    const tx = await client.getTransaction({ hash: value as Hex });
    calldata = tx.input;
    to = tx.to ?? undefined;
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
  let signature = known?.signature ?? null;

  // 本地没命中 → 服务端反查 openchain
  if (!signature) {
    try {
      const r = await fetch(`/api/decode-sig?selector=${selector}`);
      const j = await r.json();
      signature = (j.signature as string | null) ?? null;
    } catch {
      signature = null;
    }
  }

  let params: DecodedParam[] = [];
  let functionName: string | null = null;
  if (signature) {
    try {
      const item = parseAbiItem(`function ${signature}`) as AbiFunction;
      functionName = item.name;
      const decoded = decodeFunctionData({ abi: [item], data: calldata as Hex });
      const args = (decoded.args ?? []) as readonly unknown[];
      params = item.inputs.map((inp, i) => ({
        name: inp.name,
        type: inp.type,
        value: formatValue(args[i]),
        isAddress: inp.type === 'address',
      }));
    } catch {
      // 选择器匹配但参数解不出（签名歧义/数据不符）：保留签名，不强解参数
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
    explain: known?.explain,
    raw: calldata as Hex,
  };
}

function formatValue(v: unknown): string {
  if (typeof v === 'bigint') return v.toString();
  if (Array.isArray(v)) return `[${v.map(formatValue).join(', ')}]`;
  if (v && typeof v === 'object') {
    return JSON.stringify(v, (_, val) =>
      typeof val === 'bigint' ? val.toString() : val,
    );
  }
  return String(v);
}
