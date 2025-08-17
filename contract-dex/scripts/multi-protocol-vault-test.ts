import { ethers } from 'hardhat';

async function main() {
  console.log('🚀 다중 프로토콜 분산 투자 시스템 테스트를 시작합니다...\n');

  // 컨트랙트 주소들
  const STEAKHOUSE_USDT_VAULT = '0xbEef047a543E45807105E51A8BBEFCc5950fcfBa';
  const AAVE_POOL = '0x87870Bcd4b08fE6C4fE3cf1dC9893B23fbC8b83d'; // Mainnet AAVE Pool V3
  const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  const AUSDT_ADDRESS = '0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a'; // aUSDT token
  const USDT_WHALE = '0x28C6c06298d514Db089934071355E5743bf21d60'; // Binance 14

  console.log('📋 사용할 주소들:');
  console.log(`  Steakhouse USDT Vault: ${STEAKHOUSE_USDT_VAULT}`);
  console.log(`  AAVE Pool V3: ${AAVE_POOL}`);
  console.log(`  USDT: ${USDT_ADDRESS}`);
  console.log(`  aUSDT: ${AUSDT_ADDRESS}`);

  try {
    const [deployer] = await ethers.getSigners();
    console.log(`\n👤 테스트 계정: ${deployer.address}`);

    console.log('\n=== 1. MillstoneAIVault 배포 ===');
    
    // MillstoneAIVault 배포
    const MillstoneAIVaultFactory = await ethers.getContractFactory('MillstoneAIVault');
    const implementation = await MillstoneAIVaultFactory.deploy();
    await implementation.waitForDeployment();
    const implementationAddress = await implementation.getAddress();
    console.log('✅ MillstoneAIVault 구현체 배포:', implementationAddress);

    // EIP1967 프록시 배포
    const initData = implementation.interface.encodeFunctionData('initialize', [
      deployer.address,
    ]);
    const EIP1967ProxyFactory = await ethers.getContractFactory('EIP1967Proxy');
    const proxy = await EIP1967ProxyFactory.deploy(implementationAddress, initData);
    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();
    console.log('✅ EIP1967 프록시 배포:', proxyAddress);

    const vault = await ethers.getContractAt('MillstoneAIVault', proxyAddress);

    console.log('\n=== 2. 다중 프로토콜 설정 ===');
    
    // AAVE 설정
    await vault.setAavePool(AAVE_POOL);
    await vault.setATokenMapping(USDT_ADDRESS, AUSDT_ADDRESS);
    await vault.toggleAaveMode(true);
    console.log('✅ AAVE 설정 완료');

    // Morpho (Steakhouse) 설정
    await vault.setMorphoVault(USDT_ADDRESS, STEAKHOUSE_USDT_VAULT);
    await vault.toggleDirectMorphoVaultMode(true);
    console.log('✅ Morpho (Steakhouse) 설정 완료');

    // 토큰 지원 및 기본 분배 비율 설정 (50:50)
    await vault.setSupportedToken(USDT_ADDRESS, true);
    console.log('✅ USDT 토큰 지원 설정 (기본 50:50 분배)');

    // Bridge 권한 설정
    await vault.setBridgeAuthorization(deployer.address, true);
    console.log('✅ Bridge 권한 설정 완료');

    console.log('\n=== 3. USDT 준비 ===');
    
    // USDT whale에서 토큰 획득
    await ethers.provider.send('hardhat_impersonateAccount', [USDT_WHALE]);
    const usdtWhale = await ethers.getSigner(USDT_WHALE);

    // Whale에게 ETH 충전
    await deployer.sendTransaction({
      to: USDT_WHALE,
      value: ethers.parseEther('10'),
    });

    const usdt = await ethers.getContractAt('IERC20', USDT_ADDRESS);
    const testAmount = ethers.parseUnits('2000', 6); // 2000 USDT

    await usdt.connect(usdtWhale).transfer(deployer.address, testAmount);
    console.log(`✅ USDT ${ethers.formatUnits(testAmount, 6)} 획득 완료`);

    console.log('\n=== 4. 분배 비율 설정 테스트 ===');
    
    // 70% AAVE, 30% Morpho로 설정
    await vault.setProtocolAllocations(USDT_ADDRESS, 7000, 3000);
    console.log('✅ 분배 비율 설정: AAVE 70%, Morpho 30%');

    const [aaveAlloc, morphoAlloc] = await vault.getProtocolAllocations(USDT_ADDRESS);
    console.log(`📊 현재 분배 설정: AAVE ${aaveAlloc/100}%, Morpho ${morphoAlloc/100}%`);

    console.log('\n=== 5. Yield-Bearing Token 예치 테스트 ===');
    
    const depositAmount = ethers.parseUnits('1000', 6); // 1000 USDT
    console.log(`💎 예치 금액: ${ethers.formatUnits(depositAmount, 6)} USDT`);

    // 사용자 잔액 확인
    const beforeBalance = await usdt.balanceOf(deployer.address);
    console.log(`📋 예치 전 USDT 잔액: ${ethers.formatUnits(beforeBalance, 6)} USDT`);

    // USDT approve
    await usdt.approve(proxyAddress, depositAmount);
    console.log('✅ USDT approve 완료');

    // Yield-bearing token 예치
    const depositTx = await vault.deposit(USDT_ADDRESS, depositAmount);
    await depositTx.wait();
    console.log('🎉 Yield-bearing token 예치 성공!');

    // 예치 후 잔액 확인
    const afterBalance = await usdt.balanceOf(deployer.address);
    console.log(`📋 예치 후 USDT 잔액: ${ethers.formatUnits(afterBalance, 6)} USDT`);
    console.log(`📊 실제 예치된 금액: ${ethers.formatUnits(beforeBalance - afterBalance, 6)} USDT`);

    console.log('\n=== 6. 프로토콜별 분배 확인 ===');
    
    const [aaveBalance, morphoBalance, totalProtocolBalance] = await vault.getProtocolBalances(USDT_ADDRESS);
    console.log(`📊 프로토콜별 분배 결과:`);
    console.log(`  💼 AAVE 예치: ${ethers.formatUnits(aaveBalance, 6)} USDT`);
    console.log(`  🥩 Morpho 예치: ${ethers.formatUnits(morphoBalance, 6)} USDT`);
    console.log(`  💰 총 프로토콜 예치: ${ethers.formatUnits(totalProtocolBalance, 6)} USDT`);

    // 실제 분배 비율 확인
    const [actualAavePerc, actualMorphoPerc] = await vault.getCurrentAllocationRatio(USDT_ADDRESS);
    console.log(`📈 실제 분배 비율: AAVE ${actualAavePerc/100}%, Morpho ${actualMorphoPerc/100}%`);

    // Shares 정보 확인
    const totalShares = await vault.totalSupply(USDT_ADDRESS);
    const shareValue = await vault.shareValue(USDT_ADDRESS);
    console.log(`\n📊 Yield-bearing Token 정보:`);
    console.log(`  💰 총 Shares 발행: ${ethers.formatUnits(totalShares, 18)}`);
    console.log(`  📈 Share 가치: ${ethers.formatUnits(shareValue, 18)} (1e18 = 1:1 비율)`);

    console.log('\n=== 7. 시간 경과 후 수익 확인 ===');
    
    console.log('⏰ 7일 후로 시간 이동...');
    await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]); // 7일
    await ethers.provider.send('evm_mine', []);

    // 수익률 계산 및 APY 업데이트
    const apyTx = await vault.calculateAndUpdateAPY(USDT_ADDRESS);
    await apyTx.wait();
    console.log('✅ APY 계산 및 업데이트 완료');

    const [totalValue, principal, yieldAmount, yieldRate] = await vault.calculateYield(USDT_ADDRESS);
    console.log(`\n📊 수익률 분석:`);
    console.log(`  💰 현재 총 가치: ${ethers.formatUnits(totalValue, 6)} USDT`);
    console.log(`  📈 원금: ${ethers.formatUnits(principal, 6)} USDT`);
    console.log(`  💎 수익: ${ethers.formatUnits(yieldAmount, 6)} USDT`);
    console.log(`  📊 수익률: ${yieldRate/100}%`);

    const [latestAPY, timestamp] = await vault.getLatestAPY(USDT_ADDRESS);
    console.log(`  🎯 연간 수익률 (APY): ${latestAPY/100}%`);

    // 7일 후 프로토콜별 잔액 재확인
    const [aaveBalance2, morphoBalance2, totalBalance2] = await vault.getProtocolBalances(USDT_ADDRESS);
    console.log(`\n📊 7일 후 프로토콜별 잔액:`);
    console.log(`  💼 AAVE: ${ethers.formatUnits(aaveBalance2, 6)} USDT`);
    console.log(`  🥩 Morpho: ${ethers.formatUnits(morphoBalance2, 6)} USDT`);
    console.log(`  💰 총합: ${ethers.formatUnits(totalBalance2, 6)} USDT`);

    // Share 가치 변화 확인
    const newShareValue = await vault.shareValue(USDT_ADDRESS);
    console.log(`📈 새로운 Share 가치: ${ethers.formatUnits(newShareValue, 18)}`);
    const valueIncrease = ((Number(newShareValue) - Number(shareValue)) / Number(shareValue)) * 100;
    console.log(`📊 Share 가치 증가율: ${valueIncrease.toFixed(4)}%`);

    console.log('\n=== 8. 분배 비율 변경 테스트 ===');
    
    // 30% AAVE, 70% Morpho로 변경
    await vault.setProtocolAllocations(USDT_ADDRESS, 3000, 7000);
    console.log('✅ 분배 비율 변경: AAVE 30%, Morpho 70%');

    // Rebalance 실행
    const rebalanceTx = await vault.rebalanceProtocols(USDT_ADDRESS);
    await rebalanceTx.wait();
    console.log('🔄 프로토콜 간 자산 재분배 완료');

    // 재분배 후 잔액 확인
    const [aaveBalance3, morphoBalance3, totalBalance3] = await vault.getProtocolBalances(USDT_ADDRESS);
    console.log(`\n📊 재분배 후 프로토콜별 잔액:`);
    console.log(`  💼 AAVE: ${ethers.formatUnits(aaveBalance3, 6)} USDT`);
    console.log(`  🥩 Morpho: ${ethers.formatUnits(morphoBalance3, 6)} USDT`);
    console.log(`  💰 총합: ${ethers.formatUnits(totalBalance3, 6)} USDT`);

    const [newAavePerc, newMorphoPerc] = await vault.getCurrentAllocationRatio(USDT_ADDRESS);
    console.log(`📈 재분배 후 실제 비율: AAVE ${newAavePerc/100}%, Morpho ${newMorphoPerc/100}%`);

    console.log('\n=== 9. Yield-Bearing Token 출금 테스트 ===');
    
    const redeemShares = ethers.parseUnits('500', 18); // 500 shares 출금
    console.log(`💸 출금할 Shares: ${ethers.formatUnits(redeemShares, 18)}`);

    // 출금 전 잔액
    const beforeRedeemBalance = await usdt.balanceOf(deployer.address);
    console.log(`📋 출금 전 사용자 잔액: ${ethers.formatUnits(beforeRedeemBalance, 6)} USDT`);

    // Shares로 출금
    const redeemTx = await vault.redeem(USDT_ADDRESS, redeemShares);
    await redeemTx.wait();
    console.log('🎉 Yield-bearing token 출금 성공!');

    // 출금 후 잔액
    const afterRedeemBalance = await usdt.balanceOf(deployer.address);
    console.log(`📋 출금 후 사용자 잔액: ${ethers.formatUnits(afterRedeemBalance, 6)} USDT`);
    console.log(`💵 실제 출금 받은 금액: ${ethers.formatUnits(afterRedeemBalance - beforeRedeemBalance, 6)} USDT`);

    // 최종 vault 상태 확인
    const finalTotalShares = await vault.totalSupply(USDT_ADDRESS);
    const finalShareValue = await vault.shareValue(USDT_ADDRESS);
    console.log(`\n📊 최종 Vault 상태:`);
    console.log(`  💰 남은 총 Shares: ${ethers.formatUnits(finalTotalShares, 18)}`);
    console.log(`  📈 Share 가치: ${ethers.formatUnits(finalShareValue, 18)}`);

    console.log('\n=== 10. 종합 통계 ===');
    
    const [deposited, withdrawn, netDeposited, totalSharesSupply, currentShareValue] = await vault.getTokenStats(USDT_ADDRESS);
    console.log(`📊 USDT 토큰 통계:`);
    console.log(`  💎 총 예치: ${ethers.formatUnits(deposited, 6)} USDT`);
    console.log(`  💸 총 출금: ${ethers.formatUnits(withdrawn, 6)} USDT`);
    console.log(`  📈 순 예치: ${ethers.formatUnits(netDeposited, 6)} USDT`);
    console.log(`  🎯 총 Shares: ${ethers.formatUnits(totalSharesSupply, 18)}`);
    console.log(`  💰 Share 가치: ${ethers.formatUnits(currentShareValue, 18)}`);

    // APY 히스토리 확인
    const apyHistory = await vault.getAPYHistory(USDT_ADDRESS, 5);
    console.log(`\n📈 APY 히스토리 (최근 ${apyHistory.length}개):`);
    for (let i = 0; i < apyHistory.length; i++) {
      const snapshot = apyHistory[i];
      console.log(`  ${i+1}. APY: ${snapshot.apy/100}%, 시간: ${new Date(Number(snapshot.timestamp) * 1000).toLocaleString()}`);
    }

    console.log('\n=== 11. 테스트 완료 ===');
    console.log('🎉 ============== 다중 프로토콜 분산 투자 시스템 테스트 완료 ==============');
    console.log('✅ 구현된 주요 기능들:');
    console.log('  🔄 프로토콜 분배 비율 설정 및 자동 분배');
    console.log('  💰 Yield-bearing token (shares) 시스템');
    console.log('  📈 실시간 APY 계산 및 추적');
    console.log('  🔀 프로토콜 간 자산 재분배 (Rebalancing)');
    console.log('  📊 상세한 수익률 및 통계 추적');
    console.log('  🎯 AAVE와 Morpho 동시 활용으로 위험 분산');
    console.log('===============================================================');

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }

  console.log('\n🏁 다중 프로토콜 분산 투자 시스템 테스트 완료');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ 오류:', error);
    process.exit(1);
  });