import type { NextConfig } from "next";
import webpack from "webpack";

const nextConfig: NextConfig = {
  transpilePackages: ["@coinbase/onchainkit"],
  webpack: (config, { isServer }) => {
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
