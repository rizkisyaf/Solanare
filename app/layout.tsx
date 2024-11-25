import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientWalletProvider } from "./providers/WalletProvider";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "Solanare - Solana Token Account Manager",
  description: "Clean up unused Solana token accounts and reclaim SOL",
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
    other: {
      rel: 'apple-touch-icon-precomposed',
      url: '/apple-touch-icon-precomposed.png',
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  keywords: ["Solana", "Blockchain", "Crypto", "Token", "Web3"],
  metadataBase: new URL('https://solanare.claims'),
  openGraph: {
    title: "Solanare - Solana Token Account Manager",
    description: "Clean up unused Solana token accounts and reclaim SOL",
    url: 'https://solanare.claims',
    siteName: 'Solanare',
    locale: 'en_US',
    type: 'website',
    images: [{
      url: '/og-logo.png',
      width: 1200,
      height: 630,
      alt: 'Solanare Logo',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Solanare - Solana Token Account Manager",
    description: "Clean up unused Solana token accounts and reclaim SOL",
    site: '@kisra_fistya',
    creator: '@kisra_fistya',
    images: [{
      url: 'https://solanare.claims/og-logo.png',
      width: 1200,
      height: 630,
      alt: 'Solanare - Solana Token Account Manager'
    }],
  },
  other: {
    'og:image': 'https://solanare.claims/og-logo.png',
    'og:image:secure_url': 'https://solanare.claims/og-logo.png',
    'og:image:type': 'image/png',
    'og:image:width': '1200',
    'og:image:height': '630',
    'og:type': 'website',
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          defer
          src={process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL}
          data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ErrorBoundary>
          <ClientWalletProvider>
            {children}
            <Toaster />
            <Analytics />
          </ClientWalletProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
