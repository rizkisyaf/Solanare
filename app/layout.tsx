import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ClientWalletProvider } from "./providers/WalletProvider";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
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
