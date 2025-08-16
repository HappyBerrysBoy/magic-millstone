import { ethers } from 'hardhat';

const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const MAINNET_AAVE_POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
const USDT_WHALE = '0xF977814e90dA44bFA03b6295A0616a897441aceC'; // Binance Hot

async function main() {
  console.log('🚀 메인넷 Fork에 MillstoneAIVault(USDT만) 배포를 시작합니다...\n');

  // 네트워크 확인
  const network = await ethers.provider.getNetwork();
  console.log('📡 네트워크:', network.name, `(Chain ID: ${network.chainId})`);

  if (network.chainId !== 1337n) {
    throw new Error(
      '❌ Fork된 하드햇 네트워크가 아닙니다. --network hardhat 옵션을 사용하세요.',
    );
  }

  const blockNumber = await ethers.provider.getBlockNumber();
  console.log('📦 현재 블록 번호:', blockNumber);

  // 계정 가져오기
  const [deployer] = await ethers.getSigners();
  console.log('👤 배포자 계정:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('💰 배포자 ETH 잔액:', ethers.formatEther(balance), 'ETH\n');

  try {
    // === 1. Mock 토큰 배포 및 관련 코드 제거 ===
    // 실제 메인넷 토큰만 사용하므로 Mock 토큰 배포 및 충전, 설정 코드 모두 제거

    console.log('\n=== 1. MillstoneAIVault 구현체 배포 ===');

    const MillstoneAIVaultFactory = await ethers.getContractFactory('MillstoneAIVault');
    const implementation = await MillstoneAIVaultFactory.deploy();
    await implementation.waitForDeployment();
    const implementationAddress = await implementation.getAddress();
    console.log('✅ MillstoneAIVault 구현체 배포 완료:', implementationAddress);

    console.log('\n=== 2. EIP1967 프록시 배포 ===');

    // 초기화 데이터 준비
    const initData = implementation.interface.encodeFunctionData('initialize', [
      deployer.address,
    ]);

    const EIP1967ProxyFactory = await ethers.getContractFactory('EIP1967Proxy');
    const proxy = await EIP1967ProxyFactory.deploy(implementationAddress, initData);
    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();
    console.log('✅ EIP1967 프록시 배포 완료:', proxyAddress);

    // 프록시를 통해 컨트랙트 인스턴스 생성
    const vault = await ethers.getContractAt('MillstoneAIVault', proxyAddress);

    console.log('\n=== 3. Vault 기본 설정 ===');

    // 실제 메인넷 AAVE V3 Pool 설정
    console.log('🔧 AAVE Pool 설정 중...');
    const setPoolTx = await vault.setAavePool(MAINNET_AAVE_POOL);
    await setPoolTx.wait();
    console.log('✅ AAVE Pool 설정 완료:', MAINNET_AAVE_POOL);

    // AAVE 모드 활성화
    console.log('🔄 AAVE 모드 활성화 중...');
    const toggleTx = await vault.toggleAaveMode(true);
    await toggleTx.wait();
    console.log('✅ AAVE 모드 활성화 완료');

    // 브릿지 권한 설정
    console.log('🌉 브릿지 권한 설정 중...');
    const authTx = await vault.setBridgeAuthorization(deployer.address, true);
    await authTx.wait();
    console.log('✅ 브릿지 권한 설정 완료');

    console.log('\n=== 4. USDT 지원 및 aToken 매핑 설정 ===');

    // USDT만 지원
    const MAINNET_TOKENS = {
      USDT,
    };

    const aavePool = await ethers.getContractAt('IAavePool', MAINNET_AAVE_POOL);

    // USDT만 설정
    const tokenName = 'USDT';
    const tokenAddress = USDT;
    console.log(`\n🔧 ${tokenName} 설정 중...`);

    try {
      // 토큰 지원 설정
      const supportTx = await vault.setSupportedToken(tokenAddress, true);
      await supportTx.wait();
      console.log(`✅ ${tokenName} 지원 설정 완료`);

      // aToken 주소 조회 및 매핑
      const reserveData = await aavePool.getReserveData(tokenAddress);
      const aTokenAddress = reserveData[8];

      if (aTokenAddress !== ethers.ZeroAddress) {
        const setMappingTx = await vault.setATokenMapping(tokenAddress, aTokenAddress);
        await setMappingTx.wait();
        console.log(`✅ ${tokenName} aToken 매핑 완료:`, aTokenAddress);
      } else {
        console.log(`⚠️  ${tokenName}이 AAVE에서 지원되지 않음`);
      }
    } catch (error) {
      console.log(`❌ ${tokenName} 설정 실패:`, (error as Error).message);
    }

    // 실제 메인넷 USDT 얻기 (Whale에서 가져오기)
    console.log('\n🐋 실제 메인넷 USDT 얻기...');

    // USDT Whale
    await ethers.provider.send('hardhat_impersonateAccount', [USDT_WHALE]);
    const usdtWhale = await ethers.getSigner(USDT_WHALE);

    // Whale에게 ETH 충전
    await deployer.sendTransaction({
      to: USDT_WHALE,
      value: ethers.parseEther('10'),
    });

    // 실제 USDT 토큰 가져오기
    const realUsdt = await ethers.getContractAt('IERC20', USDT);
    const usdtAmount = ethers.parseUnits('1000', 6);

    try {
      // 타입 문제로 인해 transfer 함수 타입 단언
      await (realUsdt.connect(usdtWhale) as any).transfer(deployer.address, usdtAmount);
      console.log('✅ 실제 USDT 1000개 획득');
    } catch (error) {
      console.log('⚠️  실제 USDT 획득 실패, Whale 잔액 부족 또는 권한 문제');
    }

    console.log('\n🎉 ================= 배포 완료 =================');
    console.log('✅ 메인넷 Fork에 MillstoneAIVault(USDT만) 배포 성공!');
    console.log('');
    console.log('📍 배포된 주소들:');
    console.log('  - MillstoneAIVault (프록시):', proxyAddress);
    console.log('  - 구현체:', implementationAddress);
    console.log('');
    console.log('🌐 실제 메인넷 토큰 주소:');
    console.log(`  - USDT: ${USDT}`);
    console.log('');
    console.log('🏦 AAVE Pool:', MAINNET_AAVE_POOL);
    console.log('');
    console.log('🧪 다음 명령어로 테스트하세요:');
    console.log('yarn hardhat run scripts/test-vault-mainnet-fork.ts --network hardhat');
    console.log('================================================');

    // 환경 설정 파일 생성
    const deploymentInfo = {
      network: 'mainnet-fork',
      chainId: network.chainId.toString(),
      vault: proxyAddress,
      implementation: implementationAddress,
      aavePool: MAINNET_AAVE_POOL,
      realTokens: MAINNET_TOKENS,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
    };

    console.log('\n📝 배포 정보를 deployment-mainnet-fork.json에 저장 중...');
    require('fs').writeFileSync(
      'deployment-mainnet-fork.json',
      JSON.stringify(deploymentInfo, null, 2),
    );
    console.log('✅ 배포 정보 저장 완료');
  } catch (error) {
    console.error('❌ 배포 실패:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ 오류:', error);
    process.exit(1);
  });
