import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@coinbase/onchainkit"],
  // Next.js가 넘겨 주는 webpack 인스턴스 사용 (별도 `webpack` 패키지 import 불필요 · 타입 검사 통과)
  webpack: (config, { isServer, webpack }) => {
    // 브라우저 번들: MetaMask SDK / WalletConnect가 RN·pino 개발용 모듈을 참조해 경고·실패가 날 수 있음
    if (!isServer) {
      config.plugins.push(
        new webpack.IgnorePlugin({ resourceRegExp: /^@react-native-async-storage\/async-storage$/ }),
        new webpack.IgnorePlugin({ resourceRegExp: /^pino-pretty$/ }),
      );
    }
    return config;
  },
};

export default nextConfig;
