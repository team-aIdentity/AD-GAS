import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  /* 상위 src(../../../src) 번들 시 모듈을 frontend/node_modules에서 해석 */
  webpack: (config, { isServer }) => {
    // 모듈 해석 경로 설정 (frontend/node_modules 우선, 그 다음 상위 node_modules)
    config.resolve.modules = [
      path.resolve(__dirname, "node_modules"),
      path.resolve(__dirname, "../node_modules"),
      "node_modules",
    ];
    
    // 상위 src 디렉토리의 TypeScript 파일도 트랜스파일
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
      };
    }
    
    return config;
  },
};

export default nextConfig;
