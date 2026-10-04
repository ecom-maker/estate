import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Imported listing/project media (Reelly) and other S3 buckets.
      { protocol: "https", hostname: "reelly-backend.s3.amazonaws.com" },
      { protocol: "https", hostname: "**.amazonaws.com" },
      // Admin-uploaded media in Supabase Storage.
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
