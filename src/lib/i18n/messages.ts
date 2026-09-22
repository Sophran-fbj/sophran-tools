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
      title: 'TxRay',
      subtitle: 'Web3 授权与交易风险检查器：不只标记风险，还解释为什么危险。',
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
    approvals: {
      loadingPage: '加载授权检查器…',
      title: '授权检查',
      currentNetwork: (name: string) => `当前网络：${name}`,
      demo:
        '演示模式：这里展示的是内置样例，不会读取链上数据，也不会发起撤销交易。它展示 TxRay 如何解释无限授权、Permit2 和 EOA spender 风险。',
      network: '网络',
      supportedNetworks: '支持 Ethereum / Base / Arbitrum / Optimism',
      queryAddress: '查询地址',
      queryAddressHint: '留空则查询已连接的钱包',
      addressPlaceholder: '0x… 或 vitalik.eth',
      invalidAddress: '请输入合法地址（0x…）或 ENS 域名（xxx.eth）',
      resolvingEns: '解析 ENS 中…',
      ensFailed: '无法解析该 ENS 域名',
      querying: '正在查询：',
      connectedWallet: '已连接钱包',
      startHint: '连接钱包，或在上方粘贴一个地址 / ENS 开始查询。',
      scanning: '扫描链上授权中…（含 Permit2，全历史事件 + multicall 校验）',
      queryFailed: '授权查询失败，请稍后重试。',
      queryFailedDetail: '如果问题持续存在，请检查所选网络和 RPC/Etherscan 服务状态。',
      partialTitle: '扫描结果不完整，不能据此判断该地址安全',
      warningIndexTruncated: (max: number) =>
        `历史事件超过单类 ${max.toLocaleString()} 条，结果已截断。`,
      warningCurrentReads: (count: number) =>
        `${count} 条授权的实时状态读取失败；这些条目未被当作安全或已撤销。`,
      warningDecimals: (count: number) =>
        `${count} 个代币的 decimals 读取失败，额度将显示为原始整数。`,
      warningBalances: (count: number) =>
        `${count} 个代币的余额读取失败，暴露金额未知。`,
      riskUnavailable: 'spender 风险画像暂时不可用；授权额度仍来自链上实时读取。',
      priceUnavailable:
        '美元价格服务暂时不可用；授权与代币数量仍有效，但不会显示美元暴露估算。',
      pricePartial: (priced: number, requested: number, omitted: number) =>
        `美元价格仅覆盖 ${priced}/${requested} 个代币${omitted > 0 ? `，其中 ${omitted} 个超过查询预算` : ''}；未报价部分不会被当作零风险。`,
      cleanTitle: '✅ 很干净',
      cleanDescription: '该地址当前没有有效的代币授权。',
      approvalCount: (count: number) => `共 ${count} 条有效授权`,
      readonlyMode: '只读模式：连接该地址的钱包后才能撤销',
      permit2Title: 'ℹ️ 什么是 Permit2 授权？为什么也要管',
      permit2Description:
        'Permit2 是独立的授权管理合约。这里展示的是它内部授予具体 spender 的权限，而不只是表层 ERC-20 对 Permit2 合约的 approve。',
      asset: '资产',
      spenderRisk: '被授权方 / 风险',
      allowance: '当前额度',
      action: '操作',
      readonlyNotice: '🔒 只读查询不发起任何交易；撤销由你的钱包签名，本站绝不接触私钥。',
      nftCollection: 'NFT 集合',
      allNfts: '全部 NFT',
      unlimited: '无限',
      permanent: '永久',
      expires: (date: string) => `到期 ${date}`,
      exposure: '暴露',
      unknown: '未知',
      revoked: '已撤销',
      revoke: '撤销',
      revokeTitle: '撤销此授权',
      revokeDisabledTitle: '连接该地址的钱包才能撤销',
      switching: '切换网络…',
      walletConfirming: '确认中…',
      chainConfirming: '链上确认中…',
      switchAndRevoke: (name: string) => `切换到 ${name} 并撤销`,
      viewTransaction: '查看交易',
      cancelled: '已取消',
      walletUnavailable: '钱包或目标链 RPC 不可用',
      revokeFailed: '撤销交易准备失败',
      riskAnalyzing: '分析中…',
      riskUnavailableBadge: '无法验证',
      riskMalicious: '⚠ 已知恶意',
      riskEoa: '⚠ 非合约 (EOA)',
      riskNew: '新合约',
      riskUnknown: '未知合约',
      reasonMalicious: '已知恶意地址，建议立即撤销。',
      reasonEoa: '被授权方是普通钱包而不是合约；正常 dApp 很少需要这种授权。',
      reasonRpcUnavailable: 'RPC 未能验证该地址是否为合约，请稍后重试。',
      reasonNew: (days: number) => `合约仅 ${days} 天前部署，谨慎对待。`,
      reasonUnknown: '未在已知名单中，请自行核实。',
    },
    decoder: {
      title: '交易解码',
      description: '粘贴 calldata 或交易 hash，看清它在干什么',
      network: '交易所在网络',
      inputLabel: 'calldata 或 tx hash',
      sample: '试试示例',
      placeholder: '0x095ea7b3… 或 0x 开头的 64 位交易哈希',
      loading: '解码中…',
      failed: '解码失败，请检查输入和所选网络。',
      readonly: '🔒 解码是纯只读操作，不会发起任何交易。',
      highRisk: '⚠️ 高风险',
      caution: '注意',
      function: '函数',
      unknownFunction: (selector: string) =>
        `未知函数（选择器 ${selector}，签名库未收录）`,
      targetContract: '目标合约',
      parameter: '参数',
      type: '类型',
      value: '值',
      rawCalldata: '原始 calldata',
      unlimited: (type: string) => `无限（max ${type}）`,
      knownExplains: {
        approve: '授权 spender 花费你的代币。无限额度可能让其转走全部余额，请确认 spender 可信。',
        approvalForAll: '把某个 NFT 集合的全部处置权交给 operator，属于高风险权限。',
        permit: '通过离线签名授权 spender，无需单独发送 approve 交易。',
        transferFrom: '从 from 向 to 转账，通常意味着正在使用已有授权。',
        increaseAllowance: '增加 spender 的可花费额度。',
        transfer: '把代币转给 to，通常是普通转账。',
        safeTransferFrom: '转移指定 tokenId 的 NFT。',
      },
      tree: {
        title: '调用树（静态解码）',
        staticNotice:
          '这是静态解码结果，不是交易执行模拟；解析成功不代表执行成功，更不代表资产安全。',
        nodeCount: (count: number) => `共 ${count} 个节点`,
        incompleteBadge: (count: number) => `${count} 个未知/未完整`,
        expandAll: '全部展开',
        collapseAll: '全部收起',
        expand: '展开子调用',
        collapse: '收起子调用',
        rawPreview: '原始数据（有限长度）',
        emptyCallData: '空 calldata（纯转账，无调用数据）',
        target: '目标',
        value: '携带',
        selector: '选择器',
        status: '解析状态',
        unknownTarget: '（未知目标）',
        statusLabels: {
          decoded: '已准确解析',
          'signature-only': '仅识别签名',
          partial: '部分解析',
          unknown: '未知调用',
          'recursion-stopped': '递归已停止',
          malformed: '输入格式错误',
        },
        stopReasons: {
          'max-depth': '已达到最大递归深度（5 层），为安全起见停止展开剩余子调用',
          'max-nodes': '已达到最大节点数（100），为安全起见停止展开剩余子调用',
          'max-input-bytes': '输入数据超过大小限制（32KB），解析已按安全限制停止',
        },
        warnings: {
          'empty-calldata': '空 calldata',
          'max-depth-reached': '已达到最大递归深度，剩余子调用未展开',
          'max-nodes-reached': '已达到最大节点数，剩余子调用未展开',
          'max-input-bytes-exceeded': '输入超过大小限制，解析已停止',
          'max-array-items-truncated': '数组项数超过上限，超出部分未解析',
          'child-decode-failed': '该节点下有子调用解码失败，其余子调用已保留',
          'param-value-truncated': '参数过长，展示已截断',
          'container-identification-uncertain': '容器识别依据不充分',
        },
        containers: {
          'multicall3-aggregate3': 'Multicall3 · aggregate3 批量调用',
          'multicall3-aggregate3Value': 'Multicall3 · aggregate3Value 批量调用（带主链币）',
          'multicall-bytes': 'multicall(bytes[]) 批量调用',
          'safe-execTransaction': 'Safe · execTransaction',
          'account-execute': '智能账户 · execute',
          'account-executeBatch': '智能账户 · executeBatch 批量执行',
          'entrypoint-handleOps': 'ERC-4337 EntryPoint · handleOps',
          'entrypoint-handleOps-legacy': 'ERC-4337 EntryPoint · handleOps（v0.6 旧布局）',
          'entrypoint-userOperation': 'UserOperation',
        },
        identification: {
          'canonical-address-and-abi': '识别依据：官方部署地址 + 官方 ABI 形状均匹配',
          'selector-and-abi-shape': '识别依据：函数选择器与官方 ABI 形状匹配',
          'entrypoint-canonical-address-and-abi':
            '识别依据：官方 EntryPoint 地址 + 官方 ABI 形状均匹配',
          'abi-struct-shape': '识别依据：ABI 结构体布局匹配',
        },
        identificationNotes: {
          'safe-selector-shared':
            '同名选择器理论上也可能出现在非 Safe 合约上；这里按 ABI 形状识别，不据此断言合约身份。',
          'multicall-bytes-shared':
            '该选择器被多个合约使用（如 Uniswap 路由、MakerDAO Multicall）；子调用在容器合约自身上下文执行，具体语义取决于实现。',
          'canonical-address-mismatch':
            '目标地址不是官方 Multicall3 部署地址，请自行核实该合约身份。',
          'entrypoint-address-unknown':
            '目标不是已知官方 EntryPoint 地址，版本按 ABI 布局推断。',
          'entrypoint-layout-mismatch':
            '目标是官方 EntryPoint 地址，但其版本对应的 UserOperation 布局与这笔 calldata 不一致；上方版本按实际 ABI 布局推断，请进一步核实这笔调用的真实去向。',
        },
        userOp: {
          factory: 'factory（部署账户）',
          paymaster: 'paymaster（代付 gas）',
          versionLabel: '版本',
          signatureNote: '签名只显示长度与摘要，不做验证',
        },
        severityLabels: {
          high: '高风险',
          medium: '注意',
          low: '低风险',
          info: '提示',
        },
        riskTitles: {
          'erc20-max-allowance': '发现无限额度授权（max）',
          'erc20-increase-allowance': '增加 spender 额度',
          'nft-approval-for-all': 'NFT 全集合授权',
          'erc20-permit': 'ERC-20 permit 离线授权',
          'permit2-permit': 'Permit2 花费授权',
          'transfer-from': 'transferFrom 转出资产',
          'safe-delegatecall': 'Safe 使用 DELEGATECALL',
          'nonzero-native-value': '携带主链币',
          'batch-contains-high-risk': '批量调用中混入高风险授权',
          'unknown-target': '未知目标合约',
          'unknown-selector': '包含未知调用',
          'parse-incomplete': '解析不完整',
          'userop-factory': 'UserOperation 包含 factory（将部署账户）',
          'userop-paymaster': 'UserOperation 包含 paymaster',
          'deadline-suspicious': '授权截止时间异常',
          'subcall-allow-failure': '子调用允许失败',
          'depth-limit-reached': '已达到最大递归深度',
          'node-limit-reached': '已达到最大节点数',
        },
        riskExplains: {
          'erc20-max-allowance':
            '该调用把代币额度授权为 uint 最大值，等效于无限授权；spender 在授权有效期内可能转走全部余额。建议核实 spender 身份。',
          'erc20-increase-allowance':
            '该调用会增加 spender 的可花费额度，请确认额度变化符合预期。',
          'nft-approval-for-all':
            '该调用把整个 NFT 集合的处置权授予 operator；operator 之后可能转移集合内任意 NFT。',
          'erc20-permit':
            '该调用使用离线签名完成授权，不需要单独的 approve 交易；请确认签名者与 spender 都可信。',
          'permit2-permit':
            '该调用通过 Permit2 授予花费权限；Permit2 授权可能绕过表层 ERC-20 approve 展示。注意 permitTransferFrom 类调用的被授权方是调用 Permit2 的合约本身（msg.sender），静态解码无法列出它。',
          'transfer-from':
            '该调用会把资产从 from 转到 to，通常在消耗已有授权；请确认 from 与 to 符合预期。',
          'safe-delegatecall':
            '这笔 Safe 交易使用 DELEGATECALL 执行内部数据：代码将在 Safe 合约的存储上下文中运行，可能直接动用 Safe 的全部资产。除非明确知道自己在做什么，应高度警惕。',
          'nonzero-native-value':
            '该调用携带主链币；静态解码无法判断资金最终去向，建议核实接收方。',
          'batch-contains-high-risk':
            '这批子调用中混有高风险授权；即使其他子调用看起来正常，也请逐项核实。',
          'unknown-target':
            '无法确定该调用的目标地址；请在可信区块浏览器上进一步核实。',
          'unknown-selector':
            '该调用的函数选择器未被签名库收录，无法解析其行为；签名库未收录不等于安全。',
          'parse-incomplete':
            '该节点的解析不完整（部分数据无法解码或被安全限制截断）；当前展示不等于全部内容。',
          'userop-factory':
            '该 UserOperation 会在执行过程中部署新的账户合约；新合约没有历史记录可供参考。',
          'userop-paymaster':
            '该 UserOperation 由 paymaster 代付 gas；实际执行者与付费者可能不同。',
          'deadline-suspicious':
            '该授权的截止时间已过期或长得异常；请结合具体场景核实。',
          'subcall-allow-failure':
            '该子调用允许失败（allowFailure）；失败会被静默吞掉，可能掩盖部分操作没有执行。',
          'depth-limit-reached':
            '嵌套深度已达上限，更深层的内容没有展开；请知悉存在未展示部分。',
          'node-limit-reached':
            '节点数量已达上限，剩余子调用没有展开；请知悉存在未展示部分。',
        },
      },
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
      schemaFallback: '缺少完整 types schema；当前结果使用保守字段扫描，不能视为完整解析。',
      expiredExplain: '签名截止时间已经过去，这段 payload 应无法再成功执行。',
      chainId: 'Chain ID',
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
      title: 'TxRay',
      subtitle:
        'A web3 approval and transaction risk explorer that explains why each risk matters.',
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
    approvals: {
      loadingPage: 'Loading approval checker…',
      title: 'Approval check',
      currentNetwork: (name: string) => `Current network: ${name}`,
      demo:
        'Demo mode uses built-in data. It does not read onchain state or submit revoke transactions. It shows how TxRay explains unlimited approvals, Permit2, and EOA spender risk.',
      network: 'Network',
      supportedNetworks: 'Supports Ethereum / Base / Arbitrum / Optimism',
      queryAddress: 'Address to inspect',
      queryAddressHint: 'Leave empty to inspect the connected wallet',
      addressPlaceholder: '0x… or vitalik.eth',
      invalidAddress: 'Enter a valid 0x address or ENS name (name.eth)',
      resolvingEns: 'Resolving ENS…',
      ensFailed: 'Could not resolve this ENS name',
      querying: 'Inspecting:',
      connectedWallet: 'Connected wallet',
      startHint: 'Connect a wallet or paste an address / ENS name above.',
      scanning: 'Scanning approvals… (Permit2, indexed history, and live multicall checks)',
      queryFailed: 'Approval query failed. Please try again.',
      queryFailedDetail: 'If this continues, check the selected network and RPC/Etherscan status.',
      partialTitle: 'The scan is incomplete and cannot prove this address is safe',
      warningIndexTruncated: (max: number) =>
        `An event category exceeded ${max.toLocaleString()} records and was truncated.`,
      warningCurrentReads: (count: number) =>
        `${count} live approval reads failed; they were not treated as safe or revoked.`,
      warningDecimals: (count: number) =>
        `${count} token decimal reads failed, so their amounts use raw integers.`,
      warningBalances: (count: number) =>
        `${count} token balance reads failed, so their exposure is unknown.`,
      riskUnavailable: 'Spender risk profiles are unavailable; allowances still come from live onchain reads.',
      priceUnavailable:
        'USD pricing is unavailable. Approval and token amounts remain valid, but USD exposure estimates are hidden.',
      pricePartial: (priced: number, requested: number, omitted: number) =>
        `USD prices cover ${priced} of ${requested} tokens${omitted > 0 ? `; ${omitted} exceeded the query budget` : ''}. Unpriced exposure is never treated as zero risk.`,
      cleanTitle: '✅ No active approvals found',
      cleanDescription: 'This address currently has no active token approvals in the complete scan.',
      approvalCount: (count: number) => `${count} active approval${count === 1 ? '' : 's'}`,
      readonlyMode: 'Read-only: connect this address to revoke approvals',
      permit2Title: 'ℹ️ Why Permit2 approvals also matter',
      permit2Description:
        'Permit2 is a separate permission manager. These entries are permissions it grants to specific spenders, not only the outer ERC-20 approval to the Permit2 contract.',
      asset: 'Asset',
      spenderRisk: 'Spender / risk',
      allowance: 'Current allowance',
      action: 'Action',
      readonlyNotice: '🔒 Reads do not submit transactions. Revokes are signed in your wallet; this site never handles private keys.',
      nftCollection: 'NFT collection',
      allNfts: 'All NFTs',
      unlimited: 'Unlimited',
      permanent: 'Permanent',
      expires: (date: string) => `Expires ${date}`,
      exposure: 'Exposure',
      unknown: 'Unknown',
      revoked: 'Revoked',
      revoke: 'Revoke',
      revokeTitle: 'Revoke this approval',
      revokeDisabledTitle: 'Connect this address to revoke',
      switching: 'Switching network…',
      walletConfirming: 'Confirm in wallet…',
      chainConfirming: 'Confirming onchain…',
      switchAndRevoke: (name: string) => `Switch to ${name} and revoke`,
      viewTransaction: 'View transaction',
      cancelled: 'Cancelled',
      walletUnavailable: 'The wallet or target-chain RPC is unavailable',
      revokeFailed: 'Failed to prepare the revoke transaction',
      riskAnalyzing: 'Analyzing…',
      riskUnavailableBadge: 'Unverified',
      riskMalicious: '⚠ Known malicious',
      riskEoa: '⚠ EOA spender',
      riskNew: 'New contract',
      riskUnknown: 'Unknown contract',
      reasonMalicious: 'This address is known to be malicious. Revoke immediately.',
      reasonEoa: 'The spender is a wallet, not a contract. Legitimate dApps rarely need this permission.',
      reasonRpcUnavailable: 'RPC could not verify whether this address is a contract. Try again later.',
      reasonNew: (days: number) => `This contract was deployed only ${days} day${days === 1 ? '' : 's'} ago.`,
      reasonUnknown: 'This contract is not in the known-label set. Verify it independently.',
    },
    decoder: {
      title: 'Transaction decoder',
      description: 'Paste calldata or a transaction hash to inspect what it does',
      network: 'Transaction network',
      inputLabel: 'calldata or transaction hash',
      sample: 'Use sample',
      placeholder: '0x095ea7b3… or a 0x-prefixed 64-character transaction hash',
      loading: 'Decoding…',
      failed: 'Decoding failed. Check the input and selected network.',
      readonly: '🔒 Decoding is read-only and never submits a transaction.',
      highRisk: '⚠️ High risk',
      caution: 'Caution',
      function: 'Function',
      unknownFunction: (selector: string) =>
        `Unknown function (selector ${selector} was not found in the signature database)`,
      targetContract: 'Target contract',
      parameter: 'Parameter',
      type: 'Type',
      value: 'Value',
      rawCalldata: 'Raw calldata',
      unlimited: (type: string) => `Unlimited (max ${type})`,
      knownExplains: {
        approve: 'Allows the spender to use your tokens. An unlimited amount can expose the full balance, so verify the spender.',
        approvalForAll: 'Gives an operator control over an entire NFT collection. This is a high-impact permission.',
        permit: 'Grants spending permission through an offchain signature without a separate approve transaction.',
        transferFrom: 'Moves assets from from to to, usually by consuming an existing approval.',
        increaseAllowance: 'Increases the amount the spender may use.',
        transfer: 'Transfers tokens to the recipient and is usually a standard transfer.',
        safeTransferFrom: 'Transfers the specified NFT tokenId.',
      },
      tree: {
        title: 'Call tree (static decoding)',
        staticNotice:
          'This is a static decoding result, not a transaction simulation. A successful decode does not mean the transaction will succeed or that assets are safe.',
        nodeCount: (count: number) => `${count} node${count === 1 ? '' : 's'}`,
        incompleteBadge: (count: number) =>
          `${count} unknown/incomplete`,
        expandAll: 'Expand all',
        collapseAll: 'Collapse all',
        expand: 'Expand subcalls',
        collapse: 'Collapse subcalls',
        rawPreview: 'Raw data (bounded preview)',
        emptyCallData: 'Empty calldata (plain transfer, no call data)',
        target: 'Target',
        value: 'Value',
        selector: 'Selector',
        status: 'Decode status',
        unknownTarget: '(unknown target)',
        statusLabels: {
          decoded: 'Decoded',
          'signature-only': 'Signature only',
          partial: 'Partially decoded',
          unknown: 'Unknown call',
          'recursion-stopped': 'Recursion stopped',
          malformed: 'Malformed input',
        },
        stopReasons: {
          'max-depth': 'Maximum recursion depth (5) reached; remaining subcalls are not expanded for safety',
          'max-nodes': 'Maximum node count (100) reached; remaining subcalls are not expanded for safety',
          'max-input-bytes': 'Input exceeds the size limit (32KB); parsing stopped by the safety limit',
        },
        warnings: {
          'empty-calldata': 'Empty calldata',
          'max-depth-reached': 'Maximum recursion depth reached; remaining subcalls are not expanded',
          'max-nodes-reached': 'Maximum node count reached; remaining subcalls are not expanded',
          'max-input-bytes-exceeded': 'Input exceeds the size limit; parsing stopped',
          'max-array-items-truncated': 'Array exceeds the item limit; extra items are not decoded',
          'child-decode-failed': 'Some subcall under this node failed to decode; the rest are preserved',
          'param-value-truncated': 'Parameter value was truncated for display',
          'container-identification-uncertain': 'Container identification is uncertain',
        },
        containers: {
          'multicall3-aggregate3': 'Multicall3 · aggregate3 batch',
          'multicall3-aggregate3Value': 'Multicall3 · aggregate3Value batch (with native value)',
          'multicall-bytes': 'multicall(bytes[]) batch',
          'safe-execTransaction': 'Safe · execTransaction',
          'account-execute': 'Smart account · execute',
          'account-executeBatch': 'Smart account · executeBatch',
          'entrypoint-handleOps': 'ERC-4337 EntryPoint · handleOps',
          'entrypoint-handleOps-legacy': 'ERC-4337 EntryPoint · handleOps (v0.6 legacy layout)',
          'entrypoint-userOperation': 'UserOperation',
        },
        identification: {
          'canonical-address-and-abi': 'Identified by canonical deployment address + official ABI shape',
          'selector-and-abi-shape': 'Identified by function selector + official ABI shape',
          'entrypoint-canonical-address-and-abi':
            'Identified by canonical EntryPoint address + official ABI shape',
          'abi-struct-shape': 'Identified by ABI struct layout',
        },
        identificationNotes: {
          'safe-selector-shared':
            'The same selector could theoretically appear on a non-Safe contract. Identification is shape-based and does not assert contract identity.',
          'multicall-bytes-shared':
            'Multiple contracts use this selector (Uniswap routers, MakerDAO Multicall, ...). Subcalls execute in the container contract\'s own context; exact semantics depend on the implementation.',
          'canonical-address-mismatch':
            'The target is not the official Multicall3 deployment address. Verify the contract independently.',
          'entrypoint-address-unknown':
            'The target is not a known official EntryPoint address; the version is inferred from the ABI layout.',
          'entrypoint-layout-mismatch':
            'The target is an official EntryPoint address, but the UserOperation layout of this calldata does not match that version. The version above is inferred from the actual ABI layout; verify where this call really goes.',
        },
        userOp: {
          factory: 'factory (deploys the account)',
          paymaster: 'paymaster (sponsors gas)',
          versionLabel: 'Version',
          signatureNote: 'Signature shows length and digest only; it is not verified',
        },
        severityLabels: {
          high: 'High risk',
          medium: 'Caution',
          low: 'Low risk',
          info: 'Info',
        },
        riskTitles: {
          'erc20-max-allowance': 'Unlimited (max) token allowance found',
          'erc20-increase-allowance': 'Spender allowance increase',
          'nft-approval-for-all': 'Whole-collection NFT approval',
          'erc20-permit': 'ERC-20 permit approval',
          'permit2-permit': 'Permit2 spending approval',
          'transfer-from': 'transferFrom moves assets',
          'safe-delegatecall': 'Safe uses DELEGATECALL',
          'nonzero-native-value': 'Native value attached',
          'batch-contains-high-risk': 'Batch mixes in high-risk approvals',
          'unknown-target': 'Unknown target contract',
          'unknown-selector': 'Contains an unknown call',
          'parse-incomplete': 'Parsing incomplete',
          'userop-factory': 'UserOperation contains a factory',
          'userop-paymaster': 'UserOperation contains a paymaster',
          'deadline-suspicious': 'Unusual approval deadline',
          'subcall-allow-failure': 'Subcall may fail silently',
          'depth-limit-reached': 'Maximum recursion depth reached',
          'node-limit-reached': 'Maximum node count reached',
        },
        riskExplains: {
          'erc20-max-allowance':
            'This call approves the uint maximum amount, which is effectively an unlimited allowance. The spender may be able to move the full balance while the approval is valid. Verify the spender.',
          'erc20-increase-allowance':
            'This call increases the amount the spender may use. Confirm the change matches your expectation.',
          'nft-approval-for-all':
            'This call grants an operator control over the whole NFT collection; the operator may transfer any NFT in it later.',
          'erc20-permit':
            'This call completes an approval through an offchain signature without a separate approve transaction. Verify both the signer and the spender.',
          'permit2-permit':
            'This call grants spending permission through Permit2. Permit2 approvals may not show up as a plain ERC-20 approve. Note that for permitTransferFrom-style calls the granted party is the contract calling Permit2 itself (msg.sender), which static decoding cannot list.',
          'transfer-from':
            'This call moves assets from from to to, usually consuming an existing approval. Confirm both addresses.',
          'safe-delegatecall':
            'This Safe transaction uses DELEGATECALL: the inner code runs in the Safe contract\'s storage context and may access all Safe assets. Treat it with great caution unless you know exactly what it does.',
          'nonzero-native-value':
            'This call carries native currency. Static decoding cannot tell where the funds end up; verify the recipient.',
          'batch-contains-high-risk':
            'High-risk approvals are mixed into this batch. Even if other subcalls look normal, review every item.',
          'unknown-target':
            'The target address of this call cannot be determined. Verify it on a trusted block explorer.',
          'unknown-selector':
            'The function selector is not in the signature database, so the behavior cannot be parsed. Unknown does not mean safe.',
          'parse-incomplete':
            'Parsing is incomplete for this node (some data could not be decoded or was cut by safety limits). What you see is not the whole picture.',
          'userop-factory':
            'This UserOperation deploys a new account contract during execution. New contracts have no history to evaluate.',
          'userop-paymaster':
            'A paymaster sponsors the gas for this UserOperation; the executor and the payer may differ.',
          'deadline-suspicious':
            'The approval deadline has already passed or is unusually long. Verify it for your scenario.',
          'subcall-allow-failure':
            'This subcall allows failure; failures are swallowed silently and may hide operations that never executed.',
          'depth-limit-reached':
            'The nesting depth cap was reached, so deeper content is not expanded. Be aware that part of the tree is not shown.',
          'node-limit-reached':
            'The node count cap was reached, so remaining subcalls are not expanded. Be aware that part of the tree is not shown.',
        },
      },
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
      schemaFallback:
        'A complete types schema is missing. This result uses conservative field scanning and is not a complete parse.',
      expiredExplain: 'The signature deadline has passed, so this payload should no longer execute.',
      chainId: 'Chain ID',
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


