const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      // /install was merged into /notifications
      { source: '/install', destination: '/notifications', permanent: false },
      // /profile is an alias for the existing My Page
      { source: '/profile', destination: '/mypage', permanent: false },
      // /settings — common URL guess; route it to the notifications/install page
      // (which is the actual settings hub for now). Users can also click "Profile" in the menu.
      { source: '/settings', destination: '/notifications', permanent: false },
      { source: '/account', destination: '/mypage', permanent: false },
    ];
  },
  transpilePackages: ["@rainbow-me/rainbowkit"],
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../../"),
    serverComponentsExternalPackages: ["@prisma/client", "ioredis", "bullmq"],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: false,
        encoding: false,
        pino: false,
        "pino-pretty": false,
      };

      // Suppress WalletConnect pino warnings
      config.externals = config.externals || [];
      config.externals.push("pino-pretty", "encoding");
    }
    return config;
  },
};

module.exports = nextConfig;
