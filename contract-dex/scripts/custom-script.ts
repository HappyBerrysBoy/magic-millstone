// 🌉 브릿지 전용 입출금 시나리오 테스트를 시작합니다...

// 📋 사용할 주소들:
//   Steakhouse USDT Vault: 0xbEef047a543E45807105E51A8BBEFCc5950fcfBa
//   AAVE Pool V3: 0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2
//   USDT: 0xdAC17F958D2ee523a2206206994597C13D831ec7

// 👤 계정 설정:
//   배포자: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
//   Fee 수취인: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
//   🌉 Polygon Bridge: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
//   🌉 Arbitrum Bridge: 0x90F79bf6EB2c4f870365E785982E1f101E93b906
//   🌉 Base Bridge: 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
import { ethers } from 'hardhat';

async function main() {
  // 주소 정의
  const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  const STEAKHOUSE_VAULT = '0xbEef047a543E45807105E51A8BBEFCc5950fcfBa';
  const AAVE_POOL_V3 = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2';

  // 계정 정보
  const [deployer, feeRecipient, polygonBridge, arbitrumBridge, baseBridge] =
    await ethers.getSigners();

  // USDT 컨트랙트 인스턴스
  const usdt = await ethers.getContractAt('IERC20', USDT_ADDRESS);

  // Steakhouse Vault (ERC4626) 인스턴스
  const steakhouseVault = await ethers.getContractAt('IERC4626', STEAKHOUSE_VAULT);

  // AAVE Pool 인스턴스
  const aavePool = await ethers.getContractAt('IAavePool', AAVE_POOL_V3);

  // === USDT 정보 조회 ===
  try {
    const deployerUsdtBalance = await usdt.balanceOf(deployer.address);

    console.log('=== USDT 정보 ===');
    console.log(`주소: ${USDT_ADDRESS}`);
    console.log(`소수점: 6 (USDT 고정)`);
    console.log(`배포자 USDT 잔액: ${ethers.formatUnits(deployerUsdtBalance, 6)} USDT`);
  } catch (error) {
    console.log('⚠️  USDT 정보 조회 중 에러:', error.message);
  }

  // === Steakhouse Vault 정보 조회 ===
  const vaultAsset = await steakhouseVault.asset();
  const vaultTotalAssets = await steakhouseVault.totalAssets();
  const vaultTotalSupply = await steakhouseVault.totalSupply();

  console.log('\n=== Steakhouse USDT Vault 정보 ===');
  console.log(`기본 자산: ${vaultAsset}`);
  console.log(`총 자산: ${ethers.formatUnits(vaultTotalAssets, 6)} USDT`);
  console.log(`총 발행된 share: ${ethers.formatUnits(vaultTotalSupply, 18)}`);

  // 배포자 Vault share 잔액
  const deployerShares = await steakhouseVault.balanceOf(deployer.address);
  console.log(`배포자 Vault share 잔액: ${ethers.formatUnits(deployerShares, 18)}`);

  // === AAVE Pool 정보 조회 ===
  // USDT에 대한 리저브 데이터
  const reserveData = await aavePool.getReserveData(USDT_ADDRESS);
  const aTokenAddress = reserveData[8];
  console.log('\n=== AAVE Pool USDT 리저브 정보 ===');
  console.log(`aUSDT 주소: ${aTokenAddress}`);

  // aUSDT 잔액 조회
  const aToken = await ethers.getContractAt('IERC20', aTokenAddress);
  const deployerATokenBalance = await aToken.balanceOf(deployer.address);
  console.log(`배포자 aUSDT 잔액: ${ethers.formatUnits(deployerATokenBalance, 6)} aUSDT`);

  // AAVE Pool에서 배포자 계정 데이터 조회
  const [
    totalCollateralBase,
    totalDebtBase,
    availableBorrowsBase,
    currentLiquidationThreshold,
    ltv,
    healthFactor,
  ] = await aavePool.getUserAccountData(deployer.address);

  console.log('\n=== AAVE Pool 배포자 계정 데이터 ===');
  console.log(`총 담보: ${ethers.formatUnits(totalCollateralBase, 8)} (기본 단위)`);
  console.log(`총 부채: ${ethers.formatUnits(totalDebtBase, 8)} (기본 단위)`);
  console.log(
    `대출 가능 금액: ${ethers.formatUnits(availableBorrowsBase, 8)} (기본 단위)`,
  );
  console.log(`청산 임계값: ${currentLiquidationThreshold}`);
  console.log(`LTV: ${ltv}`);
  console.log(`Health Factor: ${ethers.formatUnits(healthFactor, 18)}`);

  // === 브릿지 계정별 USDT 잔액 조회 ===
  const polygonBridgeUsdt = await usdt.balanceOf(polygonBridge.address);
  const arbitrumBridgeUsdt = await usdt.balanceOf(arbitrumBridge.address);
  const baseBridgeUsdt = await usdt.balanceOf(baseBridge.address);

  console.log('\n=== 브릿지 계정별 USDT 잔액 ===');
  console.log(`Polygon Bridge: ${ethers.formatUnits(polygonBridgeUsdt, 6)} USDT`);
  console.log(`Arbitrum Bridge: ${ethers.formatUnits(arbitrumBridgeUsdt, 6)} USDT`);
  console.log(`Base Bridge: ${ethers.formatUnits(baseBridgeUsdt, 6)} USDT`);

  // === MillstoneAIVault 교환비 조회 ===
  console.log('\n=== MillstoneAIVault 교환비 정보 조회 ===');

  // 먼저 배포된 vault가 있는지 확인해보겠습니다
  // 일반적으로 vault 주소를 하드코딩하거나 환경변수에서 가져와야 합니다
  const VAULT_ADDRESS = '0x0474511540f5dE71f4e14027A765f35cF07949d8'; // .env에서 가져오기

  if (VAULT_ADDRESS) {
    try {
      const vault = await ethers.getContractAt('MillstoneAIVault', VAULT_ADDRESS);

      // StakedUSDT 전체 정보 조회
      const [
        currentExchangeRate,
        totalSupply,
        totalCurrentValue,
        underlyingDepositedAmount,
        accumulatedFeeAmount,
      ] = await vault.getStakedTokenInfo(USDT_ADDRESS);

      console.log(`📊 StakedUSDT Pool 정보:`);
      console.log(
        `  💱 교환비: 1 stakedUSDT = ${ethers.formatUnits(currentExchangeRate, 6)} USDT`,
      );
      console.log(`  🪙 총 발행량: ${ethers.formatUnits(totalSupply, 6)} stakedUSDT`);
      console.log(`  💰 Pool 총 가치: ${ethers.formatUnits(totalCurrentValue, 6)} USDT`);
      console.log(
        `  🏦 총 입금액: ${ethers.formatUnits(underlyingDepositedAmount, 6)} USDT`,
      );
      console.log(`  💸 누적 Fee: ${ethers.formatUnits(accumulatedFeeAmount, 6)} USDT`);

      // 프로토콜별 잔액도 조회
      const [aaveBalance, morphoBalance, totalProtocolBalance] =
        await vault.getProtocolBalances(USDT_ADDRESS);

      console.log(`\n🏦 프로토콜 분산 투자 현황:`);
      console.log(`  💼 AAVE: ${ethers.formatUnits(aaveBalance, 6)} USDT`);
      console.log(`  🥩 Morpho: ${ethers.formatUnits(morphoBalance, 6)} USDT`);
      console.log(`  💰 총 투자액: ${ethers.formatUnits(totalProtocolBalance, 6)} USDT`);

      if (totalProtocolBalance > 0) {
        const aavePerc = (aaveBalance * 10000n) / totalProtocolBalance;
        const morphoPerc = (morphoBalance * 10000n) / totalProtocolBalance;
        console.log(
          `  📊 분배 비율: AAVE ${Number(aavePerc) / 100}%, Morpho ${
            Number(morphoPerc) / 100
          }%`,
        );
      }
    } catch (error) {
      console.log('⚠️  MillstoneAIVault 조회 중 에러:', error.message);
      console.log(
        '💡 Vault가 배포되지 않았을 수 있습니다. deploy 스크립트를 먼저 실행하세요.',
      );
    }
  } else {
    console.log('⚠️  VAULT_ADDRESS가 .env에 설정되지 않았습니다.');
    console.log('💡 .env 파일에 VAULT_ADDRESS=0x... 를 추가하거나');
    console.log('💡 deploy 스크립트를 먼저 실행하여 vault를 배포하세요.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
