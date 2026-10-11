import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  turbopack: { root: process.cwd() },
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "cdn.shopify.com" }],
  },
};

export default nextConfig;
