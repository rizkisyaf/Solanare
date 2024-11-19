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
  title: "Voidora - Solana Token Account Manager",
  description: "Clean up unused Solana token accounts and reclaim SOL",
  keywords: ["Solana", "Blockchain", "Crypto", "Token", "Web3"],
  metadataBase: new URL('https://voidora.vercel.app'),
  openGraph: {
    title: "Voidora - Solana Token Account Manager",
    description: "Clean up unused Solana token accounts and reclaim SOL",
    url: 'https://voidora.vercel.app',
    siteName: 'Voidora',
    locale: 'en_US',
    type: 'website',
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Voidora - Solana Token Account Manager'
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Voidora - Solana Token Account Manager",
    description: "Clean up unused Solana token accounts and reclaim SOL",
    site: '@kisra_fistya',
    creator: '@kisra_fistya',
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Voidora - Solana Token Account Manager'
    }],
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
