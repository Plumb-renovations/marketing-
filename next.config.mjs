/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions body size — photo uploads (base64) can be large.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
