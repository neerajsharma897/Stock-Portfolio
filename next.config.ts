import type { NextConfig } from "next"

// Basic hardening for a private app holding financial data.
const securityHeaders = [
  // Don't allow the app to be embedded in other sites (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // HTTPS only once deployed (browsers ignore this on http://localhost).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
]

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      // Restoring a backup uploads the file through a Server Action (default limit 1 MB).
      // Matches Vercel's 4.5 MB request limit; backups over 4 MB are rejected with a message.
      bodySizeLimit: "4.5mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
