import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

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

export default withSentryConfig(nextConfig, {
  org: "schrico",
  project: "tetraepik-pm-webapp",
  // Source map upload for readable production stack traces. Without the token (e.g. local
  // builds) the upload is skipped and the build still succeeds.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  // Only print source map upload logs in CI
  silent: !process.env.CI,
});
