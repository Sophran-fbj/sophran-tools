# CLAUDE.md

本文件给在该仓库工作的 Claude Code 提供项目上下文与约定。**动手前先读这里 + `docs/`。**

## 项目是什么

`sophran-tools` —— Sophran 的 web3 工具站（平台）。第一个工具是 **TxRay**：
- **V1 授权检查**：列出地址的 ERC-20/721/1155 授权、标记风险、一键撤销。
- **V2 交易解码**：粘 calldata 或 tx hash，解码并用人话解释在干什么。

**核心差异化**：不只"显示"风险，还**用中文解释原理**，每个风险点配一句人话 + 链到文章。教育属性是护城河。
**根本目标**：做成一个可持续扩展的 web3 安全工具站——证明工具能解释链上风险，而不只是展示原始数据。

## 架构（重要）

- **单个 Next.js App Router 应用，不用 monorepo。** 理由：只有一个可部署单元，共享靠项目内 import。等出现第二个需独立部署的工具再升级 workspace。
- **工具 = 路由**：`src/app/tools/<工具名>/`
- **业务逻辑 = `src/features/<工具名>/`**（解耦层）
- **共享链层 = `src/lib/web3/`**（wagmi config、viem client、multicall、ABI）
- **共享 UI = `src/components/`**
- **铁律**：`features/*` 之间**不准互相 import**；要共用的只放 `lib/` 和 `components/`。

### 加一个新工具 = 三步，老工具零改动
1. `src/app/tools/<name>/page.tsx` —— 建页面（出网址）
2. `src/features/<name>/` —— 写逻辑
3. 首页索引登记一行

## 技术栈与版本约束

- Next 16 (App Router) + React 19 + TypeScript
- **wagmi 2 + viem 2**（⚠️ **不要升 wagmi 3**：RainbowKit 尚不支持 wagmi 3，整个钱包 UI 生态都还在 v2）
- 钱包连接：**RainbowKit 2**
- 样式：**Tailwind 4 + DaisyUI 5**（web3 主题，如 `synthwave` / `night`）；不用 shadcn
- 数据请求：**TanStack Query**（wagmi 内置），不另引状态库
- **包管理器：pnpm only**（⚠️ 不要混用 npm，会产生两套 lockfile 打架）

## 数据策略

| 数据 | 方案 |
|---|---|
| 授权历史（Approval 事件） | Etherscan / Alchemy API |
| 当前额度、代币元数据 | viem **multicall** |
| 函数签名反查 | 4byte.directory / openchain.xyz |

## 安全与隐私（安全工具，自己先立得正）

- **永不接触私钥/助记词**：写操作（撤销等）一律走用户钱包签名。
- **不收集用户数据**：不把地址上传到自有服务器，查询直连公开 RPC/API。
- **反钓鱼姿态**：UI 明示"绝不索要助记词/私钥"。
- 依赖最小化，降低供应链风险。

## 命令

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm build
pnpm lint
```

## 环境变量（见 .env.local）

- `NEXT_PUBLIC_WC_PROJECT_ID` —— WalletConnect/Reown Project ID（RainbowKit 必需）
- `NEXT_PUBLIC_ALCHEMY_ID` —— Alchemy API key（RPC）
- `ETHERSCAN_API_KEY` —— 授权历史查询（服务端用，勿加 NEXT_PUBLIC 前缀）
- `DEV_PROXY`（仅国内本地开发）—— 服务端 fetch 走代理，绕过 GFW 对 `api.etherscan.io` 的连接重置（ECONNRESET）。值为代理本地 HTTP/混合端口，如 `http://127.0.0.1:10808`。由 `src/instrumentation.ts` + undici 注入；Vercel 等海外部署不要设。

## 约定

- **UI 文案中文优先**，技术术语保留英文。
- 每个风险点都要配**人话解释**并链到对应文章——这是产品主线，别省。
- 改动遵循"复杂度按需增长"：不为还不存在的需求提前堆架构。

## 详细文档

- `docs/需求文档.md` —— V1+V2 完整需求、里程碑、成功标准
- `docs/技术与架构选型.md` —— 每个选型的决策·理由·备选·取舍



