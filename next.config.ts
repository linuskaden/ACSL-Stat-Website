import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Make the slideshow images available to the server function at runtime
  // (public/ files are otherwise served only by the CDN, not the fs).
  outputFileTracingIncludes: {
    "/": ["./public/slideshow/**/*"],
    // Team hero photos read via fs on the team overview page.
    "/teams/[slug]": ["./public/teams/**/*"],
  },
};

export default nextConfig;
