/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
  async rewrites() {
    return [
      { source: "/siparis/:phone/:name", destination: "/siparis?p=:phone&ad=:name" },
      { source: "/siparis/:phone", destination: "/siparis?p=:phone" },
    ];
  },
};

export default nextConfig;
