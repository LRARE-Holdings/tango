import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  [
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "https://js.stripe.com",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://challenges.cloudflare.com",
    "https://cdn.snitcher.com",
  ].join(" "),
  [
    "connect-src 'self'",
    "https://*.supabase.co",
    "https://api.stripe.com",
    "https://m.stripe.network",
    "https://r.stripe.com",
    "https://api.resend.com",
    "https://www.google-analytics.com",
    "https://region1.google-analytics.com",
    "https://radar.snitcher.com",
    "https://*.ingest.sentry.io",
    "https://challenges.cloudflare.com",
  ].join(" "),
  "frame-src 'self' https://challenges.cloudflare.com https://www.googletagmanager.com https://js.stripe.com https://hooks.stripe.com",
  "worker-src 'self' blob:",
];

if (process.env.NODE_ENV === "production") {
  cspDirectives.push("upgrade-insecure-requests");
}

const contentSecurityPolicy = cspDirectives
  .join("; ")
  .replace(/\s{2,}/g, " ")
  .trim();

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/((?!api/).*)",
        has: [
          {
            type: "host",
            value: "getreceipt.co",
          },
        ],
        destination: "https://www.getreceipt.co/:path*",
        permanent: true,
      },
      {
        source: "/((?!api/).*)",
        has: [
          {
            type: "host",
            value: "getreceipt.xyz",
          },
        ],
        destination: "https://www.getreceipt.co/:path*",
        permanent: true,
      },
      {
        source: "/((?!api/).*)",
        has: [
          {
            type: "host",
            value: "www.getreceipt.xyz",
          },
        ],
        destination: "https://www.getreceipt.co/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "lrare",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
