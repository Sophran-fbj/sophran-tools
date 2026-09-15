import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "TxRay — Web3 Approval & Transaction Risk Explorer",
  description:
    "Inspect token approvals, decode transactions and EIP-712 signatures, and understand web3 risks in plain language.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-theme="synthwave">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}


