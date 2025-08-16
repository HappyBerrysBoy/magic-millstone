import { ethers } from 'hardhat';

// 여기에 실제 배포 로그에서 나온 주소들을 입력하세요
const TOKEN_ADDRESSES = {
  wbtc: '0x29f2D40B0605204364af54EC677bD022dA425d03',
  link: '0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5',
  dai: '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357',
  usdt: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', // 실제 USDT 주소
  usdc: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8', // 실제 USDC 주소
};

const LENDING_ADDRESS = '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951';

const DEPLOYED_ADDRESSES = {
  vault: '0x3fc7E69DeE13193a3F0172c12449F3eA34f588DF', // 실제 Vault 프록시 주소로 변경
  implementation: '0xcb7A855a0cDC0a40Fd0Da65964DeA811B043b3C8', // 실제 구현체 주소
};

async function main() {
  console.log('🚀 Sepolia 테스트넷...\n');

  // 네트워크 확인
  const network = await ethers.provider.getNetwork();
  console.log('📡 배포 네트워크:', network.name, `(Chain ID: ${network.chainId})`);

  if (network.chainId !== 11155111n) {
    throw new Error(
      '❌ Sepolia 네트워크가 아닙니다. --network sepolia 옵션을 사용하세요.',
    );
  }

  // 배포자 계정 가져오기
  const [deployer] = await ethers.getSigners();
  console.log('👤 배포자 주소:', deployer.address);

  // 잔액 확인
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('💰 배포자 잔액:', ethers.formatEther(balance), 'ETH');

  if (balance < ethers.parseEther('0.01')) {
    console.log(
      '⚠️  경고: ETH 잔액이 부족할 수 있습니다. 최소 0.01 ETH 이상 필요합니다.',
    );
  }

  console.log('vault contract 인스턴스 생성');
  const MillstoneAIVault = await ethers.getContractFactory('MillstoneAIVault');

  const vault = MillstoneAIVault.attach(DEPLOYED_ADDRESSES.vault);
  // console.log('🪙 토큰 지원 설정 중...');
  // const setUsdtTx = await vault.setSupportedToken(TOKEN_ADDRESSES.wbtc, true);
  // await setUsdtTx.wait();

  // add lending protocol
  // const addWBTCProtocolTx = await vault.addLendingProtocol(
  //   TOKEN_ADDRESSES.wbtc,
  //   LENDING_ADDRESS,
  // );
  // await addWBTCProtocolTx.wait();
  // const addLinkProtocolTx = await vault.addLendingProtocol(
  //   TOKEN_ADDRESSES.link,
  //   LENDING_ADDRESS,
  // );
  // await addLinkProtocolTx.wait();
  // const addDaiProtocolTx = await vault.addLendingProtocol(
  //   TOKEN_ADDRESSES.dai,
  //   LENDING_ADDRESS,
  // );
  // await addDaiProtocolTx.wait();

  console.log('✅ 렌딩 프로토콜 설정 완료');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ 배포 중 오류 발생:');
    console.error(error);
    process.exit(1);
  });
