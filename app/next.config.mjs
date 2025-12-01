/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // This tells Vercel to IGNORE all linting errors (unused vars, etc.)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // This tells Vercel to IGNORE all type errors (any, missing props, etc.)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;