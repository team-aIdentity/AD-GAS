import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  /* 상위 src(../../../src) 번들 시 모듈을 frontend/node_modules에서 해석 */
  webpack: (config) => {
    config.resolve.modules = [
      path.resolve(__dirname, "node_modules"),
      path.resolve(__dirname, "../node_modules"),
      "node_modules",
    ];
    return config;
  },
};

export default nextConfig;
