/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // For CSV uploads
    },
  },
};

module.exports = nextConfig;
