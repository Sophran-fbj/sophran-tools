# Sophran Tools

**语言:** 中文 | [English](./README.en.md)

> 一个不只检测链上风险，也解释风险原因的 web3 工具站。

`sophran-tools` 是 Sophran 的 web3 工具站。当前第一个工具是 **TxRay**，用于帮助 EVM 用户检查授权、解码交易、分析签名风险。

TxRay 关注真实的用户安全场景：钱包连接、索引化链上数据、RPC 读取、multicall、calldata 解码、Permit2 授权分析、EIP-712 typed data 检查，以及面向用户的人话解释。

## 为什么做这个项目

很多钱包和浏览器工具会给出原始警告，但用户经常仍然看不懂自己到底授权了什么、签了什么。

TxRay 的核心是 **检测 + 解释**：

- 检测高风险代币授权和 Permit2 授权。
- 解码 calldata 和常见危险函数选择器。
- 在用户签名前检查 EIP-712 typed data。
- 用人话解释风险，并把风险点链接到对应的原理文章。

## 当前功能

### TxRay · 授权检查

- 通过服务端 Etherscan 索引器路由读取 ERC-20、ERC-721 和 Permit2 授权历史。
- 用 viem multicall 校验当前授权额度，过滤已经失效的历史授权。
- 检测 ERC-20 无限授权。
- 检测 NFT `setApprovalForAll` 整集合授权。
- 检查 Uniswap Permit2 内部授权，而不只看表层的 ERC-20 approve。
- 识别 spender 风险：
  - 已知可信合约；
  - EOA spender；
  - 新部署的未知合约；
  - 未知合约；
  - 可持续补充的恶意地址黑名单。
- 通过已连接钱包撤销 ERC-20、NFT 和 Permit2 授权。
- 演示模式：`/tools/txray/approvals?demo=1`。

### TxRay · 交易解码

- 直接解码 calldata。
- 通过交易 hash 拉取 transaction input 并解码。
- 识别 `approve`、`setApprovalForAll`、`permit`、`transferFrom`、`transfer` 等常见选择器。
- 高亮高风险调用，并解释函数可能授权什么。
- 未知选择器 fallback 到 OpenChain 签名库查询。

### TxRay · EIP-712 签名解码

- 粘贴钱包签名弹窗中的 typed-data JSON。
- 识别 ERC-20 `permit`、Permit2 typed data 和订单类签名。
- 抽取安全关键字段：
  - spender / operator；
  - token；
  - amount；
  - deadline / expiration；
  - verifying contract；
  - nonce。
- 标记无限额度和长期有效签名。
- 完全只读：不会要求钱包签署任何内容。

### 原理文章

- `/articles/why-unlimited-approval-is-dangerous`
- `/articles/permit2-eip712-phishing`

站点通过轻量本地 i18n provider 支持中文和英文切换。

## 技术栈

| 层 | 选择 |
|---|---|
| 框架 | Next.js 16 App Router + React 19 |
| 语言 | TypeScript |
| 钱包 | RainbowKit 2 |
| 链交互 | wagmi 2 + viem 2 |
| 查询/缓存 | TanStack Query |
| UI | Tailwind CSS 4 + DaisyUI 5 |
| 测试 | Vitest |
| 包管理 | pnpm |

## 架构

单个 Next.js 应用。工具以路由形式存在，业务逻辑放在 `src/features` 下。

```text
src/
├─ app/
│  ├─ tools/txray/          # TxRay 路由
│  ├─ articles/             # 原理文章
│  └─ api/                  # 服务端索引器/签名辅助路由
├─ components/              # 共享 UI 组件
├─ content/articles.ts      # 轻量文章内容注册表
├─ features/txray/          # 授权、交易解码、签名分析逻辑
└─ lib/
   ├─ i18n/                 # 本地双语文本 provider
   └─ web3/                 # wagmi / viem 配置
```

当前刻意不使用 monorepo。项目只有一个可部署应用，常规项目内 import 已足够。等出现需要独立部署的第二个应用时，再升级成 workspace。

## 数据流

| 数据 | 运行位置 | 原因 |
|---|---|---|
| 授权历史 | 服务端路由 -> Etherscan 索引器 | 免费 RPC 全历史 `eth_getLogs` 不现实。 |
| 当前额度 / 元数据 | 浏览器 -> viem multicall | 读取实时链上状态，不需要自有服务端状态。 |
| spender 创建信息 | 服务端路由 -> Etherscan | API key 留在服务端。 |
| calldata 解码 | 浏览器 + 签名查询路由 | 本地选择器表优先，未知再查 OpenChain。 |
| EIP-712 分析 | 浏览器本地 | 纯 JSON 检查，不需要 RPC，也不需要签名。 |

## 安全姿态

- 永不索要助记词或私钥。
- 默认都是只读分析。
- 写操作只限于用户通过钱包主动发起的撤销交易。
- Etherscan API key 保留在服务端。
- WalletConnect 和 Alchemy public key 属于前端 key，应在供应商后台配置域名限制。

## 本地开发

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

需要的环境变量：

| 变量 | 用途 |
|---|---|
| `NEXT_PUBLIC_WC_PROJECT_ID` | Reown / WalletConnect Project ID，用于 RainbowKit |
| `NEXT_PUBLIC_ALCHEMY_ID` | Alchemy RPC key |
| `ETHERSCAN_API_KEY` | Etherscan V2 API key，服务端路由使用 |
| `DEV_PROXY` | 可选，本地开发时让服务端 fetch 走 HTTP/混合代理 |

`DEV_PROXY` 示例：

```env
DEV_PROXY=http://127.0.0.1:10808
```

## 验证

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

## 后续方向

- 补充更多真实 spender 标签和公开 drainer/blocklist 数据源。
- 增加多链授权检查。
- 增加 `$ at risk` 风险金额估算。
- 内容增长后，将文章系统升级为 MDX。
- 公开部署后补充线上地址。

## License

MIT



