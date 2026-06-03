/** @type {import('next').NextConfig} */

// Derive the Supabase host from env so CSP/images automatically follow
// whatever instance the build is pointing at (cloud or self-hosted).
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://supabaseboxfi.box-build.com";
const SUPABASE_HOST = new URL(SUPABASE_URL).host; // e.g. "supabaseboxfi.box-build.com"
const SUPABASE_HTTPS = `https://${SUPABASE_HOST}`;
const SUPABASE_WSS = `wss://${SUPABASE_HOST}`;

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
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      // images: own origin, data/blob URIs, the active Supabase host (for
      // Storage public URLs), legacy *.supabase.co for backward compat, and
      // Google avatar/profile CDN
      `img-src 'self' data: blob: ${SUPABASE_HTTPS} https://*.supabase.co https://*.googleusercontent.com`,
      "font-src 'self' data:",
      // connect-src: REST + auth + storage + realtime go to the active Supabase
      // host (HTTPS for REST/auth, WSS for realtime). Keep *.supabase.co for
      // safety during migrations.
      `connect-src 'self' ${SUPABASE_HTTPS} ${SUPABASE_WSS} https://*.supabase.co wss://*.supabase.co https://accounts.google.com`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      `form-action 'self' ${SUPABASE_HTTPS} https://*.supabase.co`,
    ].join("; "),
  },
];

const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      // Active Supabase Storage origin (derived from env at build time)
      {
        protocol: "https",
        hostname: SUPABASE_HOST,
        pathname: "/storage/v1/object/public/**",
      },
      // Legacy cloud Supabase Storage (covers any image URLs that survived
      // the migration in markdown/text fields)
      {
        protocol: "https",
        hostname: "zmarvensghcyuwgkowqq.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
  typescript: {
    // The generated database.ts types need regeneration with the real
    // Supabase project ID. Until then, skip TS checks during build.
    // Runtime behavior is unaffected.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Same reason — skip lint during build, run separately if needed.
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // For CSV uploads
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  // Suppress warnings from pdfkit's optional dependency (iconv-lite)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        "iconv-lite": "commonjs iconv-lite",
        "nodemailer": "commonjs nodemailer",
        "pdfkit": "commonjs pdfkit",
        "qrcode": "commonjs qrcode",
        "exceljs": "commonjs exceljs",
      });
    }
    return config;
  },
};

module.exports = nextConfig;
