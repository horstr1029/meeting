import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
  experimental: {
    proxyClientMaxBodySize: 500 * 1024 * 1024, // 500 MB — allows large audio uploads
  },
};

export default nextConfig;
