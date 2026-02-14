import { ethers } from "hardhat";

// EIP-4337 EntryPoint v0.6 주소 (체인별 동일)
const ENTRY_POINT_V060 = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AdSponsorPaymaster with account:", deployer.address);

  const AdSponsorPaymaster = await ethers.getContractFactory("AdSponsorPaymaster");
  const paymaster = await AdSponsorPaymaster.deploy(ENTRY_POINT_V060);
  await paymaster.waitForDeployment();
  const address = await paymaster.getAddress();
  console.log("AdSponsorPaymaster deployed to:", address);

  console.log("\nNext steps:");
  console.log("1. Fund the paymaster: send ETH to", address);
  console.log("2. Or call paymaster.deposit() with ETH (from owner) to deposit to EntryPoint");
  console.log("3. Set policies: setMaxCostPerUserOp(), setDailyGasLimit(), setWhitelist()");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
