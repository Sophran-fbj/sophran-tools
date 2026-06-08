# web3-toolbench

> 一个边检查链上风险、边用中文讲清原理的 web3 工具站。
> *A web3 toolbench that not only flags on-chain risks, but explains the why.*

个人 web3 工具站。第一个工具是 **TxRay**——给你的链上操作"拍 X 光片":看清你授权了谁、一笔交易到底在干什么。

## 为什么又一个工具站？

现有工具（如 revoke.cash）只**显示**风险，web3-toolbench 还**解释**风险:每个高危点都配一句人话说明，并链到深度文章。**显示 + 解释**,让普通用户真正看懂自己面临什么——这是它和同类工具的区别。

## 工具

### TxRay · 授权检查 (V1)
- 连钱包或粘贴任意地址，列出全部 ERC-20 / 721 / 1155 授权
- 无限额度、未知合约高亮标记
- 一键撤销
- 每条授权配风险解释

### TxRay · 交易解码 (V2)
- 粘贴 calldata 或交易 hash，解码出在调用什么、参数是什么
- 危险模式（`approve` / `permit` / `setApprovalForAll` 等）重点标注
- 用人话翻译"这笔交易意味着什么"

> 状态：开发中（M1 进行中，见 [Roadmap](#roadmap)）。

## 技术栈

| 层 | 选择 |
|---|---|
| 框架 | Next.js 16 (App Router) + TypeScript |
| 链交互 | wagmi 2 + viem 2 |
| 钱包 | RainbowKit 2 |
| 样式 | Tailwind CSS 4 + DaisyUI 5 |
| 数据 | TanStack Query（wagmi 内置） |
| 包管理 | pnpm |

## 本地运行

```bash
pnpm install

# 配置环境变量
cp .env.local.example .env.local   # 然后填入下面的 key

pnpm dev   # http://localhost:3000
```

### 环境变量

| 变量 | 用途 | 获取 |
|---|---|---|
| `NEXT_PUBLIC_WC_PROJECT_ID` | 钱包连接（RainbowKit 必需） | [cloud.reown.com](https://cloud.reown.com) |
| `NEXT_PUBLIC_ALCHEMY_ID` | RPC 节点 | [alchemy.com](https://alchemy.com) |
| `ETHERSCAN_API_KEY` | 授权历史查询 | [etherscan.io/apis](https://etherscan.io/apis) |

## 架构

单个 Next.js 应用，工具以路由形式存在，互不耦合:

```
src/
├─ app/tools/txray/     # 工具 = 路由
├─ features/            # 业务逻辑（按工具分，互不 import）
├─ lib/web3/            # 共享链层（wagmi/viem/multicall）
└─ components/          # 共享 UI
```

详见 [`docs/技术与架构选型.md`](./docs/技术与架构选型.md) 与 [`docs/需求文档.md`](./docs/需求文档.md)。

## 安全与隐私

这是一个安全工具，因此自身严守:

- **永不接触私钥/助记词**——所有写操作由用户钱包签名。
- **不收集用户数据**——不向自有服务器上传地址，查询直连公开 RPC/API。
- **绝不索要助记词或私钥**。

## 技术取舍（诚实说明）

- **授权历史用 API 而非纯 RPC**:纯 `getLogs` 查全历史受区块范围限制、慢且易超时；MVP 用 Etherscan/Alchemy API 保证完整与速度。
- **wagmi 固定 v2**:RainbowKit 等钱包 UI 生态尚未支持 wagmi 3，v2 是当前稳定主流。

## Roadmap

- [ ] **M1** 钱包连接 + 主网 ERC-20 授权列表
- [ ] **M2** 风险标记 + spender 标签 + 一键撤销
- [ ] **M3** 交易解码器（calldata + tx hash）
- [ ] **M4** 人话解释层 + 危险模式高亮 + 文章联动
- [ ] **M5** 多链扩展（Base / Arbitrum / OP / Polygon）+ 上线

## License

MIT
