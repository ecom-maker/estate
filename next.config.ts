import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Custom loader (image-loader.ts): serve S3/Supabase images directly and
    // optimize Unsplash via its CDN — the default optimizer can't fetch our
    // imported media. With a custom loader, remotePatterns is not used.
    loader: "custom",
    loaderFile: "./image-loader.ts",
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
