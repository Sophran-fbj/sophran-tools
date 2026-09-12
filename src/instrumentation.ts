// 本地国内开发：让服务端 fetch（如 /api/approvals 调 Etherscan）走代理，
// 绕过 GFW 对外网直连的重置（ECONNRESET）。
//
// 只在设置了 DEV_PROXY 时生效；Vercel 等海外部署不设此变量，因此不影响线上。
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const proxy = process.env.DEV_PROXY;
  if (!proxy) return;

  try {
    const { setGlobalDispatcher, ProxyAgent } = await import('undici');
    setGlobalDispatcher(new ProxyAgent(proxy));
    const proxyUrl = new URL(proxy);
    console.log(
      `[instrumentation] 服务端 fetch 已启用代理：${proxyUrl.protocol}//${proxyUrl.host}`,
    );
  } catch (e) {
    console.error('[instrumentation] 代理设置失败：', e);
  }
}
