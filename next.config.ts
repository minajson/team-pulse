import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This project lives inside a wider repository, so Turbopack's automatic
  // root inference walks too far up and picks the wrong lockfile.
  turbopack: {
    root: path.resolve(__dirname),
  },

  /*
   * Next's dev-tools badge renders a circled "N" in the bottom-left corner of
   * every page in development. Harmless on a normal app, but this one gets
   * projected in front of a room — and a facilitator rehearsing on `npm run
   * dev` sees a stray letter sitting on the join screen. It never shipped in a
   * production build; turning it off means it never shows in either.
   */
  devIndicators: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
