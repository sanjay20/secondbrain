import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@secondbrain/db", "@secondbrain/ai-core", "@secondbrain/types"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
    ],
  },
};

export default nextConfig;
