import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/**" },
      { protocol: "https", hostname: "photos.machinefinder.com" },
    ],
  },
};

export default nextConfig;
