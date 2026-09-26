# TxRay — Web3 Approval & Transaction Risk Explorer

**Languages:** [中文](./README.md) | English

[![Live Demo](https://img.shields.io/badge/Live_Demo-Open_TxRay-7c3aed?style=for-the-badge)](https://sophran-tools.vercel.app/tools/txray)
[![Try without wallet](https://img.shields.io/badge/Try_without_wallet-Demo_Mode-0891b2?style=for-the-badge)](https://sophran-tools.vercel.app/tools/txray/approvals?demo=1)
[![CI](https://github.com/Sophran-fbj/sophran-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/Sophran-fbj/sophran-tools/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/Sophran-fbj/sophran-tools)](./LICENSE)

> Inspect ERC-20, NFT, and Permit2 approvals, decode transactions and EIP-712 signatures, and understand every risk in plain language.

> [!IMPORTANT]
> **Safety boundary:** Read-only by default. Demo mode uses built-in samples—it never connects to a wallet, reads an address, or sends a transaction. Revokes require explicit confirmation in the user's wallet; the site never handles seed phrases or private keys.

![TxRay desktop approval risk check](./docs/assets/txray-desktop.png)

<p align="center"><strong>20-second walkthrough: inspect approvals and decode a transaction without connecting a wallet</strong></p>
<p align="center"><img src="./docs/assets/txray-demo.gif" alt="TxRay wallet-free walkthrough" width="960" /></p>

TxRay is the onchain-security product within Sophran Tools. It currently includes **Approval Check**, **Transaction Decoder**, and **Signature Risk** for token permissions, calldata / transaction input, and EIP-712 signing risk.

These tools focus on practical user safety: wallet connection, indexed chain data, RPC reads, multicall, calldata decoding, Permit2 allowance analysis, EIP-712 typed-data inspection, and plain-language risk explanation.

## Why This Project Exists

Many wallet and explorer tools show raw warnings, but users often still do not understand what they are approving or signing.

TxRay focuses on **detect + explain**:

- Detect risky token approvals and Permit2 allowances.
- Decode calldata and common dangerous function selectors.
- Explain risks in plain language and link each risk back to educational articles.

## Current Features

### TxRay · Approval Check

- Read ERC-20, ERC-721, and Permit2 approval history through a server-side Etherscan indexer route; explicitly mark results incomplete when the pagination budget is reached.
- Verify current allowances with chunked viem multicalls, filtering stale approvals without creating oversized RPC requests.
- Detect unlimited ERC-20 allowances.
- Detect NFT `setApprovalForAll` collection-level approvals.
- Inspect Uniswap Permit2 internal allowances.
- Support Ethereum, Base, Arbitrum, and Optimism.
- Estimate `$ at risk` with `min(current balance, allowance)`, using server-side batched and cached CoinGecko pricing plus explicit complete, partial, or unavailable coverage states.
- Classify spender risk:
  - known trusted contracts,
  - EOA spenders,
  - newly deployed unknown contracts,
  - unknown contracts,
  - chain-scoped known-contract labels;
  - Scam Sniffer public malicious-address intelligence (updated daily with an approximately 7-day public-data delay); failures degrade explicitly, and unknown never means safe.
- Revoke ERC-20, NFT, and Permit2 approvals after enforcing the target chain and simulating the write.
- Demo mode: `/tools/txray/approvals?demo=1`.

### TxRay · Transaction Decoder

- Decode calldata directly.
- Fetch and decode transaction input on the selected Ethereum, Base, Arbitrum, or Optimism network.
- Recognize common selectors such as `approve`, `setApprovalForAll`, `permit`, `transferFrom`, and `transfer`.
- Recursively expand Multicall3, `multicall(bytes[])`, Safe `execTransaction`, smart-account `execute/executeBatch`, and ERC-4337 `handleOps`, attaching findings to concrete call paths.
- Enforce hard limits on recursion depth, node count, and raw-data previews; unknown, truncated, and incomplete paths expand by default and are never described as safe.
- Highlight high-risk calls and explain what the function can authorize.
- Fallback to an OpenChain signature lookup for unknown selectors.

### Signature Risk · EIP-712 Signature Risk Explainer

- Paste typed-data JSON from a wallet signing prompt.
- Recognize ERC-20 `permit`, Permit2 typed data, and order-style signatures.
- Extract security-relevant fields:
  - spender/operator,
  - token,
  - amount,
  - deadline/expiration,
  - verifying contract,
  - nonce.
- Flag unlimited amounts and long-lived signatures.
- Fully read-only: it never asks the wallet to sign anything.

### Articles

- `/articles/why-unlimited-approval-is-dangerous`
- `/articles/permit2-eip712-phishing`
- `/articles/why-batched-transactions-hide-risk`

The site supports Chinese and English through a lightweight local i18n provider.

## Technical Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router + React 19 |
| Language | TypeScript |
| Wallet | RainbowKit 2 |
| Chain interaction | wagmi 2 + viem 2 |
| Query/cache | TanStack Query |
| UI | Tailwind CSS 4 + DaisyUI 5 |
| Tests | Vitest + Playwright |
| Package manager | pnpm |

## Architecture

Single Next.js app. Tools are routes; business logic lives under `src/features`.

```text
src/
├─ app/
│  ├─ tools/txray/          # TxRay routes
│  ├─ articles/             # educational articles
│  └─ api/                  # server-side indexer/signature helper routes
├─ components/              # shared UI components
├─ content/articles.ts      # lightweight article content registry
├─ features/txray/          # approval and transaction decoder logic
├─ features/signature-risk/ # EIP-712 signature analysis logic
└─ lib/
   ├─ i18n/                 # local bilingual text provider
   └─ web3/                 # wagmi / viem configuration
```

The project deliberately avoids monorepo complexity for now. There is only one deployable app, so shared code is regular project-level imports. If another independently deployed app appears later, this structure can be promoted to a workspace.

## Data Flow

| Data | Where it runs | Why |
|---|---|---|
| Approval history | Server route -> Etherscan indexer | Full-history `eth_getLogs` is impractical on free RPC plans. |
| Current allowance / metadata | Browser -> viem multicall | Live chain state; no private server state needed. |
| Spender creation info | Server route -> Etherscan | Keeps API key server-side. |
| Calldata decoding | Browser + signature lookup route | Local known selector map first, fallback to OpenChain. |
| EIP-712 analysis | Browser only | Pure JSON inspection; no RPC or signing required. |
| Token prices | Browser -> batched server cache -> CoinGecko | Used only for `$ at risk`; missing or failed pricing reports coverage explicitly and falls back to token amounts. |

## Security Posture

- Never asks for a seed phrase or private key.
- Read-only analysis by default.
- Write operations are limited to revoke transactions initiated through the user's wallet.
- Etherscan API key stays server-side.
- Wallet addresses are not persisted or profiled. Approval and contract-info routes process query addresses transiently and send query parameters to Etherscan. RPC requests remain subject to node-provider policies; the pricing route sends only token contract addresses, never wallet addresses, to CoinGecko.
- Malicious-address checks periodically download Scam Sniffer's complete public list on the server and match locally; queried user addresses are not sent to the intelligence provider.
- WalletConnect and Alchemy public keys are frontend keys and should be domain-restricted in provider dashboards.

## Local Development

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Required environment variables:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_WC_PROJECT_ID` | Reown / WalletConnect Project ID for RainbowKit |
| `NEXT_PUBLIC_ALCHEMY_ID` | Alchemy RPC key |
| `ETHERSCAN_API_KEY` | Etherscan V2 API key used by server routes |
| `COINGECKO_DEMO_API_KEY` | Optional but recommended CoinGecko Demo API key, server-side only; without it, keyless mode fills one uncached token per request and reports partial coverage explicitly |
| `DEV_PROXY` | Optional local HTTP/mixed proxy for mainland-China development |
| `UPSTASH_REDIS_REST_URL` | Optional; shares rate limits, Etherscan pacing, and short-lived approval cache across production instances |
| `UPSTASH_REDIS_REST_TOKEN` | Optional; matching Redis REST write token, server-side only |

Example `DEV_PROXY`:

```env
DEV_PROXY=http://127.0.0.1:10808
```

Without `NEXT_PUBLIC_WC_PROJECT_ID`, local builds still work with injected browser wallets only. Production should provide a real, domain-restricted Project ID.

Without Redis, the service falls back to process-local rate limits, request pacing, and caching, which is suitable for local development. A shared backend is recommended for serverless production. API responses expose the active layers, shared-cache misses, and degraded states through `X-TxRay-Guard` and `X-TxRay-Cache`. Shared approval entries expire after 60 seconds; wallet addresses and client IPs are used only to derive server-side HMAC keys and are never stored in plaintext in Redis.

## Known Limitations

- Etherscan log scans are capped at 10,000 records per event class. Reaching the cap produces an explicit incomplete-scan warning and no "no active approvals found" conclusion.
- Trusted spender labels currently apply only to Ethereum mainnet; other chains default to unknown.
- One approval scan queries USD prices for at most 500 unique tokens, in server batches of up to 100. Over-budget, unpriced, or upstream-limited keyless tokens produce partial coverage and are never treated as zero risk.
- Signature Risk validates declared field values and expands structures and arrays from EIP-712 `types`. Without a schema, it performs conservative field scanning and displays a limitation warning. Structural validation and pattern matching do not verify the receiving contract's actual semantics. A deadline that has passed does not prove the receiving contract will reject the signature, so it does not automatically lower the overall risk level.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

Run `pnpm exec playwright install chromium` before the first E2E run. GitHub Actions runs the same checks on pushes and pull requests.

## Next Steps

- Add more real spender labels and a public drainer/blocklist source.
- Add more chains after Ethereum / Base / Arbitrum / Optimism are stable.
- Add a second price source beyond CoinGecko and surface quality warnings for low-liquidity quotes.
- Improve article authoring with MDX once content grows.

## License

[MIT](./LICENSE)



