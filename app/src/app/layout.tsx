import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppWalletProvider from "@/components/AppWalletProvider"; // <--- Import the plug

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "shadow engine",
  description: "Private Swiss Bank on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Wrap everything inside the Provider */}
        <AppWalletProvider>
          {children}
        </AppWalletProvider>
      </body>
    </html>
  );
}