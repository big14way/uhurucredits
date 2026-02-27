import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://worldapp.world.org https://staging.world.org",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
