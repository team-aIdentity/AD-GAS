import { ethers } from 'hardhat';

async function main() {
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error(
        'No signers found. Please check:\n' +
        '1. `PRIVATE_KEY` in `contracts/.env`, `contracts/.env.local`, or `web/frontend/.env.local`\n' +
        '2. For GIWA deploy: `ADWALLET_SPONSOR_PK_GIWA_SEPOLIA` in frontend `.env.local` is OK\n' +
        '3. Key format: 0x... or 64-char hex'
    );
  }
  const deployer = signers[0];
  console.log('Deploying AdWalletSponsoredTransfer with account:', deployer.address);
  console.log(
    'Account balance:',
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    'ETH'
  );

  // 관리자 주소 설정 (환경 변수 또는 배포자 주소)
  const adminAddress = process.env.ADMIN_ADDRESS || deployer.address;
  console.log('Admin address:', adminAddress);

  const AdWalletSponsoredTransfer = await ethers.getContractFactory('AdWalletSponsoredTransfer');
  const contract = await AdWalletSponsoredTransfer.deploy(adminAddress);
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log('\n✅ AdWalletSponsoredTransfer deployed to:', address);
  console.log('\n📋 Next steps:');
  console.log(
    `1. Add to .env.local: NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_${
      process.env.NETWORK_NAME || 'AVALANCHE'
    }=${address}`
  );
  console.log('2. Verify contract on block explorer (if needed)');
  console.log('3. Test the contract with a sample transaction');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
