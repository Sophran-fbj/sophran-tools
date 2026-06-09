'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function TxRayPage() {
  return (
    <main className="min-h-screen bg-base-100 px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href="/"
              className="text-sm text-base-content/60 hover:text-base-content"
            >
              ← 返回
            </Link>
            <h1 className="mt-2 text-4xl font-bold text-primary">TxRay</h1>
            <p className="mt-2 text-base-content/80">
              给链上操作拍 X 光片：看清授权、看懂交易。
            </p>
          </div>
          <ConnectButton />
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Link
            href="/tools/txray/approvals"
            className="card bg-base-200 transition hover:bg-base-300"
          >
            <div className="card-body">
              <h2 className="card-title">授权检查</h2>
              <p className="text-sm text-base-content/70">
                列出地址的代币授权，标记无限额度与未知合约，一键撤销。
              </p>
            </div>
          </Link>

          <Link
            href="/tools/txray/decoder"
            className="card bg-base-200 transition hover:bg-base-300"
          >
            <div className="card-body">
              <h2 className="card-title">交易解码</h2>
              <p className="text-sm text-base-content/70">
                粘贴 calldata 或 tx hash，用人话解释这笔交易在干什么。
              </p>
            </div>
          </Link>

          <Link
            href="/tools/txray/signature"
            className="card bg-base-200 transition hover:bg-base-300"
          >
            <div className="card-body">
              <h2 className="card-title">签名解码</h2>
              <p className="text-sm text-base-content/70">
                粘贴 EIP-712 typed data，识别 permit、Permit2 和订单签名风险。
              </p>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
