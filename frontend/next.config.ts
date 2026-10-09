import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";

/**
 * The browser calls the API on the frontend's own origin (`/api/...`) and
 * Next.js proxies those requests to FastAPI. Keeping the session cookie
 * first-party means it works in browsers that block third-party cookies.
 *
 * API_PROXY_TARGET is the public FastAPI base URL. It is required for
 * production builds so a deployment can never fall back to localhost.
 * Alternatively, set NEXT_PUBLIC_API_BASE_URL to call the API cross-origin.
 */
export default function nextConfig(phase: string): NextConfig {
  const apiProxyTarget = (
    process.env.API_PROXY_TARGET ?? (phase === PHASE_DEVELOPMENT_SERVER ? "http://127.0.0.1:8000" : "")
  ).replace(/\/+$/, "");

  return {
    reactStrictMode: true,
    agentRules: false,
    poweredByHeader: false,
    async redirects() {
      return [
        { source: "/", destination: "/route53/v2/hostedzones", permanent: false },
        { source: "/route53", destination: "/route53/v2/dashboard", permanent: false },
        { source: "/route53/v2", destination: "/route53/v2/dashboard", permanent: false },
      ];
    },
    async rewrites() {
      // `next typegen` runs in the build phase too, so only enforce this for `next build`.
      const isBuild = phase === PHASE_PRODUCTION_BUILD && process.argv.includes("build");
      if (isBuild && !apiProxyTarget && !process.env.NEXT_PUBLIC_API_BASE_URL) {
        throw new Error("Set API_PROXY_TARGET (or NEXT_PUBLIC_API_BASE_URL) to the deployed FastAPI URL before building.");
      }
      if (!apiProxyTarget) return [];
      return [{ source: "/api/:path*", destination: `${apiProxyTarget}/api/:path*` }];
    },
    async headers() {
      return [
        {
          source: "/:path*",
          headers: [
            // A demo console clone should never show up in search results.
            { key: "X-Robots-Tag", value: "noindex, nofollow" },
            { key: "X-Frame-Options", value: "DENY" },
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ],
        },
      ];
    },
  };
}
