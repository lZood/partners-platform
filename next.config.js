/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // For CSV uploads
    },
  },
};

module.exports = nextConfig;
