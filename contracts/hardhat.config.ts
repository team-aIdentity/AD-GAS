import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

// 배포 스크립트 실행 시 cwd는 보통 web/contracts/
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const frontendEnvLocal = path.resolve(process.cwd(), "../frontend/.env.local");
if (fs.existsSync(frontendEnvLocal)) {
  // 이미 설정된 변수는 덮어쓰지 않음 — contracts/.env 가 우선
  dotenv.config({ path: frontendEnvLocal });
}

/** 배포 스크립트용 PRIVATE_KEY (.env 이름만 다른 경우 보조) */
function normalizePrivateKey(raw: string): string {
  const t = raw.trim();
  return t.startsWith("0x") ? t : `0x${t}`;
}

if (!process.env.PRIVATE_KEY?.trim()) {
  const net = process.env.NETWORK_NAME;
  const sponsorByNetwork: Record<string, string | undefined> = {
    BASE: process.env.ADWALLET_SPONSOR_PK_BASE,
    BNB: process.env.ADWALLET_SPONSOR_PK_BNB,
    GIWA_SEPOLIA: process.env.ADWALLET_SPONSOR_PK_GIWA_SEPOLIA,
    AVALANCHE: process.env.ADWALLET_SPONSOR_PK_AVALANCHE,
  };
  const sponsor = net ? sponsorByNetwork[net]?.trim() : undefined;
  if (sponsor) {
    process.env.PRIVATE_KEY = normalizePrivateKey(sponsor);
  }
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true, // Stack too deep 해결 (executeSponsoredTransferWithPermit)
    },
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    polygonAmoy: {
      url: process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    avalanche: {
      url: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 43114,
    },
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8453,
    },
    bsc: {
      url: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 56,
    },
    // GIWA 테스트넷 — https://docs.giwa.io/get-started/connect-to-giwa.md
    giwaSepolia: {
      url: process.env.GIWA_SEPOLIA_RPC_URL || "https://sepolia-rpc.giwa.io",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 91342,
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
    },
  },
};

export default config;
