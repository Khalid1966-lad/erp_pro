import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Vercel handles output mode automatically */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    return [
      {
        // Service Worker must NEVER be cached by the browser HTTP cache.
        // The browser uses byte-comparison of sw.js to detect updates.
        // If the browser serves a cached copy, it never sees the new version.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        // Build metadata must also be fetched fresh every time
        // so the SW can read the latest cache name.
        source: '/build-meta.json',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },
};

export default nextConfig;
