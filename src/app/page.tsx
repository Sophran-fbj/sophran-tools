export default function Home() {
  return (
    <main className="min-h-screen bg-base-100 px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold text-primary">web3-toolbench</h1>
        <p className="mt-4 text-base-content/80">
          个人 web3 工具站。不只显示风险，还用中文解释原理。
        </p>

        <div className="mt-10 grid gap-4">
          <a
            href="/tools/txray"
            className="card bg-base-200 transition hover:bg-base-300"
          >
            <div className="card-body">
              <h2 className="card-title">
                TxRay
                <span className="badge badge-primary badge-sm">开发中</span>
              </h2>
              <p className="text-sm text-base-content/70">
                授权检查 + 交易解码：列出地址授权、标记风险、一键撤销；粘
                calldata / tx hash 用人话解释在干什么。
              </p>
            </div>
          </a>
        </div>

        <p className="mt-12 text-xs text-base-content/50">
          🔒 本站绝不索要你的助记词或私钥。所有写操作均通过你的钱包签名。
        </p>
      </div>
    </main>
  );
}
