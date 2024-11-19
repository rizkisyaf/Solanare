import type { NextConfig } from "next";

const nextConfig = {
  reactStrictMode: true,
  webpack: (config: { resolve: { fallback: { fs: boolean; net: boolean; tls: boolean; }; }; }) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },
}

export default nextConfig;
