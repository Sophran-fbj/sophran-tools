import { NextResponse, type NextRequest } from 'next/server';

// 服务端反查函数选择器 → 签名（openchain 签名数据库）。
// 放服务端：① 在国内 dev 下走 DEV_PROXY；② 避免浏览器跨域。
export async function GET(req: NextRequest) {
  const selector = req.nextUrl.searchParams.get('selector');
  if (!selector || !/^0x[0-9a-fA-F]{8}$/.test(selector)) {
    return NextResponse.json({ signature: null, error: '无效 selector' }, { status: 400 });
  }

  try {
    const url = `https://api.openchain.xyz/signature-database/v1/lookup?function=${selector}&filter=true`;
    const res = await fetch(url, { cache: 'no-store' });
    const json = await res.json();
    const list = json?.result?.function?.[selector];
    const signature =
      Array.isArray(list) && list[0]?.name ? (list[0].name as string) : null;
    return NextResponse.json({ signature });
  } catch (e) {
    // 反查失败不致命：解码器仍可只显示选择器
    const err = e as Error & { cause?: unknown };
    const cause = err.cause instanceof Error ? err.cause.message : '';
    return NextResponse.json({
      signature: null,
      error: `${err.message}${cause ? ` — ${cause}` : ''}`,
    });
  }
}
