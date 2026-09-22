import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit, requestClientKey } from '@/lib/server/requestGuard';
import { isRecord } from '@/lib/validation';

// 服务端反查函数选择器 → 签名（openchain 签名数据库）。
// 放服务端：① 在国内 dev 下走 DEV_PROXY；② 避免浏览器跨域。
export async function GET(req: NextRequest) {
  const rateLimit = await checkRateLimit(
    `decode-sig:${requestClientKey(req.headers)}`,
    30,
    60_000,
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { signature: null, error: '请求过于频繁，请稍后重试' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
          'X-TxRay-Guard': rateLimit.backend,
        },
      },
    );
  }

  const selector = req.nextUrl.searchParams.get('selector');
  if (!selector || !/^0x[0-9a-fA-F]{8}$/.test(selector)) {
    return NextResponse.json({ signature: null, error: '无效 selector' }, { status: 400 });
  }

  try {
    const url = `https://api.openchain.xyz/signature-database/v1/lookup?function=${selector}&filter=true`;
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`OpenChain HTTP ${res.status}`);
    const json: unknown = await res.json();
    const list = getSignatureList(json, selector);
    const signature =
      list && typeof list[0]?.name === 'string' ? list[0].name : null;
    return NextResponse.json(
      { signature },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=604800',
          'X-TxRay-Guard': rateLimit.backend,
        },
      },
    );
  } catch (e) {
    // 反查失败不致命：解码器仍可只显示选择器
    console.error('[decode-sig] OpenChain lookup failed', {
      selector,
      message: e instanceof Error ? e.message : 'unknown error',
    });
    return NextResponse.json(
      { signature: null, error: '签名数据库暂时不可用' },
      { status: 502 },
    );
  }
}

function getSignatureList(
  value: unknown,
  selector: string,
): Array<{ name?: unknown }> | undefined {
  if (!isRecord(value)) return undefined;
  const result = value.result;
  if (!isRecord(result)) return undefined;
  const functions = result.function;
  if (!isRecord(functions)) return undefined;
  const list = functions[selector];
  return Array.isArray(list) ? list : undefined;
}
