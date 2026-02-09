import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/((?!api/).*)",
        has: [
          {
            type: "host",
            value: "getreceipt.xyz",
          },
        ],
        destination: "https://www.getreceipt.xyz/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;