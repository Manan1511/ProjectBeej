import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  env: {
    TRACKING_DEPLOY_CONTEXT: process.env.CONTEXT ?? "",
  },
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  compress: true,
  turbopack: { root: process.cwd() },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.shopify.com" }],
  },
};

export default nextConfig;
