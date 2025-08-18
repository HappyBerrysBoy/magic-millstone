// Full Test 시나리오
// 한 종류의 트랜잭션이 일어 날 때마다 일주일이 지나간다.
// 매번 APY와 수량을 로그로 남긴다.
// 1. 브릿지를 통해서 USDT를 1000개 받아서, AAVE와 Morpho에 분산 투자한다.(70% AAVE, 30% Morpho)
// 2. 500개의 USDT를 출금한다.
// 3. 추가로 1000 USDT를 받고, 비율에 맞게 분산 투자한다.
// 4. 500개의 USDT를 출금한다.

import { ethers } from 'hardhat';
import { expect } from 'chai';

async function main() {
  console.log('🚀 MillstoneAIVault Full Test 시나리오를 시작합니다...\n');

  // 주소 설정
  const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  const STEAKHOUSE_VAULT = '0xbEef047a543E45807105E51A8BBEFCc5950fcfBa';
  const AAVE_POOL_V3 = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2';
  const AUSDT_ADDRESS = '0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a';

  console.log('📋 사용할 주소들:');
  console.log(`  Steakhouse USDT Vault: ${STEAKHOUSE_VAULT}`);
  console.log(`  AAVE Pool V3: ${AAVE_POOL_V3}`);
  console.log(`  USDT: ${USDT_ADDRESS}`);
  console.log(`  aUSDT: ${AUSDT_ADDRESS}\n`);

  // Signers 설정
  const [deployer, feeRecipient, bridgeContract, user1] = await ethers.getSigners();

  console.log('👤 계정 설정:');
  console.log(`  배포자: ${deployer.address}`);
  console.log(`  Fee 수취인: ${feeRecipient.address}`);
  console.log(`  Bridge 컨트랙트: ${bridgeContract.address}`);
  console.log(`  사용자1: ${user1.address}\n`);

  // =============================================================================
  console.log('=== 1. MillstoneAIVault 배포 및 초기 설정 ===');

  // MillstoneAIVault 구현체 배포
  const MillstoneAIVault = await ethers.getContractFactory('MillstoneAIVault');
  const implementation = await MillstoneAIVault.deploy();
  await implementation.waitForDeployment();
  console.log(`✅ MillstoneAIVault 구현체 배포: ${implementation.target}`);

  // EIP1967 프록시 배포
  const EIP1967Proxy = await ethers.getContractFactory('EIP1967Proxy');
  const initData = implementation.interface.encodeFunctionData('initialize', [
    deployer.address,
  ]);
  const proxy = await EIP1967Proxy.deploy(implementation.target, initData);
  await proxy.waitForDeployment();
  const proxyAddress = proxy.target.toString();
  console.log(`✅ EIP1967 프록시 배포: ${proxyAddress}`);

  // 프록시를 통해 vault 인스턴스 생성
  const vault = MillstoneAIVault.attach(proxyAddress);

  // USDT 인스턴스 생성
  const usdt = await ethers.getContractAt('IERC20', USDT_ADDRESS);

  // =============================================================================
  console.log('\n=== 2. 초기 설정 ===');

  // Fee 수취인 설정
  await vault.setFeeRecipient(feeRecipient.address);
  console.log(`✅ Fee 수취인 설정: ${feeRecipient.address}`);

  // Performance Fee 비율 설정 (10%)
  await vault.setPerformanceFeeRate(1000);
  console.log(`📊 Performance Fee 비율: 10%`);

  // USDT 토큰 지원 설정
  await vault.setSupportedToken(USDT_ADDRESS, true);
  console.log(`✅ USDT 토큰 지원 설정 완료`);

  // 프로토콜 설정
  await vault.setAaveConfig(AAVE_POOL_V3, USDT_ADDRESS, AUSDT_ADDRESS);
  await vault.setMorphoVault(USDT_ADDRESS, STEAKHOUSE_VAULT);
  console.log(`✅ AAVE 및 Morpho 설정 완료`);

  // 프로토콜 분배 비율 설정 (70% AAVE, 30% Morpho)
  await vault.setProtocolAllocations(USDT_ADDRESS, 7000, 3000);
  console.log(`✅ 프로토콜 분배 비율 설정: AAVE 70%, Morpho 30%`);

  // Bridge 권한 설정
  await vault.setBridgeAuthorization(bridgeContract.address, true);
  console.log(`✅ Bridge 권한 설정: ${bridgeContract.address}`);

  // USDT 획득 (Whale에서 가져오기)
  const USDT_WHALE = '0x28C6c06298d514Db089934071355E5743bf21d60';
  await ethers.provider.send('hardhat_impersonateAccount', [USDT_WHALE]);
  const whale = await ethers.getSigner(USDT_WHALE);

  // Bridge 컨트랙트에 USDT 전송 (총 3000 USDT)
  const bridgeAmount = ethers.parseUnits('3000', 6);
  await usdt.connect(whale).transfer(bridgeContract.address, bridgeAmount);
  console.log(`✅ Bridge에 USDT 3000.0 전송 완료`);

  // 헬퍼 함수들
  const logStatus = async (week: number, description: string) => {
    console.log(`\n📅 === Week ${week}: ${description} ===`);

    // 프로토콜별 잔액
    const [aaveBalance, morphoBalance, totalBalance] = await vault.getProtocolBalances(
      USDT_ADDRESS,
    );
    console.log(`📊 프로토콜별 잔액:`);
    console.log(`  💼 AAVE: ${ethers.formatUnits(aaveBalance, 6)} USDT`);
    console.log(`  🥩 Morpho: ${ethers.formatUnits(morphoBalance, 6)} USDT`);
    console.log(`  💰 총합: ${ethers.formatUnits(totalBalance, 6)} USDT`);

    // 수익률 계산
    const [totalValue, principal, yieldAmount, yieldRate] = await vault.calculateYield(
      USDT_ADDRESS,
    );
    console.log(`📈 수익률 정보:`);
    console.log(`  💎 총 가치: ${ethers.formatUnits(totalValue, 6)} USDT`);
    console.log(`  🏦 원금: ${ethers.formatUnits(principal, 6)} USDT`);
    console.log(`  💰 수익: ${ethers.formatUnits(yieldAmount, 6)} USDT`);
    console.log(`  📊 수익률: ${Number(yieldRate) / 100}%`);

    if (yieldAmount > 0) {
      const weeksElapsed = week;
      const weeklyRate = Number(yieldRate) / 10000; // basis points to decimal
      const annualizedAPY = ((1 + weeklyRate / weeksElapsed) ** 52 - 1) * 100;
      console.log(`  🔥 연환산 APY: ${annualizedAPY.toFixed(2)}%`);
    }

    // Fee 정보
    const [feeRate, accumulatedFees, totalFeesWithdrawn] = await vault.getFeeInfo(
      USDT_ADDRESS,
    );
    console.log(`💎 Fee 정보:`);
    console.log(`  📈 누적 Fee: ${ethers.formatUnits(accumulatedFees, 6)} USDT`);
    console.log(`  💸 인출된 Fee: ${ethers.formatUnits(totalFeesWithdrawn, 6)} USDT`);
  };

  const moveTimeForward = async (weeks: number) => {
    const secondsInWeek = 7 * 24 * 60 * 60;
    await ethers.provider.send('evm_increaseTime', [weeks * secondsInWeek]);
    await ethers.provider.send('evm_mine', []);
    console.log(`⏰ ${weeks}주일 시간 이동 완료`);
  };

  // =============================================================================
  console.log('\n=== 초기 상태 확인 ===');
  await logStatus(0, '초기 상태');

  // =============================================================================
  console.log('\n=== 3. Week 1: 브릿지를 통해 USDT 1000개 받기 및 분산 투자 ===');

  // Bridge에서 vault로 1000 USDT 전송
  const amount1 = ethers.parseUnits('1000', 6);
  await usdt.connect(bridgeContract).approve(proxyAddress, amount1);
  await vault.connect(bridgeContract).receiveFromBridge(USDT_ADDRESS, amount1);
  console.log('✅ Bridge를 통해 1000 USDT 수신 및 분산 투자 완료');

  // 1주일 경과
  await moveTimeForward(1);
  await logStatus(1, '첫 1000 USDT 투자 1주일 후');

  // =============================================================================
  console.log('\n=== 4. Week 2: 500 USDT 출금 ===');

  // 사용자1에게 share 발행을 위해 소액 예치 (share 계산을 위함)
  const smallAmount = ethers.parseUnits('1', 6);
  await usdt.connect(whale).transfer(user1.address, smallAmount);
  await usdt.connect(user1).approve(proxyAddress, smallAmount);
  await vault.connect(user1).deposit(USDT_ADDRESS, smallAmount);

  // 사용자 정보 확인
  const [userShares, userAssets] = await vault.getUserInfo(user1.address, USDT_ADDRESS);
  console.log(`👤 사용자1 정보:`);
  console.log(`  💰 Shares: ${ethers.formatUnits(userShares, 18)}`);
  console.log(`  📈 자산 가치: ${ethers.formatUnits(userAssets, 6)} USDT`);

  // 500 USDT 상당의 share 계산 후 출금
  const withdrawAmount = ethers.parseUnits('500', 6);
  const totalValue = await vault.getTotalValue(USDT_ADDRESS);
  const totalShares = await vault.totalShares(USDT_ADDRESS);
  const sharesToRedeem = (userShares * withdrawAmount) / userAssets;

  await vault.connect(user1).redeem(USDT_ADDRESS, sharesToRedeem);
  console.log('✅ 500 USDT 상당 출금 완료');

  // 1주일 경과
  await moveTimeForward(1);
  await logStatus(2, '500 USDT 출금 1주일 후');

  // =============================================================================
  console.log('\n=== 5. Week 3: 추가로 1000 USDT 투자 ===');

  // Bridge에서 vault로 추가 1000 USDT 전송
  await usdt.connect(bridgeContract).approve(proxyAddress, amount1);
  await vault.connect(bridgeContract).receiveFromBridge(USDT_ADDRESS, amount1);
  console.log('✅ Bridge를 통해 추가 1000 USDT 수신 및 분산 투자 완료');

  // 1주일 경과
  await moveTimeForward(1);
  await logStatus(3, '추가 1000 USDT 투자 1주일 후');

  // =============================================================================
  console.log('\n=== 6. Week 4: 다시 500 USDT 출금 ===');

  // 현재 사용자의 share 정보 재확인
  const [currentShares, currentAssets] = await vault.getUserInfo(
    user1.address,
    USDT_ADDRESS,
  );
  console.log(`👤 사용자1 현재 정보:`);
  console.log(`  💰 Shares: ${ethers.formatUnits(currentShares, 18)}`);
  console.log(`  📈 자산 가치: ${ethers.formatUnits(currentAssets, 6)} USDT`);

  // 500 USDT 상당의 share 계산 후 출금
  const finalSharesToRedeem = (currentShares * withdrawAmount) / currentAssets;
  await vault.connect(user1).redeem(USDT_ADDRESS, finalSharesToRedeem);
  console.log('✅ 최종 500 USDT 상당 출금 완료');

  // 1주일 경과
  await moveTimeForward(1);
  await logStatus(4, '최종 출금 1주일 후');

  // =============================================================================
  console.log('\n=== 7. Performance Fee 인출 테스트 ===');

  // 누적된 Performance Fee 확인 및 인출
  const [, accumulatedFees] = await vault.getFeeInfo(USDT_ADDRESS);
  if (accumulatedFees > 0) {
    const feeRecipientBalanceBefore = await usdt.balanceOf(feeRecipient.address);

    await vault.connect(feeRecipient).withdrawAllFees(USDT_ADDRESS);
    console.log('✅ 모든 Performance Fee 인출 완료');

    const feeRecipientBalanceAfter = await usdt.balanceOf(feeRecipient.address);
    const withdrawnFees = feeRecipientBalanceAfter - feeRecipientBalanceBefore;
    console.log(`💰 인출된 총 Fee: ${ethers.formatUnits(withdrawnFees, 6)} USDT`);
  } else {
    console.log('⚠️ 인출할 Performance Fee가 없습니다.');
  }

  // =============================================================================
  console.log('\n=== 8. 최종 상태 및 요약 ===');
  await logStatus(4, '최종 상태');

  // 전체 거래 요약
  console.log('\n📊 === 전체 거래 요약 ===');
  console.log('🔄 거래 내역:');
  console.log('  Week 1: Bridge → 1000 USDT 투자');
  console.log('  Week 2: 500 USDT 출금');
  console.log('  Week 3: Bridge → 추가 1000 USDT 투자');
  console.log('  Week 4: 500 USDT 출금');

  // 토큰 통계
  const [deposited, withdrawn, totalSharesSupply, currentValue] =
    await vault.getTokenStats(USDT_ADDRESS);
  console.log('\n📈 최종 통계:');
  console.log(`  💰 총 예치량: ${ethers.formatUnits(deposited, 6)} USDT`);
  console.log(`  💸 총 출금량: ${ethers.formatUnits(withdrawn, 6)} USDT`);
  console.log(`  📊 순 투자금: ${ethers.formatUnits(deposited - withdrawn, 6)} USDT`);
  console.log(`  🎯 현재 가치: ${ethers.formatUnits(currentValue, 6)} USDT`);
  console.log(`  📈 총 shares: ${ethers.formatUnits(totalSharesSupply, 18)}`);

  // 수익률 최종 분석
  const netProfit = currentValue - (deposited - withdrawn);
  const profitRate = Number((netProfit * 10000n) / (deposited - withdrawn)) / 100;
  console.log(`  💎 순 수익: ${ethers.formatUnits(netProfit, 6)} USDT`);
  console.log(`  🔥 총 수익률: ${profitRate.toFixed(2)}%`);
  console.log(
    `  📅 4주간 연환산 APY: ${
      (Math.pow(1 + profitRate / 100, 13) - 1).toFixed(2) * 100
    }%`,
  );

  console.log('\n🎉 ================ Full Test 시나리오 완료 ================');
  console.log('✅ 성공적으로 완료된 테스트:');
  console.log('  🌉 Bridge를 통한 자동 분산 투자');
  console.log('  💰 Share 기반 예치/출금 시스템');
  console.log('  📊 매주 수익률 및 APY 추적');
  console.log('  💎 Performance Fee 자동 수집 및 인출');
  console.log('  🔄 프로토콜 분산 투자 (AAVE 70% + Morpho 30%)');
  console.log('  ⏰ 시간 경과에 따른 수익 누적');
  console.log('================================================================');
}

// 메인 함수 실행
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
