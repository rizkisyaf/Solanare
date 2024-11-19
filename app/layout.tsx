import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientWalletProvider } from "./providers/WalletProvider";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "Voidara - Solana Token Account Manager",
  description: "Clean up unused Solana token accounts and reclaim SOL",
  keywords: ["Solana", "Blockchain", "Crypto", "Token", "Web3"],
  openGraph: {
    title: "Voidara - Solana Token Account Manager",
    description: "Clean up unused Solana token accounts and reclaim SOL",
    images: ['/og-image.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Voidara - Solana Token Account Manager",
    description: "Clean up unused Solana token accounts and reclaim SOL",
    images: ['/twitter-image.jpg'],
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <ErrorBoundary>
          <ClientWalletProvider>
            {children}
            <Toaster />
          </ClientWalletProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
