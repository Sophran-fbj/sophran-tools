import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { DEFAULT_THEME, THEME_STORAGE_KEY, themes } from "@/lib/theme";

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
    <html lang="zh-CN" data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var theme=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(${JSON.stringify(themes)}.includes(theme))document.documentElement.dataset.theme=theme}catch{}`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}


