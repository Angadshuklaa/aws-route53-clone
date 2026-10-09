import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";

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
        { source: "/route53", destination: "/route53/v2/dashboard", permanent: false },
        { source: "/route53/v2", destination: "/route53/v2/dashboard", permanent: false },
      ];
    },
    async rewrites() {
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
