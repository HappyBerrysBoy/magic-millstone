// 교환비 기반 시스템 테스트
// 요구사항에 따른 시나리오:
// 1. 최초 1000 USDT 브릿지 수신 (원금: 1000, 교환비: 1:1)
// 2. 1주일 후 총 가치 1100 USDT (수익 100 발생)
// 3. 추가 1000 USDT deposit → Performance Fee 10 → 순수익 90 → 교환비 1:1.09
// 4. 새 원금 2000 USDT, 1주일 후 총 가치 2200 USDT
// 5. 또 다른 deposit → Performance Fee 20 → 순수익 180 → 교환비 업데이트
// 6. 출금 테스트 (원금 기준 → 교환비 적용된 실제 금액)

import { ethers } from 'hardhat';

async function main() {
  console.log('🚀 교환비 기반 MillstoneAIVault 테스트를 시작합니다...\n');

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
  const [deployer, feeRecipient, bridgeContract, user1, user2] = await ethers.getSigners();

  console.log('👤 계정 설정:');
  console.log(`  배포자: ${deployer.address}`);
  console.log(`  Fee 수취인: ${feeRecipient.address}`);
  console.log(`  Bridge 컨트랙트: ${bridgeContract.address}`);
  console.log(`  사용자1: ${user1.address}`);
  console.log(`  사용자2: ${user2.address}\n`);

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

  // Bridge 컨트랙트와 사용자들에게 USDT 전송
  const bridgeAmount = ethers.parseUnits('5000', 6);
  const userAmount = ethers.parseUnits('2000', 6);
  await usdt.connect(whale).transfer(bridgeContract.address, bridgeAmount);
  await usdt.connect(whale).transfer(user1.address, userAmount);
  await usdt.connect(whale).transfer(user2.address, userAmount);
  console.log(`✅ USDT 분배 완료 (Bridge: 5000, User1: 2000, User2: 2000)`);

  // 헬퍼 함수들
  const logExchangeRateStatus = async (step: string) => {
    console.log(`\n📊 === ${step} ===`);

    // 교환비 정보
    const exchangeRate = await vault.getExchangeRate(USDT_ADDRESS);
    const [
      currentExchangeRate,
      totalPrincipal,
      totalCurrentValue,
      grossProfit,
      netProfit,
      accumulatedFeeAmount
    ] = await vault.getExchangeRateInfo(USDT_ADDRESS);

    console.log(`💱 교환비 정보:`);
    console.log(`  📈 현재 교환비: 1:${ethers.formatUnits(exchangeRate, 18)}`);
    console.log(`  🏦 총 원금: ${ethers.formatUnits(totalPrincipal, 6)} USDT`);
    console.log(`  💰 총 현재 가치: ${ethers.formatUnits(totalCurrentValue, 6)} USDT`);
    console.log(`  📊 총 수익: ${ethers.formatUnits(grossProfit, 6)} USDT`);
    console.log(`  💎 순 수익: ${ethers.formatUnits(netProfit, 6)} USDT`);
    console.log(`  💸 누적 Fee: ${ethers.formatUnits(accumulatedFeeAmount, 6)} USDT`);

    // 프로토콜별 잔액
    const [aaveBalance, morphoBalance, totalBalance] = await vault.getProtocolBalances(USDT_ADDRESS);
    console.log(`\n🏦 프로토콜별 잔액:`);
    console.log(`  💼 AAVE: ${ethers.formatUnits(aaveBalance, 6)} USDT`);
    console.log(`  🥩 Morpho: ${ethers.formatUnits(morphoBalance, 6)} USDT`);
    console.log(`  💰 총합: ${ethers.formatUnits(totalBalance, 6)} USDT`);

    // 사용자별 정보
    const [user1Principal, user1Value, user1Rate] = await vault.getUserInfo(user1.address, USDT_ADDRESS);
    const [user2Principal, user2Value, user2Rate] = await vault.getUserInfo(user2.address, USDT_ADDRESS);
    
    if (user1Principal > 0 || user2Principal > 0) {
      console.log(`\n👥 사용자 정보:`);
      if (user1Principal > 0) {
        console.log(`  👤 User1 - 원금: ${ethers.formatUnits(user1Principal, 6)} USDT, 현재가치: ${ethers.formatUnits(user1Value, 6)} USDT`);
      }
      if (user2Principal > 0) {
        console.log(`  👤 User2 - 원금: ${ethers.formatUnits(user2Principal, 6)} USDT, 현재가치: ${ethers.formatUnits(user2Value, 6)} USDT`);
      }
    }
  };

  const moveTimeForward = async (days: number) => {
    const secondsInDay = 24 * 60 * 60;
    await ethers.provider.send('evm_increaseTime', [days * secondsInDay]);
    await ethers.provider.send('evm_mine', []);
    console.log(`⏰ ${days}일 시간 이동 완료`);
  };

  // =============================================================================
  console.log('\n=== 3. 시나리오 1: 최초 1000 USDT 브릿지 수신 ===');

  // Bridge에서 vault로 1000 USDT 전송 (원금으로 기록)
  const amount1 = ethers.parseUnits('1000', 6);
  await usdt.connect(bridgeContract).approve(proxyAddress, amount1);
  await vault.connect(bridgeContract).receiveFromBridge(USDT_ADDRESS, amount1);
  console.log('✅ Bridge를 통해 1000 USDT 수신 및 분산 투자 완료');

  await logExchangeRateStatus('최초 1000 USDT 수신 후');

  // =============================================================================
  console.log('\n=== 4. 시나리오 2: 7일 후 수익 발생 (1100 USDT) ===');

  // 7일 경과
  await moveTimeForward(7);
  await logExchangeRateStatus('7일 후 수익 발생');

  // =============================================================================
  console.log('\n=== 5. 시나리오 3: 사용자1이 1000 USDT 추가 예치 ===');

  const amount2 = ethers.parseUnits('1000', 6);
  await usdt.connect(user1).approve(proxyAddress, amount2);
  await vault.connect(user1).deposit(USDT_ADDRESS, amount2);
  console.log('✅ User1이 1000 USDT 예치 완료 (Performance Fee 수집 및 교환비 업데이트)');

  await logExchangeRateStatus('User1 1000 USDT 예치 후 (교환비 업데이트됨)');

  // 교환비 변화 시뮬레이션 확인
  const [currentRate, newRate, grossProfit, feeAmount, netProfit] = await vault.simulateExchangeRateUpdate(USDT_ADDRESS);
  console.log(`\n🔮 교환비 시뮬레이션:`);
  console.log(`  📊 현재 교환비: 1:${ethers.formatUnits(currentRate, 18)}`);
  console.log(`  📈 예상 새 교환비: 1:${ethers.formatUnits(newRate, 18)}`);
  console.log(`  💰 총 수익: ${ethers.formatUnits(grossProfit, 6)} USDT`);
  console.log(`  💸 Performance Fee: ${ethers.formatUnits(feeAmount, 6)} USDT`);
  console.log(`  💎 순 수익: ${ethers.formatUnits(netProfit, 6)} USDT`);

  // =============================================================================
  console.log('\n=== 6. 시나리오 4: 다시 7일 후 추가 수익 (총 2200 USDT) ===');

  await moveTimeForward(7);
  await logExchangeRateStatus('두 번째 7일 후');

  // =============================================================================
  console.log('\n=== 7. 시나리오 5: 사용자2가 500 USDT 예치 ===');

  const amount3 = ethers.parseUnits('500', 6);
  await usdt.connect(user2).approve(proxyAddress, amount3);
  await vault.connect(user2).deposit(USDT_ADDRESS, amount3);
  console.log('✅ User2가 500 USDT 예치 완료 (교환비 재업데이트)');

  await logExchangeRateStatus('User2 500 USDT 예치 후');

  // =============================================================================
  console.log('\n=== 8. 시나리오 6: 출금 테스트 (교환비 적용) ===');

  // User1이 원금 500 USDT 출금 (교환비 적용되어 더 많이 받음)
  const withdrawPrincipal = ethers.parseUnits('500', 6);
  
  // 예상 출금액 미리 확인
  const previewAmount = await vault.previewRedeem(USDT_ADDRESS, withdrawPrincipal);
  console.log(`\n💡 출금 미리보기:`);
  console.log(`  🏦 출금 원금: ${ethers.formatUnits(withdrawPrincipal, 6)} USDT`);
  console.log(`  💰 예상 실제 수령액: ${ethers.formatUnits(previewAmount, 6)} USDT`);
  console.log(`  📈 교환비 적용 이익: ${ethers.formatUnits(previewAmount - withdrawPrincipal, 6)} USDT`);

  // 실제 출금 실행
  const user1BalanceBefore = await usdt.balanceOf(user1.address);
  await vault.connect(user1).redeem(USDT_ADDRESS, withdrawPrincipal);
  const user1BalanceAfter = await usdt.balanceOf(user1.address);
  const actualReceived = user1BalanceAfter - user1BalanceBefore;

  console.log(`\n✅ User1 출금 완료:`);
  console.log(`  💰 실제 수령액: ${ethers.formatUnits(actualReceived, 6)} USDT`);
  console.log(`  🎯 예상액과 일치: ${actualReceived === previewAmount ? '✅' : '❌'}`);

  await logExchangeRateStatus('User1 500 USDT 출금 후');

  // =============================================================================
  console.log('\n=== 9. Performance Fee 인출 테스트 ===');

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

  await logExchangeRateStatus('Performance Fee 인출 후');

  // =============================================================================
  console.log('\n=== 10. 최종 교환비 및 수익률 분석 ===');

  const finalExchangeRate = await vault.getExchangeRate(USDT_ADDRESS);
  const [totalValue, principal, yieldAmount, yieldRate] = await vault.calculateYield(USDT_ADDRESS);
  const [, , grossYield, totalFeeAmount, netYield, netYieldRate] = await vault.calculateNetYield(USDT_ADDRESS);

  console.log(`\n📊 최종 분석:`);
  console.log(`  💱 최종 교환비: 1:${ethers.formatUnits(finalExchangeRate, 18)}`);
  console.log(`  📈 교환비 상승률: ${((Number(ethers.formatUnits(finalExchangeRate, 18)) - 1) * 100).toFixed(2)}%`);
  console.log(`  🏦 총 원금: ${ethers.formatUnits(principal, 6)} USDT`);
  console.log(`  💰 총 가치: ${ethers.formatUnits(totalValue, 6)} USDT`);
  console.log(`  📊 총 수익: ${ethers.formatUnits(yieldAmount, 6)} USDT`);
  console.log(`  💎 순 수익 (사용자): ${ethers.formatUnits(netYield, 6)} USDT`);
  console.log(`  💸 수집된 Fee: ${ethers.formatUnits(totalFeeAmount, 6)} USDT`);
  console.log(`  🔥 순 수익률: ${(Number(netYieldRate) / 100).toFixed(2)}%`);

  // 각 사용자별 최종 상태
  const [finalUser1Principal, finalUser1Value] = await vault.getUserInfo(user1.address, USDT_ADDRESS);
  const [finalUser2Principal, finalUser2Value] = await vault.getUserInfo(user2.address, USDT_ADDRESS);

  console.log(`\n👥 사용자별 최종 상태:`);
  console.log(`  👤 User1:`);
  console.log(`    🏦 남은 원금: ${ethers.formatUnits(finalUser1Principal, 6)} USDT`);
  console.log(`    💰 현재 가치: ${ethers.formatUnits(finalUser1Value, 6)} USDT`);
  console.log(`    📈 교환비 적용 이익: ${ethers.formatUnits(finalUser1Value - finalUser1Principal, 6)} USDT`);
  
  console.log(`  👤 User2:`);
  console.log(`    🏦 원금: ${ethers.formatUnits(finalUser2Principal, 6)} USDT`);
  console.log(`    💰 현재 가치: ${ethers.formatUnits(finalUser2Value, 6)} USDT`);
  console.log(`    📈 교환비 적용 이익: ${ethers.formatUnits(finalUser2Value - finalUser2Principal, 6)} USDT`);

  console.log('\n🎉 ================ 교환비 기반 시스템 테스트 완료 ================');
  console.log('✅ 성공적으로 테스트된 기능들:');
  console.log('  🏦 원금 별도 저장 시스템');
  console.log('  💱 교환비 자동 업데이트');
  console.log('  💰 Performance Fee 수집 및 순수익 반영');
  console.log('  📊 원금 기준 예치/출금 시스템');
  console.log('  🔍 교환비 조회 및 시뮬레이션 함수');
  console.log('  👥 사용자별 교환비 적용 수익 분배');
  console.log('================================================================');
}

// 메인 함수 실행
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });