# Sophran Tools

**Languages:** [中文](./README.md) | English

> Onchain utilities for safer web3 interactions.

`sophran-tools` is a web3 tools site by Sophran. It currently includes **TxRay** and **Signature Risk**: TxRay checks approvals and decodes transactions, while Signature Risk analyzes EIP-712 signing risk.

These tools focus on practical user safety: wallet connection, indexed chain data, RPC reads, multicall, calldata decoding, Permit2 allowance analysis, EIP-712 typed-data inspection, and plain-language risk explanation.

## Why This Project Exists

Many wallet and explorer tools show raw warnings, but users often still do not understand what they are approving or signing.

TxRay focuses on **detect + explain**:

- Detect risky token approvals and Permit2 allowances.
- Decode calldata and common dangerous function selectors.
- Explain risks in plain language and link each risk back to educational articles.

## Current Features

### TxRay · Approval Check

- Read ERC-20, ERC-721, and Permit2 approval history through a server-side Etherscan indexer route.
- Verify current allowances with viem multicall, so stale historical approvals are filtered out.
- Detect unlimited ERC-20 allowances.
- Detect NFT `setApprovalForAll` collection-level approvals.
- Inspect Uniswap Permit2 internal allowances.
- Support Ethereum, Base, Arbitrum, and Optimism.
- Estimate `$ at risk` with `min(current balance, allowance)`, and convert it to USD through CoinGecko when pricing is available.
- Classify spender risk:
  - known trusted contracts,
  - EOA spenders,
  - newly deployed unknown contracts,
  - unknown contracts,
  - blocklist-ready malicious addresses.
- Revoke ERC-20, NFT, and Permit2 approvals through the connected wallet.
- Demo mode: `/tools/txray/approvals?demo=1`.

### TxRay · Transaction Decoder

- Decode calldata directly.
- Decode a transaction hash by fetching the transaction input.
- Recognize common selectors such as `approve`, `setApprovalForAll`, `permit`, `transferFrom`, and `transfer`.
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
| Tests | Vitest |
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
├─ features/txray/          # approval, decoder, signature logic
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
| Token prices | Browser -> CoinGecko | Used only for `$ at risk`; falls back to token amount if pricing fails. |

## Security Posture

- Never asks for a seed phrase or private key.
- Read-only analysis by default.
- Write operations are limited to revoke transactions initiated through the user's wallet.
- Etherscan API key stays server-side.
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
| `DEV_PROXY` | Optional local HTTP/mixed proxy for mainland-China development |

Example `DEV_PROXY`:

```env
DEV_PROXY=http://127.0.0.1:10808
```

## Verification

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

## Next Steps

- Add more real spender labels and a public drainer/blocklist source.
- Add more chains after Ethereum / Base / Arbitrum / Optimism are stable.
- Improve `$ at risk` caching and token price coverage.
- Improve article authoring with MDX once content grows.
- Deploy publicly and add the live URL here.

## License

MIT



