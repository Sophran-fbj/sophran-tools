import { NextResponse, type NextRequest } from 'next/server';
import { isAddress, getAddress, toEventSelector } from 'viem';
import {
  PERMIT2_ADDRESS,
  PERMIT2_APPROVAL_EVENT,
  PERMIT2_PERMIT_EVENT,
} from '@/features/txray/approvals/permit2';
import { isSupportedTxRayChain } from '@/features/txray/chains/chains';

// keccak256("Approval(address,address,uint256)")
const APPROVAL_TOPIC0 =
  '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
// keccak256("ApprovalForAll(address,address,bool)")
const APPROVAL_FOR_ALL_TOPIC0 =
  '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31';
// Permit2 事件 topic0：运行时计算，避免硬编码出错
const PERMIT2_APPROVAL_TOPIC0 = toEventSelector(PERMIT2_APPROVAL_EVENT);
const PERMIT2_PERMIT_TOPIC0 = toEventSelector(PERMIT2_PERMIT_EVENT);

const ETHERSCAN_BASE = 'https://api.etherscan.io/v2/api';

interface EtherscanLog {
  address: string;
  topics: string[];
}

const topicToAddress = (t: string) => getAddress(`0x${t.slice(-40)}`);

async function fetchAllLogs(
  chainId: number,
  topic0: string,
  ownerTopic: string,
  apiKey: string,
  contractAddress?: string,
): Promise<EtherscanLog[]> {
  const offset = 1000;
  const maxPages = 10;
  const all: EtherscanLog[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(ETHERSCAN_BASE);
    url.searchParams.set('chainid', String(chainId));
    url.searchParams.set('module', 'logs');
    url.searchParams.set('action', 'getLogs');
    if (contractAddress) url.searchParams.set('address', contractAddress);
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

// ERC20/NFT：topic1=owner, topic2=spender
function dedupeSpenderPairs(logs: EtherscanLog[]) {
  const map = new Map<string, { token: string; spender: string }>();
  for (const log of logs) {
    const spenderTopic = log.topics?.[2];
    if (!spenderTopic) continue;
    const token = getAddress(log.address);
    const spender = topicToAddress(spenderTopic);
    map.set(`${token}-${spender}`, { token, spender });
  }
  return [...map.values()];
}

// Permit2：topic1=owner, topic2=token, topic3=spender
function dedupePermit2Pairs(logs: EtherscanLog[]) {
  const map = new Map<string, { token: string; spender: string }>();
  for (const log of logs) {
    const tokenTopic = log.topics?.[2];
    const spenderTopic = log.topics?.[3];
    if (!tokenTopic || !spenderTopic) continue;
    const token = topicToAddress(tokenTopic);
    const spender = topicToAddress(spenderTopic);
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
  if (!isSupportedTxRayChain(chainId)) {
    return NextResponse.json({ error: '暂不支持该链' }, { status: 400 });
  }
  if (!ownerParam || !isAddress(ownerParam)) {
    return NextResponse.json({ error: '无效地址' }, { status: 400 });
  }

  const ownerTopic = `0x${ownerParam.slice(2).toLowerCase().padStart(64, '0')}`;

  try {
    const [erc20Logs, nftLogs, p2ApprovalLogs, p2PermitLogs] = await Promise.all([
      fetchAllLogs(chainId, APPROVAL_TOPIC0, ownerTopic, apiKey),
      fetchAllLogs(chainId, APPROVAL_FOR_ALL_TOPIC0, ownerTopic, apiKey),
      fetchAllLogs(chainId, PERMIT2_APPROVAL_TOPIC0, ownerTopic, apiKey, PERMIT2_ADDRESS),
      fetchAllLogs(chainId, PERMIT2_PERMIT_TOPIC0, ownerTopic, apiKey, PERMIT2_ADDRESS),
    ]);
    return NextResponse.json({
      erc20: dedupeSpenderPairs(erc20Logs),
      nft: dedupeSpenderPairs(nftLogs),
      permit2: dedupePermit2Pairs([...p2ApprovalLogs, ...p2PermitLogs]),
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
