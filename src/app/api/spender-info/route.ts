import { NextResponse, type NextRequest } from 'next/server';
import { isAddress, getAddress } from 'viem';

const ETHERSCAN_BASE = 'https://api.etherscan.io/v2/api';

// 查合约部署时间（Etherscan getcontractcreation，每次最多 5 个地址）。
// EOA 不会出现在结果里 —— 那由前端 getCode 判定。
export async function GET(req: NextRequest) {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) return NextResponse.json({ created: {} });

  const chainId = Number(req.nextUrl.searchParams.get('chainId') ?? '1');
  const raw = req.nextUrl.searchParams.get('addresses') ?? '';
  const addrs = raw
    .split(',')
    .map((a) => a.trim())
    .filter((a) => isAddress(a));

  if (!addrs.length) return NextResponse.json({ created: {} });

  const created: Record<string, number | null> = {};

  for (let i = 0; i < addrs.length; i += 5) {
    const chunk = addrs.slice(i, i + 5);
    const url = new URL(ETHERSCAN_BASE);
    url.searchParams.set('chainid', String(chainId));
    url.searchParams.set('module', 'contract');
    url.searchParams.set('action', 'getcontractcreation');
    url.searchParams.set('contractaddresses', chunk.join(','));
    url.searchParams.set('apikey', apiKey);

    try {
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (Array.isArray(json.result)) {
        for (const item of json.result) {
          if (!item?.contractAddress) continue;
          const addr = getAddress(item.contractAddress).toLowerCase();
          created[addr] = item.timestamp ? Number(item.timestamp) : null;
        }
      }
    } catch {
      // 跳过该批，不影响其它
    }
  }

  return NextResponse.json({ created });
}
