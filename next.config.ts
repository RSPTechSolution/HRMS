import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Documents can be up to 10 MB; leave room for multipart overhead.
    serverActions: { bodySizeLimit: "12mb" },
    proxyClientMaxBodySize: "12mb",
  },
};

export default nextConfig;
