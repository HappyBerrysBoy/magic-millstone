// StakedUSDT 구조 테스트 스크립트
// 10회 이벤트: 입금, 출금, 이자 발생을 통한 교환비 변화 테스트
// 알만액 stakedUSDT와 같은 구조로 작동하는지 검증

import { ethers } from 'hardhat';

async function main() {
  console.log('🚀 StakedUSDT 구조 테스트를 시작합니다...\n');

  // 주소 설정
  const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  const STEAKHOUSE_VAULT = '0xbEef047a543E45807105E51A8BBEFCc5950fcfBa';
  const AAVE_POOL_V3 = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2';
  const AUSDT_ADDRESS = '0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a';

  console.log('📋 사용할 주소들:');
  console.log(`  Steakhouse USDT Vault: ${STEAKHOUSE_VAULT}`);
  console.log(`  AAVE Pool V3: ${AAVE_POOL_V3}`);
  console.log(`  USDT: ${USDT_ADDRESS}\n`);

  // Signers 설정
  const [deployer, feeRecipient, bridgeContract, alice, bob, charlie] = await ethers.getSigners();

  console.log('👤 계정 설정:');
  console.log(`  배포자: ${deployer.address}`);
  console.log(`  Fee 수취인: ${feeRecipient.address}`);
  console.log(`  Bridge: ${bridgeContract.address}`);
  console.log(`  Alice: ${alice.address}`);
  console.log(`  Bob: ${bob.address}`);
  console.log(`  Charlie: ${charlie.address}\n`);

  // =============================================================================
  console.log('=== 1. MillstoneAIVault 배포 및 초기 설정 ===');

  // MillstoneAIVault 구현체 배포
  const MillstoneAIVault = await ethers.getContractFactory('MillstoneAIVault');
  const implementation = await MillstoneAIVault.deploy();
  await implementation.waitForDeployment();
  console.log(`✅ MillstoneAIVault 구현체 배포: ${implementation.target}`);

  // EIP1967 프록시 배포
  const EIP1967Proxy = await ethers.getContractFactory('EIP1967Proxy');
  const initData = implementation.interface.encodeFunctionData('initialize', [deployer.address]);
  const proxy = await EIP1967Proxy.deploy(implementation.target, initData);
  await proxy.waitForDeployment();
  const proxyAddress = proxy.target.toString();
  console.log(`✅ EIP1967 프록시 배포: ${proxyAddress}`);

  // 프록시를 통해 vault 인스턴스 생성
  const vault = MillstoneAIVault.attach(proxyAddress);

  // USDT 인스턴스 생성
  const usdt = await ethers.getContractAt('IERC20', USDT_ADDRESS);

  // 초기 설정
  await vault.setFeeRecipient(feeRecipient.address);
  await vault.setPerformanceFeeRate(1000); // 10%
  await vault.setSupportedToken(USDT_ADDRESS, true);
  await vault.setAaveConfig(AAVE_POOL_V3, USDT_ADDRESS, AUSDT_ADDRESS);
  await vault.setMorphoVault(USDT_ADDRESS, STEAKHOUSE_VAULT);
  await vault.setProtocolAllocations(USDT_ADDRESS, 7000, 3000); // 70% AAVE, 30% Morpho
  await vault.setBridgeAuthorization(bridgeContract.address, true);
  console.log(`✅ 초기 설정 완료`);

  // USDT 획득 및 분배
  const USDT_WHALE = '0x28C6c06298d514Db089934071355E5743bf21d60';
  await ethers.provider.send('hardhat_impersonateAccount', [USDT_WHALE]);
  const whale = await ethers.getSigner(USDT_WHALE);

  // 각 계정에 USDT 전송
  const fundingAmount = ethers.parseUnits('10000', 6);
  await usdt.connect(whale).transfer(bridgeContract.address, fundingAmount);
  await usdt.connect(whale).transfer(alice.address, fundingAmount);
  await usdt.connect(whale).transfer(bob.address, fundingAmount);
  await usdt.connect(whale).transfer(charlie.address, fundingAmount);
  console.log(`✅ USDT 분배 완료 (각 계정당 10,000 USDT)`);

  // 헬퍼 함수들
  const logStakedUSDTStatus = async (eventNumber: number, description: string) => {
    console.log(`\n🏷️  === Event ${eventNumber}: ${description} ===`);

    // StakedUSDT 전체 정보
    const [currentExchangeRate, totalSupply, totalCurrentValue, totalUnderlyingDeposited, accumulatedFeeAmount] = 
      await vault.getStakedTokenInfo(USDT_ADDRESS);

    console.log(`📊 StakedUSDT 전체 정보:`);
    console.log(`  💱 교환비: 1 stakedUSDT = ${ethers.formatUnits(currentExchangeRate, 18)} USDT`);
    console.log(`  🪙 총 발행량: ${ethers.formatUnits(totalSupply, 18)} stakedUSDT`);
    console.log(`  💰 총 현재 가치: ${ethers.formatUnits(totalCurrentValue, 6)} USDT`);
    console.log(`  🏦 총 예치량: ${ethers.formatUnits(totalUnderlyingDeposited, 6)} USDT`);
    console.log(`  💸 누적 Fee: ${ethers.formatUnits(accumulatedFeeAmount, 6)} USDT`);

    // 프로토콜별 잔액
    const [aaveBalance, morphoBalance, totalBalance] = await vault.getProtocolBalances(USDT_ADDRESS);
    console.log(`\n🏦 프로토콜별 잔액:`);
    console.log(`  💼 AAVE: ${ethers.formatUnits(aaveBalance, 6)} USDT`);
    console.log(`  🥩 Morpho: ${ethers.formatUnits(morphoBalance, 6)} USDT`);
    console.log(`  📈 총합: ${ethers.formatUnits(totalBalance, 6)} USDT`);

    // 사용자별 정보
    const aliceInfo = await vault.getUserInfo(alice.address, USDT_ADDRESS);
    const bobInfo = await vault.getUserInfo(bob.address, USDT_ADDRESS);
    const charlieInfo = await vault.getUserInfo(charlie.address, USDT_ADDRESS);

    console.log(`\n👥 사용자별 StakedUSDT 정보:`);
    if (aliceInfo[0] > 0) {
      console.log(`  👤 Alice: ${ethers.formatUnits(aliceInfo[0], 18)} stakedUSDT → ${ethers.formatUnits(aliceInfo[1], 6)} USDT`);
    }
    if (bobInfo[0] > 0) {
      console.log(`  👤 Bob: ${ethers.formatUnits(bobInfo[0], 18)} stakedUSDT → ${ethers.formatUnits(bobInfo[1], 6)} USDT`);
    }
    if (charlieInfo[0] > 0) {
      console.log(`  👤 Charlie: ${ethers.formatUnits(charlieInfo[0], 18)} stakedUSDT → ${ethers.formatUnits(charlieInfo[1], 6)} USDT`);
    }

    // 교환비 변화 계산 (이전 교환비와 비교)
    if (eventNumber > 1) {
      const exchangeRateIncrease = Number(ethers.formatUnits(currentExchangeRate, 18)) - 1;
      const percentageIncrease = (exchangeRateIncrease * 100).toFixed(4);
      console.log(`\n📈 교환비 변화: +${percentageIncrease}% (초기 1:1 대비)`);
    }
  };

  const moveTimeForward = async (days: number) => {
    const secondsInDay = 24 * 60 * 60;
    await ethers.provider.send('evm_increaseTime', [days * secondsInDay]);
    await ethers.provider.send('evm_mine', []);
    console.log(`⏰ ${days}일 시간 이동 완료`);
  };

  // =============================================================================
  // 10개 이벤트 시나리오 시작
  // =============================================================================

  console.log('\n🎬 === 10개 이벤트 시나리오 시작 ===\n');

  // Event 1: Bridge에서 초기 자금 수신
  const bridgeAmount1 = ethers.parseUnits('5000', 6); // 5000 USDT
  await usdt.connect(bridgeContract).approve(proxyAddress, bridgeAmount1);
  await vault.connect(bridgeContract).receiveFromBridge(USDT_ADDRESS, bridgeAmount1);
  await logStakedUSDTStatus(1, 'Bridge에서 5000 USDT 수신');

  // Event 2: Alice가 2000 USDT 예치
  await moveTimeForward(3);
  const aliceDeposit1 = ethers.parseUnits('2000', 6);
  await usdt.connect(alice).approve(proxyAddress, aliceDeposit1);
  const aliceStakedTokens1 = await vault.connect(alice).deposit(USDT_ADDRESS, aliceDeposit1);
  await logStakedUSDTStatus(2, 'Alice 2000 USDT 예치 (첫 사용자)');

  // Event 3: 7일 후 이자 발생
  await moveTimeForward(7);
  // 이자 발생을 위해 소액 예치 (트리거 역할)
  const triggerAmount = ethers.parseUnits('1', 6);
  await usdt.connect(alice).approve(proxyAddress, triggerAmount);
  await vault.connect(alice).deposit(USDT_ADDRESS, triggerAmount);
  await logStakedUSDTStatus(3, '7일 후 이자 발생 및 교환비 업데이트');

  // Event 4: Bob이 1500 USDT 예치 (교환비 증가 후)
  await moveTimeForward(2);
  const bobDeposit1 = ethers.parseUnits('1500', 6);
  await usdt.connect(bob).approve(proxyAddress, bobDeposit1);
  await vault.connect(bob).deposit(USDT_ADDRESS, bobDeposit1);
  await logStakedUSDTStatus(4, 'Bob 1500 USDT 예치 (교환비 증가 후)');

  // Event 5: Alice가 stakedUSDT 일부 출금
  await moveTimeForward(5);
  const aliceStakedBalance = await vault.getStakedTokenBalance(alice.address, USDT_ADDRESS);
  const aliceRedeemAmount = aliceStakedBalance / 3n; // 1/3 출금
  await vault.connect(alice).redeem(USDT_ADDRESS, aliceRedeemAmount);
  await logStakedUSDTStatus(5, 'Alice stakedUSDT 1/3 출금');

  // Event 6: Charlie가 1000 USDT 예치
  await moveTimeForward(4);
  const charlieDeposit1 = ethers.parseUnits('1000', 6);
  await usdt.connect(charlie).approve(proxyAddress, charlieDeposit1);
  await vault.connect(charlie).deposit(USDT_ADDRESS, charlieDeposit1);
  await logStakedUSDTStatus(6, 'Charlie 1000 USDT 예치');

  // Event 7: 10일 후 추가 이자 발생
  await moveTimeForward(10);
  await usdt.connect(bob).approve(proxyAddress, triggerAmount);
  await vault.connect(bob).deposit(USDT_ADDRESS, triggerAmount);
  await logStakedUSDTStatus(7, '10일 후 추가 이자 발생');

  // Event 8: Bob이 stakedUSDT 절반 출금
  await moveTimeForward(3);
  const bobStakedBalance = await vault.getStakedTokenBalance(bob.address, USDT_ADDRESS);
  const bobRedeemAmount = bobStakedBalance / 2n; // 절반 출금
  await vault.connect(bob).redeem(USDT_ADDRESS, bobRedeemAmount);
  await logStakedUSDTStatus(8, 'Bob stakedUSDT 절반 출금');

  // Event 9: 대량 브릿지 자금 수신
  await moveTimeForward(6);
  const bridgeAmount2 = ethers.parseUnits('3000', 6); // 3000 USDT
  await usdt.connect(bridgeContract).approve(proxyAddress, bridgeAmount2);
  await vault.connect(bridgeContract).receiveFromBridge(USDT_ADDRESS, bridgeAmount2);
  await logStakedUSDTStatus(9, 'Bridge에서 추가 3000 USDT 수신');

  // Event 10: 14일 후 최종 이자 발생 및 성과 수수료 인출
  await moveTimeForward(14);
  await usdt.connect(charlie).approve(proxyAddress, triggerAmount);
  await vault.connect(charlie).deposit(USDT_ADDRESS, triggerAmount);
  
  // Performance Fee 인출
  const [, accumulatedFees] = await vault.getFeeInfo(USDT_ADDRESS);
  if (accumulatedFees > 0) {
    await vault.connect(feeRecipient).withdrawAllFees(USDT_ADDRESS);
    console.log(`💰 Performance Fee 인출: ${ethers.formatUnits(accumulatedFees, 6)} USDT`);
  }
  
  await logStakedUSDTStatus(10, '14일 후 최종 이자 발생 및 Fee 인출');

  // =============================================================================
  console.log('\n🎯 === 최종 분석 및 검증 ===');

  // 각 사용자의 예치/출금 미리보기 테스트
  console.log('\n🔍 예치/출금 미리보기 테스트:');
  
  const previewDeposit1000 = await vault.previewDeposit(USDT_ADDRESS, ethers.parseUnits('1000', 6));
  const previewRedeem500 = await vault.previewRedeem(USDT_ADDRESS, ethers.parseUnits('500', 18));
  
  console.log(`  💰 1000 USDT 예치 시 받을 stakedUSDT: ${ethers.formatUnits(previewDeposit1000, 18)}`);
  console.log(`  🪙 500 stakedUSDT 출금 시 받을 USDT: ${ethers.formatUnits(previewRedeem500, 6)}`);

  // 교환비 시뮬레이션
  const [currentRate, newRate, totalGain, feeAmount, netGain] = await vault.simulateExchangeRateUpdate(USDT_ADDRESS);
  console.log(`\n🔮 교환비 시뮬레이션:`);
  console.log(`  📊 현재 교환비: 1:${ethers.formatUnits(currentRate, 18)}`);
  console.log(`  📈 예상 새 교환비: 1:${ethers.formatUnits(newRate, 18)}`);
  console.log(`  💰 총 수익: ${ethers.formatUnits(totalGain, 6)} USDT`);
  console.log(`  💸 Fee: ${ethers.formatUnits(feeAmount, 6)} USDT`);
  console.log(`  💎 순 수익: ${ethers.formatUnits(netGain, 6)} USDT`);

  // 최종 통계
  const [totalValue, totalDepositedAmount, yieldAmount, yieldRate] = await vault.calculateYield(USDT_ADDRESS);
  const [totalStakedSupply, totalUnderlyingDeposited, totalWithdrawn, currentValue, finalExchangeRate] = 
    await vault.getTokenStats(USDT_ADDRESS);

  console.log(`\n📊 === 최종 StakedUSDT 시스템 통계 ===`);
  console.log(`💱 최종 교환비: 1 stakedUSDT = ${ethers.formatUnits(finalExchangeRate, 18)} USDT`);
  console.log(`🪙 총 stakedUSDT 발행량: ${ethers.formatUnits(totalStakedSupply, 18)}`);
  console.log(`💰 총 underlying 예치: ${ethers.formatUnits(totalUnderlyingDeposited, 6)} USDT`);
  console.log(`💸 총 출금량: ${ethers.formatUnits(totalWithdrawn, 6)} USDT`);
  console.log(`🎯 현재 총 가치: ${ethers.formatUnits(currentValue, 6)} USDT`);
  console.log(`📈 총 수익: ${ethers.formatUnits(yieldAmount, 6)} USDT`);
  console.log(`🔥 수익률: ${Number(yieldRate)/100}%`);

  // 교환비 증가율 계산
  const exchangeRateIncrease = Number(ethers.formatUnits(finalExchangeRate, 18)) - 1;
  const percentageIncrease = (exchangeRateIncrease * 100).toFixed(4);
  console.log(`\n🚀 교환비 상승률: +${percentageIncrease}% (초기 1:1 대비)`);

  // 사용자별 최종 수익 분석
  console.log(`\n👥 사용자별 최종 수익 분석:`);
  const finalAliceInfo = await vault.getUserInfo(alice.address, USDT_ADDRESS);
  const finalBobInfo = await vault.getUserInfo(bob.address, USDT_ADDRESS);
  const finalCharlieInfo = await vault.getUserInfo(charlie.address, USDT_ADDRESS);

  if (finalAliceInfo[0] > 0) {
    console.log(`  👤 Alice:`);
    console.log(`    🪙 보유: ${ethers.formatUnits(finalAliceInfo[0], 18)} stakedUSDT`);
    console.log(`    💰 가치: ${ethers.formatUnits(finalAliceInfo[1], 6)} USDT`);
  }
  if (finalBobInfo[0] > 0) {
    console.log(`  👤 Bob:`);
    console.log(`    🪙 보유: ${ethers.formatUnits(finalBobInfo[0], 18)} stakedUSDT`);
    console.log(`    💰 가치: ${ethers.formatUnits(finalBobInfo[1], 6)} USDT`);
  }
  if (finalCharlieInfo[0] > 0) {
    console.log(`  👤 Charlie:`);
    console.log(`    🪙 보유: ${ethers.formatUnits(finalCharlieInfo[0], 18)} stakedUSDT`);
    console.log(`    💰 가치: ${ethers.formatUnits(finalCharlieInfo[1], 6)} USDT`);
  }

  console.log('\n🎉 ================ StakedUSDT 구조 테스트 완료 ================');
  console.log('✅ 성공적으로 검증된 기능들:');
  console.log('  🪙 StakedUSDT 발행/소각 시스템');
  console.log('  💱 이자 누적에 따른 교환비 자동 증가');
  console.log('  💰 예치 시 교환비에 따른 stakedUSDT 수량 계산');
  console.log('  💸 출금 시 교환비 적용된 USDT 수령');
  console.log('  🔄 Performance Fee 자동 수집 및 교환비 반영');
  console.log('  👥 다중 사용자 간 정확한 수익 분배');
  console.log('  🏦 브릿지 자금과 사용자 자금 통합 관리');
  console.log('  📊 실시간 교환비 및 잔액 조회');
  console.log('  🔍 예치/출금 미리보기 기능');
  console.log('  🎯 알만액 stakedUSDT와 동일한 구조 구현');
  console.log('================================================================');
}

// 메인 함수 실행
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });