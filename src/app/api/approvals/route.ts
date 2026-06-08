import { NextResponse, type NextRequest } from 'next/server';
import { isAddress, getAddress } from 'viem';

// keccak256("Approval(address,address,uint256)")
const APPROVAL_TOPIC0 =
  '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
// keccak256("ApprovalForAll(address,address,bool)")
const APPROVAL_FOR_ALL_TOPIC0 =
  '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31';

const ETHERSCAN_BASE = 'https://api.etherscan.io/v2/api';

interface EtherscanLog {
  address: string;
  topics: string[];
}

// 按 topic0(事件签名) + topic1(owner) 跨所有合约拉日志，分页，无 10 区块限制
async function fetchAllLogs(
  chainId: number,
  topic0: string,
  ownerTopic: string,
  apiKey: string,
): Promise<EtherscanLog[]> {
  const offset = 1000;
  const maxPages = 10; // 上限 1 万条，超活跃地址会截断（MVP 取舍）
  const all: EtherscanLog[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(ETHERSCAN_BASE);
    url.searchParams.set('chainid', String(chainId));
    url.searchParams.set('module', 'logs');
    url.searchParams.set('action', 'getLogs');
    url.searchParams.set('topic0', topic0);
    url.searchParams.set('topic1', ownerTopic);
    url.searchParams.set('topic0_1_opr', 'and');
    url.searchParams.set('fromBlock', '0');
    url.searchParams.set('toBlock', 'latest');
    url.searchParams.set('page', String(page));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('apikey', apiKey);

    const res = await fetch(url, { cache: 'no-store' });
    const json = await res.json();

    if (Array.isArray(json.result)) {
      all.push(...(json.result as EtherscanLog[]));
      if (json.result.length < offset) break;
    } else {
      const msg = typeof json.result === 'string' ? json.result : json.message;
      if (msg && /no records found/i.test(msg)) break;
      throw new Error(msg || 'Etherscan 查询失败');
    }
  }
  return all;
}

// 从日志里提取去重后的 (token, spender) 对；spender/operator 在 topics[2]
function dedupePairs(logs: EtherscanLog[]) {
  const map = new Map<string, { token: string; spender: string }>();
  for (const log of logs) {
    const spenderTopic = log.topics?.[2];
    if (!spenderTopic) continue;
    const token = getAddress(log.address);
    const spender = getAddress(`0x${spenderTopic.slice(-40)}`);
    map.set(`${token}-${spender}`, { token, spender });
  }
  return [...map.values()];
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ETHERSCAN_API_KEY 未配置，请在 .env.local 填入后重启 dev' },
      { status: 500 },
    );
  }

  const ownerParam = req.nextUrl.searchParams.get('owner');
  const chainId = Number(req.nextUrl.searchParams.get('chainId') ?? '1');
  if (!ownerParam || !isAddress(ownerParam)) {
    return NextResponse.json({ error: '无效地址' }, { status: 400 });
  }

  const ownerTopic = `0x${ownerParam.slice(2).toLowerCase().padStart(64, '0')}`;

  try {
    const [erc20Logs, nftLogs] = await Promise.all([
      fetchAllLogs(chainId, APPROVAL_TOPIC0, ownerTopic, apiKey),
      fetchAllLogs(chainId, APPROVAL_FOR_ALL_TOPIC0, ownerTopic, apiKey),
    ]);
    return NextResponse.json({
      erc20: dedupePairs(erc20Logs),
      nft: dedupePairs(nftLogs),
    });
  } catch (e) {
    const err = e as Error & { cause?: unknown };
    const causeMsg =
      err.cause instanceof Error
        ? err.cause.message
        : err.cause
          ? String(err.cause)
          : '';
    return NextResponse.json(
      { error: `${err.message}${causeMsg ? ` — ${causeMsg}` : ''}` },
      { status: 502 },
    );
  }
}
