/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained production server bundle (only the deps actually used at
  // runtime) — keeps the Docker image small and avoids copying node_modules.
  // See https://nextjs.org/docs/pages/api-reference/next-config-js/output
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "cheerio", "unpdf"],
  eslint: {
    // Linting is run separately via `npm run lint`; don't block production builds on it.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
