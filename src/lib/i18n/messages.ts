export type Locale = 'zh' | 'en';

export const messages = {
  zh: {
    common: {
      backHome: '返回首页',
      articles: '文章',
      txray: 'TxRay',
      language: '语言',
      zh: '中文',
      en: 'English',
      available: '可用',
      neverSeed:
        '本站绝不索要你的助记词或私钥。所有写操作均通过你的钱包签名。',
    },
    home: {
      title: 'Sophran Tools',
      subtitle: 'Sophran 的 web3 工具站。不只显示风险，还用中文解释原理。',
      txrayDesc:
        '授权检查 + 交易解码：检测 ERC-20 / NFT / Permit2 授权，标记 spender 风险，并解释危险原因。',
      signatureRiskTitle: 'Signature Risk',
      signatureRiskDesc: 'EIP-712 签名风险解释器：识别 permit、Permit2 和订单签名风险。',
    },
    txray: {
      intro: '给链上操作拍 X 光片：看清授权、看懂交易、看懂签名。',
      approvalsTitle: '授权检查',
      approvalsDesc:
        '列出地址的代币授权，标记无限额度、Permit2、NFT 全集合授权和 spender 风险。',
      decoderTitle: '交易解码',
      decoderDesc: '粘贴 calldata 或 tx hash，用人话解释这笔交易在干什么。',
      demoTitle: '快速看效果',
      demoDesc:
        '不连钱包也能看 TxRay 如何解释无限授权、Permit2 和 EOA spender 风险。',
      openApprovalDemo: '打开授权演示',
      articleTitle: '原理文章',
      articleDesc: '工具负责指出风险，文章负责解释为什么危险。',
      unlimitedApproval: '无限授权',
    },
    signatureRisk: {
      title: 'Signature Risk',
      desc: '粘贴 EIP-712 typed data，检查这次签名可能授权什么。',
      readonly:
        '这是只读分析。Signature Risk 不会要求你签署粘贴的内容。看懂 spender、amount 和 deadline 之前，不要信任陌生签名请求。',
      inputLabel: 'Typed-data JSON',
      permitSample: 'ERC-20 permit 示例',
      permit2Sample: 'Permit2 示例',
      placeholder:
        '{"domain":{...},"primaryType":"Permit","message":{...},"types":{...}}',
      idle:
        '粘贴 signTypedData 内容，或点击示例，再运行分析查看危险授权。',
      analyze: '分析',
      failed: '签名分析失败',
      domain: 'Domain',
      primaryType: 'Primary type',
      verifyingContract: '验证合约',
      unknown: '未知',
      notProvided: '未提供',
      fields: '安全关键字段',
      noFields:
        '未检测到常见 permit 或 operator 字段。签名前仍需检查原始 message。',
      field: '字段',
      value: '值',
      why: '为什么重要',
      rawMessage: '原始 message',
      riskTitles: {
        unknown: '未知 typed-data 签名',
        permit2: 'Permit2 代币花费授权',
        erc20Permit: 'ERC-20 permit 授权',
        nftOrder: 'NFT 或订单类签名',
        operator: 'Operator 授权',
      },
      riskExplains: {
        unknown:
          'Signature Risk 无法可靠分类这段 typed data。签名前请逐项检查地址、金额和到期时间。',
        permit2:
          '这个签名可以通过 Uniswap Permit2 授予 spender 花费权限。它可能在之后移动代币，而不需要单独的 approve 交易。',
        erc20Permit:
          '这个签名可以在不发送链上 approve 交易的情况下授权 spender 花费代币。',
        nftOrder:
          '这看起来像订单类签名。签署后可能授权市场或 conduit 移动 NFT 或结算订单。',
        operator:
          '这个签名包含 operator。operator 可能在签名被接受后代表你操作资产。',
      },
      findingLabels: {
        spender: 'Spender',
        operator: 'Operator',
        conduit: 'Conduit',
        token: 'Token',
        owner: 'Owner',
        amount: 'Amount',
        nonce: 'Nonce',
        deadline: 'Deadline',
      },
      findingExplains: {
        spender: 'Spender 是可能获得代币花费权限的地址。',
        operator: 'Operator 可能被授权代表你操作资产。',
        conduit: 'Conduit 通常参与订单结算或资产转移路径。',
        token: 'Token 是这次签名涉及的资产合约。',
        owner: 'Owner 是拥有资产或授权的钱包。',
        amount: 'Amount 是签名里嵌入的额度或数量。',
        amountUnlimited:
          '无限额度意味着 spender 可能在授权有效期内移动全部余额。',
        nonce: 'Nonce 用来防止同一签名被重复使用。',
        deadline: 'Deadline 决定签名可以被使用到什么时候。',
      },
    },
  },
  en: {
    common: {
      backHome: 'Back home',
      articles: 'Articles',
      txray: 'TxRay',
      language: 'Language',
      zh: '中文',
      en: 'English',
      available: 'Available',
      neverSeed:
        'This site never asks for your seed phrase or private key. All write actions are signed in your wallet.',
    },
    home: {
      title: 'Sophran Tools',
      subtitle:
        'Onchain utilities for safer web3 interactions.',
      txrayDesc:
        'Approval checks and transaction decoding for ERC-20, NFT, and Permit2 risk analysis.',
      signatureRiskTitle: 'Signature Risk',
      signatureRiskDesc:
        'An EIP-712 signature risk explainer for permit, Permit2, and order-style signatures.',
    },
    txray: {
      intro:
        'An X-ray for on-chain actions: inspect approvals, transactions, and signatures.',
      approvalsTitle: 'Approval check',
      approvalsDesc:
        'Find token approvals, unlimited allowances, Permit2 permissions, NFT collection approvals, and spender risk.',
      decoderTitle: 'Transaction decoder',
      decoderDesc: 'Paste calldata or a transaction hash and inspect what it does.',
      demoTitle: 'Quick demo',
      demoDesc:
        'See how TxRay explains unlimited approvals, Permit2, and EOA spender risk without connecting a wallet.',
      openApprovalDemo: 'Open approval demo',
      articleTitle: 'Explain the risks',
      articleDesc: 'The tools detect risks; the articles explain why they matter.',
      unlimitedApproval: 'Unlimited approvals',
    },
    signatureRisk: {
      title: 'Signature Risk',
      desc: 'Paste EIP-712 typed data and inspect what a signature can authorize.',
      readonly:
        'This is read-only analysis. Signature Risk will never ask you to sign the pasted payload. Treat unknown signature requests as hostile until you understand the spender, amount, and deadline.',
      inputLabel: 'Typed-data JSON',
      permitSample: 'ERC-20 permit sample',
      permit2Sample: 'Permit2 sample',
      placeholder:
        '{"domain":{...},"primaryType":"Permit","message":{...},"types":{...}}',
      idle:
        'Paste a signTypedData payload, or click a sample, then run analysis to inspect risky approvals.',
      analyze: 'Analyze',
      failed: 'Failed to analyze signature',
      domain: 'Domain',
      primaryType: 'Primary type',
      verifyingContract: 'Verifying contract',
      unknown: 'Unknown',
      notProvided: 'Not provided',
      fields: 'Security-relevant fields',
      noFields:
        'No common permit or operator fields were detected. Inspect the raw message before signing.',
      field: 'Field',
      value: 'Value',
      why: 'Why it matters',
      rawMessage: 'Raw message',
      riskTitles: {
        unknown: 'Unknown typed-data signature',
        permit2: 'Permit2 token spending approval',
        erc20Permit: 'ERC-20 permit approval',
        nftOrder: 'NFT or order signature',
        operator: 'Operator authorization',
      },
      riskExplains: {
        unknown:
          'Signature Risk cannot confidently classify this typed-data payload. Review every address, amount, and deadline before signing.',
        permit2:
          'This signature can grant a spender permission through Uniswap Permit2. It may move tokens later without a separate approval transaction.',
        erc20Permit:
          'This signature can approve token spending without sending an on-chain approve transaction first.',
        nftOrder:
          'This looks like an order-style signature. Signing can authorize a marketplace or conduit to move NFTs or settle an order.',
        operator:
          'This signature names an operator. Operators can be dangerous because they may act on assets after the signature is accepted.',
      },
      findingLabels: {
        spender: 'Spender',
        operator: 'Operator',
        conduit: 'Conduit',
        token: 'Token',
        owner: 'Owner',
        amount: 'Amount',
        nonce: 'Nonce',
        deadline: 'Deadline',
      },
      findingExplains: {
        spender: 'Spender may receive permission to spend tokens.',
        operator: 'Operator may be authorized to act on your assets.',
        conduit: 'Conduit may participate in order settlement or asset movement.',
        token: 'Token is the asset contract referenced by this signature.',
        owner: 'Owner is the wallet that owns the assets or approval.',
        amount: 'Amount is the value embedded in the signature.',
        amountUnlimited:
          'Unlimited amount means the spender may move the full balance while the approval remains valid.',
        nonce: 'Nonce prevents replay of the same signature.',
        deadline: 'Deadline controls how long the signature remains usable.',
      },
    },
  },
} as const;

export type Messages = (typeof messages)[Locale];


