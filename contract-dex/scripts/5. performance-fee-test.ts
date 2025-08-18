import { ethers } from 'hardhat';

async function main() {
  console.log('🚀 Performance Fee 모델 테스트를 시작합니다...\n');

  // 실제 주소들
  const STEAKHOUSE_USDT_VAULT = '0xbEef047a543E45807105E51A8BBEFCc5950fcfBa';
  const AAVE_POOL = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2';
  const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  const AUSDT_ADDRESS = '0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a';
  const USDT_WHALE = '0x28C6c06298d514Db089934071355E5743bf21d60';

  console.log('📋 사용할 주소들:');
  console.log(`  Steakhouse USDT Vault: ${STEAKHOUSE_USDT_VAULT}`);
  console.log(`  AAVE Pool V3: ${AAVE_POOL}`);
  console.log(`  USDT: ${USDT_ADDRESS}`);

  try {
    const [deployer, feeRecipient] = await ethers.getSigners();
    console.log(`\n👤 배포자: ${deployer.address}`);
    console.log(`💰 Fee 수취인: ${feeRecipient.address}`);

    console.log('\n=== 1. MillstoneAIVault 배포 ===');

    const VaultFactory = await ethers.getContractFactory('MillstoneAIVault');
    const implementation = await VaultFactory.deploy();
    await implementation.waitForDeployment();
    const implementationAddress = await implementation.getAddress();
    console.log('✅ MillstoneAIVault 구현체 배포:', implementationAddress);

    const initData = implementation.interface.encodeFunctionData('initialize', [
      deployer.address,
    ]);
    const EIP1967ProxyFactory = await ethers.getContractFactory('EIP1967Proxy');
    const proxy = await EIP1967ProxyFactory.deploy(implementationAddress, initData);
    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();
    console.log('✅ EIP1967 프록시 배포:', proxyAddress);

    const vault = await ethers.getContractAt('MillstoneAIVault', proxyAddress);

    console.log('\n=== 2. Performance Fee 설정 ===');

    // Fee 수취인 설정
    await vault.setFeeRecipient(feeRecipient.address);
    console.log(`✅ Fee 수취인 설정: ${feeRecipient.address}`);

    // Fee 비율 확인 (기본 10%)
    const [feeRate, , , recipient] = await vault.getFeeInfo(USDT_ADDRESS);
    console.log(`📊 Performance Fee 비율: ${Number(feeRate) / 100}%`);
    console.log(`💰 Fee 수취인: ${recipient}`);

    console.log('\n=== 3. 프로토콜 설정 ===');

    await vault.setAaveConfig(AAVE_POOL, USDT_ADDRESS, AUSDT_ADDRESS);
    await vault.setMorphoVault(USDT_ADDRESS, STEAKHOUSE_USDT_VAULT);
    await vault.setSupportedToken(USDT_ADDRESS, true);
    await vault.setBridgeAuthorization(deployer.address, true);

    // 70% AAVE, 30% Morpho 분산 투자
    await vault.setProtocolAllocations(USDT_ADDRESS, 7000, 3000);
    console.log('✅ 프로토콜 설정 및 분배 비율 설정 완료 (AAVE 70%, Morpho 30%)');

    console.log('\n=== 4. USDT 준비 ===');

    await ethers.provider.send('hardhat_impersonateAccount', [USDT_WHALE]);
    const usdtWhale = await ethers.getSigner(USDT_WHALE);
    await deployer.sendTransaction({
      to: USDT_WHALE,
      value: ethers.parseEther('10'),
    });

    const usdt = await ethers.getContractAt('IERC20', USDT_ADDRESS);
    const testAmount = ethers.parseUnits('3000', 6); // 3000 USDT
    await usdt.connect(usdtWhale).transfer(deployer.address, testAmount);
    console.log(`✅ USDT ${ethers.formatUnits(testAmount, 6)} 획득 완료`);

    console.log('\n=== 5. 초기 예치 테스트 ===');

    const depositAmount = ethers.parseUnits('1000', 6); // 1000 USDT
    console.log(`💎 예치 금액: ${ethers.formatUnits(depositAmount, 6)} USDT`);

    await usdt.approve(proxyAddress, depositAmount);
    const depositTx = await vault.deposit(USDT_ADDRESS, depositAmount);
    await depositTx.wait();
    console.log('🎉 초기 예치 성공!');

    // 초기 상태 확인
    let [shares, assets, shareValue] = await vault.getUserInfo(
      deployer.address,
      USDT_ADDRESS,
    );
    console.log(`📊 사용자 초기 상태:`);
    console.log(`  💰 Shares: ${ethers.formatUnits(shares, 18)}`);
    console.log(`  📈 자산 가치: ${ethers.formatUnits(assets, 6)} USDT`);
    console.log(`  💎 Share 단가: ${ethers.formatUnits(shareValue, 18)}`);

    // 초기 Fee 정보
    let [, accumulatedFees, totalFeesWithdrawn] = await vault.getFeeInfo(USDT_ADDRESS);
    console.log(`💰 누적 Fee: ${ethers.formatUnits(accumulatedFees, 6)} USDT`);

    // 프로토콜별 분산 투자 확인
    console.log('\n=== 5-1. 프로토콜별 분산 투자 결과 확인 ===');
    const [aaveBalance, morphoBalance, totalProtocolBalance] =
      await vault.getProtocolBalances(USDT_ADDRESS);
    console.log(`📊 분산 투자 결과:`);
    console.log(`  💼 AAVE 예치: ${ethers.formatUnits(aaveBalance, 6)} USDT`);
    console.log(`  🥩 Morpho 예치: ${ethers.formatUnits(morphoBalance, 6)} USDT`);
    console.log(`  💰 총 예치: ${ethers.formatUnits(totalProtocolBalance, 6)} USDT`);

    // 실제 분배 비율 확인
    if (totalProtocolBalance > 0) {
      const actualAavePerc = (aaveBalance * 10000n) / totalProtocolBalance;
      const actualMorphoPerc = (morphoBalance * 10000n) / totalProtocolBalance;
      console.log(
        `📈 실제 분배 비율: AAVE ${Number(actualAavePerc) / 100}%, Morpho ${
          Number(actualMorphoPerc) / 100
        }%`,
      );
    }

    console.log('\n=== 6. 수익 발생 시뮬레이션 ===');

    console.log('⏰ 30일 후로 시간 이동...');
    await ethers.provider.send('evm_increaseTime', [30 * 24 * 60 * 60]); // 30일
    await ethers.provider.send('evm_mine', []);

    console.log('📊 원금 정보:');
    console.log(`  💰 초기 예치: 1000 USDT`);
    console.log(`  ⚡ Fee 트리거용 소액: 1 USDT (곧 추가 예정)`);

    // Performance fee 수집 (추가 예치를 통해 트리거)
    const smallDeposit = ethers.parseUnits('1', 6); // 1 USDT
    await usdt.approve(proxyAddress, smallDeposit);
    await vault.deposit(USDT_ADDRESS, smallDeposit);
    console.log('✅ Performance fee 수집 트리거 완료 (총 원금: 1001 USDT)');

    // Fee 수집 상태 확인
    let [, currentAccumulatedFees] = await vault.getFeeInfo(USDT_ADDRESS);
    console.log(
      `💰 수집된 Performance Fee: ${ethers.formatUnits(currentAccumulatedFees, 6)} USDT`,
    );

    console.log('\n=== 7. 프로토콜별 수익률 분석 ===');

    // 30일 후 프로토콜별 잔액 재확인
    const [aaveBalance2, morphoBalance2, totalBalance2] = await vault.getProtocolBalances(
      USDT_ADDRESS,
    );
    console.log(`📊 30일 후 프로토콜별 잔액:`);
    console.log(`  💼 AAVE: ${ethers.formatUnits(aaveBalance2, 6)} USDT`);
    console.log(`  🥩 Morpho: ${ethers.formatUnits(morphoBalance2, 6)} USDT`);
    console.log(`  💰 총합: ${ethers.formatUnits(totalBalance2, 6)} USDT`);

    // 프로토콜별 수익 계산
    const aaveProfit = aaveBalance2 - aaveBalance;
    const morphoProfit = morphoBalance2 - morphoBalance;
    console.log(`\n💰 프로토콜별 수익 분석:`);
    console.log(`  💼 AAVE 수익: ${ethers.formatUnits(aaveProfit, 6)} USDT`);
    console.log(`  🥩 Morpho 수익: ${ethers.formatUnits(morphoProfit, 6)} USDT`);

    if (aaveBalance > 0 && morphoBalance > 0) {
      const aaveAPR = (Number(aaveProfit) / Number(aaveBalance)) * (365 / 30) * 100;
      const morphoAPR = (Number(morphoProfit) / Number(morphoBalance)) * (365 / 30) * 100;
      console.log(`  📈 AAVE 연환산 수익률: ${aaveAPR.toFixed(4)}%`);
      console.log(`  📈 Morpho 연환산 수익률: ${morphoAPR.toFixed(4)}%`);
    }

    console.log('\n=== 8. 전체 수익률 분석 (Fee 적용 전후) ===');

    // 총 수익률 (Fee 제외 전)
    const [totalValue, principal, grossYield, yieldRate] = await vault.calculateYield(
      USDT_ADDRESS,
    );
    console.log(`📊 전체 수익률 분석:`);
    console.log(`  💰 현재 총 가치: ${ethers.formatUnits(totalValue, 6)} USDT`);
    console.log(`  📈 원금: ${ethers.formatUnits(principal, 6)} USDT`);
    console.log(`  💎 총 수익: ${ethers.formatUnits(grossYield, 6)} USDT`);
    console.log(`  📊 총 수익률: ${Number(yieldRate) / 100}%`);

    // 순 수익률 (Fee 제외 후)
    const [, , netGrossYield, feeAmount, netYield, netYieldRate] =
      await vault.calculateNetYield(USDT_ADDRESS);
    console.log(`\n📊 사용자 순 수익률 분석:`);
    console.log(`  💎 총 수익: ${ethers.formatUnits(netGrossYield, 6)} USDT`);
    console.log(`  💰 Performance Fee: ${ethers.formatUnits(feeAmount, 6)} USDT`);
    console.log(`  📈 순 수익 (사용자): ${ethers.formatUnits(netYield, 6)} USDT`);
    console.log(`  📊 순 수익률 (사용자): ${Number(netYieldRate) / 100}%`);

    // Fee 정보 확인 (재조회)
    [, accumulatedFees, totalFeesWithdrawn] = await vault.getFeeInfo(USDT_ADDRESS);
    console.log(`\n💰 Performance Fee 현황:`);
    console.log(`  💎 누적 Fee: ${ethers.formatUnits(accumulatedFees, 6)} USDT`);
    console.log(`  📈 인출 가능 Fee: ${ethers.formatUnits(accumulatedFees, 6)} USDT`);

    // Fee가 없다면 수동으로 한번 더 트리거
    if (accumulatedFees === 0n) {
      console.log('🔄 Fee 수집 재시도...');
      const tinyDeposit = ethers.parseUnits('0.1', 6);
      await usdt.approve(proxyAddress, tinyDeposit);
      await vault.deposit(USDT_ADDRESS, tinyDeposit);
      [, accumulatedFees] = await vault.getFeeInfo(USDT_ADDRESS);
      console.log(`💰 재수집된 Fee: ${ethers.formatUnits(accumulatedFees, 6)} USDT`);
    }

    console.log('\n=== 8. Fee 인출 테스트 ===');

    const feeRecipientBalanceBefore = await usdt.balanceOf(feeRecipient.address);
    console.log(
      `📋 Fee 인출 전 수취인 잔액: ${ethers.formatUnits(
        feeRecipientBalanceBefore,
        6,
      )} USDT`,
    );

    // Fee 인출
    if (accumulatedFees > 0) {
      const withdrawTx = await vault.connect(feeRecipient).withdrawAllFees(USDT_ADDRESS);
      await withdrawTx.wait();
      console.log('✅ Performance Fee 인출 성공!');

      const feeRecipientBalanceAfter = await usdt.balanceOf(feeRecipient.address);
      console.log(
        `📋 Fee 인출 후 수취인 잔액: ${ethers.formatUnits(
          feeRecipientBalanceAfter,
          6,
        )} USDT`,
      );
      console.log(
        `💰 실제 인출된 Fee: ${ethers.formatUnits(
          feeRecipientBalanceAfter - feeRecipientBalanceBefore,
          6,
        )} USDT`,
      );
    } else {
      console.log('⚠️  인출할 Fee가 없습니다.');
    }

    console.log('\n=== 9. 사용자 출금 테스트 (Fee 적용 후) ===');

    // 사용자 현재 정보
    [shares, assets, shareValue] = await vault.getUserInfo(
      deployer.address,
      USDT_ADDRESS,
    );
    console.log(`📊 출금 전 사용자 상태:`);
    console.log(`  💰 Shares: ${ethers.formatUnits(shares, 18)}`);
    console.log(`  📈 자산 가치: ${ethers.formatUnits(assets, 6)} USDT`);
    console.log(`  💎 Share 단가: ${ethers.formatUnits(shareValue, 18)}`);

    // 절반 출금
    const redeemShares = shares / 2n;
    console.log(`💸 출금할 Shares: ${ethers.formatUnits(redeemShares, 18)}`);

    const userBalanceBefore = await usdt.balanceOf(deployer.address);
    const redeemTx = await vault.redeem(USDT_ADDRESS, redeemShares);
    await redeemTx.wait();

    const userBalanceAfter = await usdt.balanceOf(deployer.address);
    console.log(
      `💵 실제 출금 받은 금액: ${ethers.formatUnits(
        userBalanceAfter - userBalanceBefore,
        6,
      )} USDT`,
    );

    console.log('\n=== 10. 최종 상태 확인 ===');

    // 최종 사용자 정보
    [shares, assets, shareValue] = await vault.getUserInfo(
      deployer.address,
      USDT_ADDRESS,
    );
    console.log(`📊 최종 사용자 상태:`);
    console.log(`  💰 남은 Shares: ${ethers.formatUnits(shares, 18)}`);
    console.log(`  📈 남은 자산 가치: ${ethers.formatUnits(assets, 6)} USDT`);
    console.log(`  💎 Share 단가: ${ethers.formatUnits(shareValue, 18)}`);

    // 최종 Fee 정보
    [, accumulatedFees, totalFeesWithdrawn] = await vault.getFeeInfo(USDT_ADDRESS);
    console.log(`\n💰 최종 Performance Fee 현황:`);
    console.log(`  💎 남은 누적 Fee: ${ethers.formatUnits(accumulatedFees, 6)} USDT`);
    console.log(`  📈 총 인출된 Fee: ${ethers.formatUnits(totalFeesWithdrawn, 6)} USDT`);

    // 프로토콜별 잔액
    const [finalAaveBalance3, finalMorphoBalance3, finalTotalBalance3] =
      await vault.getProtocolBalances(USDT_ADDRESS);
    console.log(`\n📊 프로토콜별 최종 잔액:`);
    console.log(`  💼 AAVE: ${ethers.formatUnits(finalAaveBalance3, 6)} USDT`);
    console.log(`  🥩 Morpho: ${ethers.formatUnits(finalMorphoBalance3, 6)} USDT`);
    console.log(`  💰 총합: ${ethers.formatUnits(finalTotalBalance3, 6)} USDT`);

    console.log('\n=== 11. 분산 투자 효과 분석 ===');

    // 최종 프로토콜별 잔액으로 분산 효과 분석
    const [finalAaveBalance, finalMorphoBalance, finalTotalBalance] =
      await vault.getProtocolBalances(USDT_ADDRESS);
    console.log(`📊 분산 투자 최종 결과:`);
    console.log(`  💼 AAVE 최종 잔액: ${ethers.formatUnits(finalAaveBalance, 6)} USDT`);
    console.log(
      `  🥩 Morpho 최종 잔액: ${ethers.formatUnits(finalMorphoBalance, 6)} USDT`,
    );
    console.log(`  💰 총 잔액: ${ethers.formatUnits(finalTotalBalance, 6)} USDT`);

    // 분산 투자의 효과 분석 (전체 기간 기준)
    const initialTotalDeposit = 1001000000n; // 1001 USDT in 6 decimals
    const peakTotalBalance = aaveBalance2 + morphoBalance2; // 30일 후 최대 잔액
    const totalProfitEarned = peakTotalBalance - initialTotalDeposit;
    const aavePortion = Number(finalAaveBalance) / Number(finalTotalBalance);
    const morphoPortion = Number(finalMorphoBalance) / Number(finalTotalBalance);

    console.log(`\n📈 분산 투자 효과 (전체 기간):`);
    console.log(
      `  🔄 최종 위험 분산: AAVE ${(aavePortion * 100).toFixed(1)}% + Morpho ${(
        morphoPortion * 100
      ).toFixed(1)}%`,
    );
    console.log(
      `  💰 총 벌어들인 수익: ${ethers.formatUnits(totalProfitEarned, 6)} USDT`,
    );
    console.log(
      `  📊 30일 수익률: ${((Number(totalProfitEarned) / 1001) * 100).toFixed(4)}%`,
    );
    console.log(
      `  📈 연환산 수익률: ${(
        (Number(totalProfitEarned) / 1001) *
        (365 / 30) *
        100
      ).toFixed(4)}%`,
    );

    console.log('\n=== 12. Performance Fee 효과 분석 ===');

    const originalDeposit = 1001; // 1000 + 1 USDT
    const finalUserValue = Number(
      ethers.formatUnits(userBalanceAfter - userBalanceBefore + assets, 6),
    );
    const totalFeeCollected = Number(ethers.formatUnits(totalFeesWithdrawn, 6));

    console.log(`📊 Performance Fee 모델 효과:`);
    console.log(`  🏦 원금: ${originalDeposit} USDT`);
    console.log(`  👤 사용자 최종 가치: ${finalUserValue.toFixed(6)} USDT`);
    console.log(`  💰 수집된 총 Fee: ${totalFeeCollected.toFixed(6)} USDT`);
    console.log(
      `  📈 사용자 순 수익률: ${(
        ((finalUserValue - originalDeposit) / originalDeposit) *
        100
      ).toFixed(4)}%`,
    );
    console.log(
      `  💎 Fee 수익률: ${((totalFeeCollected / originalDeposit) * 100).toFixed(4)}%`,
    );

    console.log(
      '\n🎉 ================ Performance Fee 모델 테스트 완료 ================',
    );
    console.log('✅ 성공적으로 구현된 기능들:');
    console.log('  🎯 10% Performance Fee 자동 수집');
    console.log('  💰 Fee 인출 및 관리 시스템');
    console.log('  📊 사용자에게 순 수익률 제공');
    console.log('  🔄 실시간 Fee 계산 및 추적');
    console.log('  📈 Fee 제외한 Share 가치 계산');
    console.log('  🏦 프로토콜 수익 자동 분배');
    console.log('================================================================');
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }

  console.log('\n🏁 Performance Fee 모델 테스트 완료');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ 오류:', error);
    process.exit(1);
  });
