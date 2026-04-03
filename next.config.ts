import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Vercel handles output mode automatically */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
