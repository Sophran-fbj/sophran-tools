import type { Locale } from '@/lib/i18n/messages';

export interface LocalizedText {
  zh: string;
  en: string;
}

export interface ArticleSection {
  heading: LocalizedText;
  body: LocalizedText[];
}

export interface Article {
  slug: string;
  title: LocalizedText;
  description: LocalizedText;
  date: string;
  tags: string[];
  sections: ArticleSection[];
  relatedTools: Array<{ label: LocalizedText; href: string }>;
}

export const articles: Article[] = [
  {
    slug: 'why-unlimited-approval-is-dangerous',
    title: {
      zh: '无限授权为什么危险',
      en: 'Why Unlimited Approvals Are Dangerous',
    },
    description: {
      zh: 'ERC-20 approve 看起来只是少点一次确认，但无限额度会把未来余额也暴露给 spender。',
      en: 'ERC-20 approve may feel like one less confirmation, but unlimited allowance can expose future balances too.',
    },
    date: '2026-06-09',
    tags: ['ERC-20', 'Approval', 'Risk'],
    relatedTools: [
      {
        label: { zh: '用 TxRay 检查授权', en: 'Check approvals with TxRay' },
        href: '/tools/txray/approvals?demo=1',
      },
      {
        label: { zh: '解码 approve calldata', en: 'Decode approve calldata' },
        href: '/tools/txray/decoder',
      },
    ],
    sections: [
      {
        heading: { zh: 'approve 到底授权了什么', en: 'What approve Actually Grants' },
        body: [
          {
            zh: 'ERC-20 的 approve(spender, amount) 不是转账，而是给 spender 一张额度票。只要 allowance 仍然大于 0，spender 就可以通过 transferFrom 在额度内移动你的代币。',
            en: 'ERC-20 approve(spender, amount) is not a transfer. It gives the spender an allowance ticket. While allowance remains above zero, the spender can move tokens with transferFrom.',
          },
          {
            zh: '很多 dApp 会默认请求 max uint256，也就是所谓无限授权。这样用户以后不用反复 approve，体验更顺，但风险也被放大了。',
            en: 'Many dApps request max uint256 by default. This improves UX because users approve less often, but it also increases risk.',
          },
        ],
      },
      {
        heading: { zh: '危险不只发生在签名当下', en: 'The Risk Persists After Signing' },
        body: [
          {
            zh: '无限授权的关键问题是它会持续存在。你今天钱包里只有 10 USDC，明天转进 10,000 USDC，只要授权还在，spender 理论上仍然能动这笔新余额。',
            en: 'The core problem is persistence. If you hold 10 USDC today and receive 10,000 tomorrow, an active unlimited approval can expose the new balance too.',
          },
          {
            zh: '如果 spender 合约本身有漏洞、被升级成恶意实现、前端被劫持诱导你交互，或者你授权给了伪装合约，这张额度票都会变成攻击入口。',
            en: 'If the spender contract is vulnerable, upgraded maliciously, front-end hijacked, or simply a fake contract, that allowance becomes an attack path.',
          },
        ],
      },
      {
        heading: { zh: 'TxRay 如何判断风险', en: 'How TxRay Detects the Risk' },
        body: [
          {
            zh: 'TxRay 不只读取历史 Approval 事件，还会用 multicall 回链上校验当前 allowance。历史上授权过不代表现在还有效，只有当前额度仍然大于 0 的授权才会展示。',
            en: 'TxRay reads historical Approval events and then verifies live allowance with multicall. Historical approval is not enough; only currently active approvals are shown.',
          },
          {
            zh: '对于超过阈值的额度，TxRay 标记为无限；对于 NFT setApprovalForAll，TxRay 直接视为高风险，因为它给的是整个集合的操作权。',
            en: 'Very large allowances are marked as unlimited. NFT setApprovalForAll is treated as high risk because it grants collection-level operator rights.',
          },
        ],
      },
      {
        heading: { zh: '你该怎么处理', en: 'What To Do' },
        body: [
          {
            zh: '不认识的 spender、EOA spender、刚部署不久的合约、长期不用的无限授权，都应该优先撤销。撤销本质上是把 ERC-20 allowance 设为 0，或把 NFT operator 设为 false。',
            en: 'Unknown spenders, EOA spenders, recently deployed contracts, and old unlimited approvals should be reviewed first. Revoking means setting ERC-20 allowance to 0 or NFT operator approval to false.',
          },
          {
            zh: '真正要使用某个 dApp 时，再按需重新授权。对大额资产钱包，少一次无限授权，往往比多装一个安全插件更有意义。',
            en: 'Approve again only when a dApp is actually needed. For high-value wallets, reducing stale approvals often matters more than installing another warning tool.',
          },
        ],
      },
    ],
  },
  {
    slug: 'permit2-eip712-phishing',
    title: {
      zh: 'Permit2 和 EIP-712 签名为什么容易被钓鱼利用',
      en: 'Why Permit2 and EIP-712 Signatures Are Phishing Targets',
    },
    description: {
      zh: '很多钓鱼不是让你发交易，而是让你签一段看不懂的 typed data。',
      en: 'Many phishing attacks do not ask you to send a transaction. They ask you to sign typed data you do not understand.',
    },
    date: '2026-06-09',
    tags: ['Permit2', 'EIP-712', 'Phishing'],
    relatedTools: [
      {
        label: { zh: '检查 Permit2 授权', en: 'Check Permit2 approvals' },
        href: '/tools/txray/approvals?demo=1',
      },
      {
        label: { zh: '解码 EIP-712 签名', en: 'Decode EIP-712 signatures' },
        href: '/tools/txray/signature',
      },
    ],
    sections: [
      {
        heading: { zh: '为什么签名比交易更容易骗人', en: 'Why Signatures Are Easier To Abuse' },
        body: [
          {
            zh: '交易会消耗 gas，钱包通常会显示目标合约和资产变化；签名不消耗 gas，用户更容易放松警惕。但链下签名一旦被提交到合约，同样可以产生真实资产影响。',
            en: 'Transactions cost gas and wallets often show contracts or asset changes. Signatures feel harmless because they are gasless, but once submitted to a contract they can still affect assets.',
          },
          {
            zh: 'EIP-712 的目标是让结构化签名更可读，但实际钱包弹窗仍然包含大量字段。普通用户很难判断 spender、deadline、token、amount 分别意味着什么。',
            en: 'EIP-712 makes structured signatures more readable, but wallet prompts still contain many fields. Users often cannot tell what spender, deadline, token, or amount means.',
          },
        ],
      },
      {
        heading: { zh: 'ERC-20 permit 的风险', en: 'The Risk of ERC-20 permit' },
        body: [
          {
            zh: 'EIP-2612 permit 允许用户通过签名授权 spender 花费 ERC-20，而不需要先发 approve 交易。便利性很高，但钓鱼站也可以诱导你签一个无限额度 permit。',
            en: 'EIP-2612 permit lets users approve ERC-20 spending with a signature instead of a prior approve transaction. That is convenient, but phishing sites can request unlimited permits too.',
          },
          {
            zh: '一旦攻击者拿到签名，就可以把它提交到 token 合约，使 allowance 生效，然后再转走你的代币。',
            en: 'Once an attacker obtains the signature, they can submit it to the token contract, activate the allowance, and transfer tokens later.',
          },
        ],
      },
      {
        heading: { zh: 'Permit2 多了一层间接授权', en: 'Permit2 Adds an Internal Allowance Layer' },
        body: [
          {
            zh: 'Permit2 是 Uniswap 推出的统一授权合约。用户先把 token 授权给 Permit2，再通过 Permit2 内部的 allowance 把额度分发给具体 spender。',
            en: 'Permit2 is Uniswap’s shared approval contract. Users approve tokens to Permit2, and Permit2 tracks internal allowances for specific spenders.',
          },
          {
            zh: '风险点在于：你看到“授权给 Permit2”只是表层，真正能动币的是 Permit2 内部记录的 spender、amount、expiration。安全工具如果不读这一层，就会漏掉关键风险。',
            en: 'The surface approval to Permit2 is only the outer layer. The real risk is the internal spender, amount, and expiration stored inside Permit2.',
          },
        ],
      },
      {
        heading: { zh: 'TxRay 关注哪些字段', en: 'Fields TxRay Focuses On' },
        body: [
          {
            zh: '签名前最重要的字段是 spender/operator、token、amount、deadline、verifyingContract。spender 决定谁能花钱，amount 决定能花多少，deadline 决定签名能活多久。',
            en: 'Before signing, the most important fields are spender/operator, token, amount, deadline, and verifyingContract.',
          },
          {
            zh: 'TxRay 的签名解码器会把这些字段抽出来，并对 permit、Permit2、订单类签名做风险解释。它不会请求签名，只做本地只读分析。',
            en: 'TxRay extracts these fields and explains permit, Permit2, and order-style signatures. It never asks the wallet to sign; analysis is local and read-only.',
          },
        ],
      },
    ],
  },
];

export function getArticle(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}

export function pickText(text: LocalizedText, locale: Locale): string {
  return text[locale];
}
