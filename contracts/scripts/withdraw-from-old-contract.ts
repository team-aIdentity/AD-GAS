import { ethers } from 'hardhat';

/**
 * 기존 컨트랙트에서 자금을 출금하는 스크립트
 *
 * 사용법:
 * 1. OLD_CONTRACT_ADDRESS 환경 변수에 기존 컨트랙트 주소 설정
 * 2. npm run withdraw:old:avalanche 실행
 */
async function main() {
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error('No signers found. Please check .env file');
  }
  const deployer = signers[0];

  const oldContractAddress = process.env.OLD_CONTRACT_ADDRESS;
  if (!oldContractAddress) {
    throw new Error('OLD_CONTRACT_ADDRESS 환경 변수를 설정해주세요.');
  }

  console.log('기존 컨트랙트 주소:', oldContractAddress);
  console.log('관리자 주소:', deployer.address);

  // 기존 컨트랙트 ABI (이전 버전과 새 버전 모두 지원)
  const OLD_CONTRACT_ABI = [
    {
      inputs: [{ name: 'amount', type: 'uint256' }],
      name: 'withdrawNative',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [],
      name: 'getNativeDepositPool',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
    // 이전 버전용 (사용자별 예치)
    {
      inputs: [{ name: 'user', type: 'address' }],
      name: 'getNativeDeposit',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'depositNative',
      outputs: [],
      stateMutability: 'payable',
      type: 'function',
    },
  ];

  const oldContract = new ethers.Contract(oldContractAddress, OLD_CONTRACT_ABI, deployer);

  // 컨트랙트 잔액 확인
  const contractBalance = await ethers.provider.getBalance(oldContractAddress);
  console.log('\n컨트랙트 실제 잔액:', ethers.formatEther(contractBalance), 'AVAX');

  // 풀 잔액 확인 (새 버전)
  let poolBalance = 0n;
  try {
    poolBalance = await oldContract.getNativeDepositPool();
    console.log('공유 풀 잔액:', ethers.formatEther(poolBalance), 'AVAX');
  } catch (err: any) {
    console.log('⚠️ getNativeDepositPool 함수가 없습니다 (이전 버전일 수 있음)');
    // 이전 버전인 경우, 관리자 주소의 예치 잔액 확인
    try {
      poolBalance = await oldContract.getNativeDeposit(deployer.address);
      console.log('관리자 예치 잔액:', ethers.formatEther(poolBalance), 'AVAX');
    } catch (err2: any) {
      console.log('⚠️ getNativeDeposit 함수도 없습니다. 컨트랙트 잔액을 사용합니다.');
      poolBalance = contractBalance;
    }
  }

  if (poolBalance === 0n && contractBalance === 0n) {
    console.log('출금할 잔액이 없습니다.');
    return;
  }

  // 출금할 금액 결정 (풀 잔액 또는 컨트랙트 잔액 중 작은 값)
  const withdrawAmount = poolBalance > 0n ? poolBalance : contractBalance;
  console.log('\n출금할 금액:', ethers.formatEther(withdrawAmount), 'AVAX');

  // 전체 잔액 출금
  console.log('\n전체 잔액을 출금합니다...');
  const tx = await oldContract.withdrawNative(withdrawAmount);
  console.log('트랜잭션 해시:', tx.hash);

  await tx.wait();
  console.log('\n✅ 출금 완료!');
  console.log('출금된 금액:', ethers.formatEther(poolBalance), 'AVAX');
  console.log('\n다음 단계:');
  console.log('1. 새 컨트랙트를 배포하세요');
  console.log('2. 관리자 페이지에서 출금한 자금을 새 컨트랙트에 예치하세요');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
