import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets a second session run on 127.0.0.1 alongside localhost (separate cookies),
  // e.g. to test as two users at once. Has no effect on builds.
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
