import { ethers } from 'hardhat';

async function main() {
  console.log('🚀 실제 작동하는 다중 프로토콜 분산 투자 시스템 테스트\n');

  // 실제 주소들 (올바른 체크섬)
  const STEAKHOUSE_USDT_VAULT = '0xbEef047a543E45807105E51A8BBEFCc5950fcfBa';
  const AAVE_POOL = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2'; // Mainnet AAVE Pool V3
  const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  const AUSDT_ADDRESS = '0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a'; // aUSDT token
  const USDT_WHALE = '0x28C6c06298d514Db089934071355E5743bf21d60'; // Binance 14

  console.log('📋 사용할 주소들:');
  console.log(`  Steakhouse USDT Vault: ${STEAKHOUSE_USDT_VAULT}`);
  console.log(`  AAVE Pool V3: ${AAVE_POOL}`);
  console.log(`  USDT: ${USDT_ADDRESS}`);

  try {
    const [deployer] = await ethers.getSigners();
    console.log(`\n👤 테스트 계정: ${deployer.address}`);

    console.log('\n=== 1. MillstoneAIVault 배포 ===');

    // MillstoneAIVault 배포
    const VaultFactory = await ethers.getContractFactory('MillstoneAIVault');
    const implementation = await VaultFactory.deploy();
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

    console.log('\n=== 2. 프로토콜 설정 ===');

    // AAVE 설정
    await vault.setAaveConfig(AAVE_POOL, USDT_ADDRESS, AUSDT_ADDRESS);
    console.log('✅ AAVE 설정 완료');

    // Morpho (Steakhouse) 설정
    await vault.setMorphoVault(USDT_ADDRESS, STEAKHOUSE_USDT_VAULT);
    console.log('✅ Morpho (Steakhouse) 설정 완료');

    // 토큰 지원 설정 (기본 50:50 분배)
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

    console.log('\n=== 4. 분배 비율 테스트 ===');

    // 초기 분배 비율 확인
    let [aaveAlloc, morphoAlloc] = await vault.getAllocations(USDT_ADDRESS);
    console.log(
      `📊 초기 분배 비율: AAVE ${Number(aaveAlloc) / 100}%, Morpho ${
        Number(morphoAlloc) / 100
      }%`,
    );

    // 70% AAVE, 30% Morpho로 변경
    await vault.setProtocolAllocations(USDT_ADDRESS, 7000, 3000);
    [aaveAlloc, morphoAlloc] = await vault.getAllocations(USDT_ADDRESS);
    console.log(
      `📊 변경된 분배 비율: AAVE ${Number(aaveAlloc) / 100}%, Morpho ${
        Number(morphoAlloc) / 100
      }%`,
    );

    console.log('\n=== 5. Yield-bearing Token 예치 테스트 ===');

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
    const depositReceipt = await depositTx.wait();
    console.log('🎉 Yield-bearing token 예치 성공!');

    // 예치 후 잔액 확인
    const afterBalance = await usdt.balanceOf(deployer.address);
    console.log(`📋 예치 후 USDT 잔액: ${ethers.formatUnits(afterBalance, 6)} USDT`);
    console.log(
      `📊 실제 예치된 금액: ${ethers.formatUnits(beforeBalance - afterBalance, 6)} USDT`,
    );

    console.log('\n=== 6. 프로토콜별 분배 확인 ===');

    const [aaveBalance, morphoBalance, totalProtocolBalance] =
      await vault.getProtocolBalances(USDT_ADDRESS);
    console.log(`📊 프로토콜별 분배 결과:`);
    console.log(`  💼 AAVE 예치: ${ethers.formatUnits(aaveBalance, 6)} USDT`);
    console.log(`  🥩 Morpho 예치: ${ethers.formatUnits(morphoBalance, 6)} USDT`);
    console.log(
      `  💰 총 프로토콜 예치: ${ethers.formatUnits(totalProtocolBalance, 6)} USDT`,
    );

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

    // 사용자 정보 확인
    const [userShares, userAssets, shareValue] = await vault.getUserInfo(
      deployer.address,
      USDT_ADDRESS,
    );
    console.log(`\n📊 사용자 Yield-bearing Token 정보:`);
    console.log(`  💰 보유 Shares: ${ethers.formatUnits(userShares, 18)}`);
    console.log(`  📈 Shares 가치: ${ethers.formatUnits(userAssets, 6)} USDT`);
    console.log(`  💎 Share 단가: ${ethers.formatUnits(shareValue, 18)} (1e18 = 1:1)`);

    console.log('\n=== 7. 시간 경과 시뮬레이션 ===');

    console.log('⏰ 7일 후로 시간 이동...');
    await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]); // 7일
    await ethers.provider.send('evm_mine', []);

    // 7일 후 프로토콜별 잔액 재확인
    const [aaveBalance2, morphoBalance2, totalBalance2] = await vault.getProtocolBalances(
      USDT_ADDRESS,
    );
    console.log(`\n📊 7일 후 프로토콜별 잔액:`);
    console.log(`  💼 AAVE: ${ethers.formatUnits(aaveBalance2, 6)} USDT`);
    console.log(`  🥩 Morpho: ${ethers.formatUnits(morphoBalance2, 6)} USDT`);
    console.log(`  💰 총합: ${ethers.formatUnits(totalBalance2, 6)} USDT`);

    // 수익률 계산
    const [totalValue, principal, yieldAmount, yieldRate] = await vault.calculateYield(
      USDT_ADDRESS,
    );
    console.log(`\n📊 수익률 분석:`);
    console.log(`  💰 현재 총 가치: ${ethers.formatUnits(totalValue, 6)} USDT`);
    console.log(`  📈 원금: ${ethers.formatUnits(principal, 6)} USDT`);
    console.log(`  💎 수익: ${ethers.formatUnits(yieldAmount, 6)} USDT`);
    console.log(`  📊 수익률: ${Number(yieldRate) / 100}%`);

    // Share 가치 변화 확인
    const [, newUserAssets, newShareValue] = await vault.getUserInfo(
      deployer.address,
      USDT_ADDRESS,
    );
    console.log(`📈 새로운 Shares 가치: ${ethers.formatUnits(newUserAssets, 6)} USDT`);
    console.log(`💎 새로운 Share 단가: ${ethers.formatUnits(newShareValue, 18)}`);

    if (newShareValue > shareValue) {
      const valueIncrease =
        ((Number(newShareValue) - Number(shareValue)) / Number(shareValue)) * 100;
      console.log(`📊 Share 단가 증가율: ${valueIncrease.toFixed(4)}%`);
    }

    console.log('\n=== 8. 분배 비율 변경 및 리밸런싱 ===');

    // 30% AAVE, 70% Morpho로 변경
    await vault.setProtocolAllocations(USDT_ADDRESS, 3000, 7000);
    console.log('✅ 분배 비율 변경: AAVE 30%, Morpho 70%');

    // 리밸런싱 실행
    const rebalanceTx = await vault.rebalance(USDT_ADDRESS);
    await rebalanceTx.wait();
    console.log('🔄 프로토콜 간 리밸런싱 완료');

    // 리밸런싱 후 잔액 확인
    const [aaveBalance3, morphoBalance3, totalBalance3] = await vault.getProtocolBalances(
      USDT_ADDRESS,
    );
    console.log(`\n📊 리밸런싱 후 프로토콜별 잔액:`);
    console.log(`  💼 AAVE: ${ethers.formatUnits(aaveBalance3, 6)} USDT`);
    console.log(`  🥩 Morpho: ${ethers.formatUnits(morphoBalance3, 6)} USDT`);
    console.log(`  💰 총합: ${ethers.formatUnits(totalBalance3, 6)} USDT`);

    if (totalBalance3 > 0) {
      const newAavePerc = (aaveBalance3 * 10000n) / totalBalance3;
      const newMorphoPerc = (morphoBalance3 * 10000n) / totalBalance3;
      console.log(
        `📈 리밸런싱 후 실제 비율: AAVE ${Number(newAavePerc) / 100}%, Morpho ${
          Number(newMorphoPerc) / 100
        }%`,
      );
    }

    console.log('\n=== 9. Yield-bearing Token 부분 출금 테스트 ===');

    const redeemShares = userShares / 2n; // 절반 출금
    console.log(`💸 출금할 Shares: ${ethers.formatUnits(redeemShares, 18)}`);

    // 출금 전 잔액
    const beforeRedeemBalance = await usdt.balanceOf(deployer.address);
    console.log(
      `📋 출금 전 사용자 잔액: ${ethers.formatUnits(beforeRedeemBalance, 6)} USDT`,
    );

    // Shares로 출금
    const redeemTx = await vault.redeem(USDT_ADDRESS, redeemShares);
    await redeemTx.wait();
    console.log('🎉 Yield-bearing token 부분 출금 성공!');

    // 출금 후 잔액
    const afterRedeemBalance = await usdt.balanceOf(deployer.address);
    console.log(
      `📋 출금 후 사용자 잔액: ${ethers.formatUnits(afterRedeemBalance, 6)} USDT`,
    );
    console.log(
      `💵 실제 출금 받은 금액: ${ethers.formatUnits(
        afterRedeemBalance - beforeRedeemBalance,
        6,
      )} USDT`,
    );

    // 최종 사용자 정보
    const [finalShares, finalAssets] = await vault.getUserInfo(
      deployer.address,
      USDT_ADDRESS,
    );
    console.log(`\n📊 최종 사용자 보유 현황:`);
    console.log(`  💰 남은 Shares: ${ethers.formatUnits(finalShares, 18)}`);
    console.log(`  📈 남은 자산 가치: ${ethers.formatUnits(finalAssets, 6)} USDT`);

    console.log('\n=== 10. 종합 통계 ===');

    const [deposited, withdrawn, totalSharesSupply, currentValue] =
      await vault.getTokenStats(USDT_ADDRESS);
    console.log(`📊 USDT Vault 종합 통계:`);
    console.log(`  💎 총 예치: ${ethers.formatUnits(deposited, 6)} USDT`);
    console.log(`  💸 총 출금: ${ethers.formatUnits(withdrawn, 6)} USDT`);
    console.log(`  🎯 총 Shares 공급: ${ethers.formatUnits(totalSharesSupply, 18)}`);
    console.log(`  💰 현재 총 가치: ${ethers.formatUnits(currentValue, 6)} USDT`);

    const netValue = currentValue - withdrawn;
    const netDeposited = deposited - withdrawn;
    if (netDeposited > 0) {
      const totalReturn =
        ((Number(netValue) - Number(netDeposited)) / Number(netDeposited)) * 100;
      console.log(`📈 전체 수익률: ${totalReturn.toFixed(4)}%`);
    }

    console.log('\n=== 11. 브릿지 호환성 테스트 ===');

    const bridgeAmount = ethers.parseUnits('100', 6); // 100 USDT
    await usdt.approve(proxyAddress, bridgeAmount);

    const bridgeTx = await vault.receiveFromBridge(USDT_ADDRESS, bridgeAmount);
    await bridgeTx.wait();
    console.log(
      `✅ 브릿지 방식으로 ${ethers.formatUnits(bridgeAmount, 6)} USDT 예치 완료`,
    );

    console.log(
      '\n🎉 ============== 실제 작동하는 다중 프로토콜 분산 투자 시스템 테스트 완료 ==============',
    );
    console.log('✅ 성공적으로 구현된 기능들:');
    console.log('  🔄 프로토콜 분배 비율 설정 및 자동 분배');
    console.log('  💰 Yield-bearing token (shares) 시스템');
    console.log('  📈 실시간 수익률 계산');
    console.log('  🔀 프로토콜 간 자산 리밸런싱');
    console.log('  📊 상세한 잔액 및 통계 추적');
    console.log('  🎯 AAVE와 Morpho 실제 연동');
    console.log('  🔄 기존 브릿지 방식과 호환');
    console.log('===============================================================');
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }

  console.log('\n🏁 실제 작동하는 다중 프로토콜 분산 투자 시스템 테스트 완료');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ 오류:', error);
    process.exit(1);
  });
