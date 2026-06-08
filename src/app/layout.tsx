import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "web3-toolbench",
  description: "个人 web3 工具站 —— 每个风险点都配人话解释",
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
