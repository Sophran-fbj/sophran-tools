import { getAddress, isAddress, type Address } from 'viem';
import { isRecord } from '@/lib/validation';

export interface ApprovalPair {
  token: Address;
  spender: Address;
}

export interface ApprovalIndexPayload {
  erc20: ApprovalPair[];
  nft: ApprovalPair[];
  permit2: ApprovalPair[];
  coverage: {
    status: 'complete' | 'partial';
    truncatedSources: string[];
    maxRecordsPerSource: number;
  };
}

function parsePairs(value: unknown, field: string): ApprovalPair[] {
  if (!Array.isArray(value)) throw new Error(`授权索引响应缺少 ${field}`);
  return value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.token !== 'string' ||
      typeof item.spender !== 'string' ||
      !isAddress(item.token) ||
      !isAddress(item.spender)
    ) {
      throw new Error(`授权索引返回了无效的 ${field} 地址`);
    }
    return { token: getAddress(item.token), spender: getAddress(item.spender) };
  });
}

export function parseApprovalIndexPayload(value: unknown): ApprovalIndexPayload {
  if (!isRecord(value)) throw new Error('授权索引返回了无效响应');
  if (isRecord(value.error)) {
    throw new Error(
      typeof value.error.message === 'string'
        ? value.error.message
        : '授权索引查询失败',
    );
  }
  if (!isRecord(value.coverage)) {
    throw new Error('授权索引响应缺少覆盖范围信息');
  }

  const coverageStatus = value.coverage.status;
  const truncatedSources = value.coverage.truncatedSources;
  const maxRecordsPerSource = value.coverage.maxRecordsPerSource;
  if (
    (coverageStatus !== 'complete' && coverageStatus !== 'partial') ||
    !Array.isArray(truncatedSources) ||
    !truncatedSources.every((source) => typeof source === 'string') ||
    typeof maxRecordsPerSource !== 'number' ||
    !Number.isSafeInteger(maxRecordsPerSource) ||
    maxRecordsPerSource <= 0
  ) {
    throw new Error('授权索引返回了无效的覆盖范围信息');
  }

  return {
    erc20: parsePairs(value.erc20, 'erc20'),
    nft: parsePairs(value.nft, 'nft'),
    permit2: parsePairs(value.permit2, 'permit2'),
    coverage: {
      status: coverageStatus,
      truncatedSources,
      maxRecordsPerSource,
    },
  };
}
