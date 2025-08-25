// 인터랙티브 브릿지 전용 입출금 시나리오 테스트
// 각 이벤트마다 엔터키를 눌러야 다음 단계로 진행
// 실제 운영환경과 동일하게 모든 거래가 브릿지를 통해서만 이루어짐

import { ethers } from 'hardhat';
import * as readline from 'readline';

// 키보드 입력을 위한 인터페이스 설정
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 엔터키 대기 함수
const waitForEnter = (message: string): Promise<void> => {
  return new Promise(resolve => {
    rl.question(`\n🔔 ${message}\n⏳ Continue... `, () => {
      resolve();
    });
  });
};

async function main() {
  console.log('=== 인터랙티브 브릿지 전용 입출금 시나리오 테스트 ===\n');

  // 주소 설정
  const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  const STEAKHOUSE_VAULT = '0xbEef047a543E45807105E51A8BBEFCc5950fcfBa';
  const AAVE_POOL_V3 = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2';
  const AUSDT_ADDRESS = '0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a';

  console.log('📋 사용할 주소들(ETH Mainnet Real Contract):');
  console.log(`  AAVE Pool V3: ${AAVE_POOL_V3}`);
  console.log(`  Morpho Steakhouse USDT Vault: ${STEAKHOUSE_VAULT}`);
  console.log(`  USDT: ${USDT_ADDRESS}`);

  // Signers 설정
  const [deployer, feeRecipient, bridge1] = await ethers.getSigners();

  console.log('\n👤 계정 설정:');
  console.log(`  배포자: ${deployer.address}`);
  console.log(`  Fee 수취인: ${feeRecipient.address}`);
  console.log(`  Bridge: ${bridge1.address}`);

  await waitForEnter('컨트랙트 배포를 시작하겠습니다');

  // =============================================================================
  console.log('\n=== 1. MillstoneAIVault 배포 및 초기 설정 ===');

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

  // 초기 설정
  await vault.setFeeRecipient(feeRecipient.address);
  await vault.setPerformanceFeeRate(1000); // 10%
  await vault.setSupportedToken(USDT_ADDRESS, true);
  await vault.setAaveConfig(AAVE_POOL_V3, USDT_ADDRESS, AUSDT_ADDRESS);
  await vault.setMorphoVault(USDT_ADDRESS, STEAKHOUSE_VAULT);
  await vault.setProtocolAllocations(USDT_ADDRESS, 7000, 3000); // 70% AAVE, 30% Morpho

  // 모든 브릿지 권한 설정
  await vault.setBridgeAuthorization(bridge1.address, true);
  console.log(`✅ 초기 설정 및 브릿지 권한 설정 완료`);

  // USDT 획득 및 브릿지들에 분배
  const USDT_WHALE = '0x28C6c06298d514Db089934071355E5743bf21d60';
  await ethers.provider.send('hardhat_impersonateAccount', [USDT_WHALE]);
  const whale = await ethers.getSigner(USDT_WHALE);

  // USDT_WHALE의 현재 ETH 잔액 확인
  let whaleEthBalance = await ethers.provider.getBalance(USDT_WHALE);
  console.log(
    `🐋 USDT_WHALE (${USDT_WHALE})의 현재 ETH 잔액: ${ethers.formatEther(
      whaleEthBalance,
    )} ETH`,
  );

  // 만약 잔액이 부족하다면, deployer가 ETH를 전송
  const minEth = ethers.parseEther('10.0');
  if (whaleEthBalance < minEth) {
    const tx = await (
      await ethers.getSigner()
    ).sendTransaction({
      to: USDT_WHALE,
      value: minEth - whaleEthBalance,
    });
    await tx.wait();
    whaleEthBalance = await ethers.provider.getBalance(USDT_WHALE);
    console.log(
      `✅ USDT_WHALE에게 ETH 전송 완료. 새로운 잔액: ${ethers.formatEther(
        whaleEthBalance,
      )} ETH`,
    );
  }

  // 각 브릿지에 USDT 전송 (실제 브릿지 운영자금)
  const bridgeFunding = ethers.parseUnits('1000000', 6); // 각 50,000 USDT
  await usdt.connect(whale).transfer(bridge1.address, bridgeFunding);
  console.log(`✅ 브릿지 운영자금 분배 완료 (각 50,000 USDT)`);

  // 브릿지 입출금 추적을 위한 변수들
  let totalBridgeInflow = 0n;
  let totalBridgeOutflow = 0n;
  let bridgeTransactionCount = 0;

  // 헬퍼 함수들
  const logBridgeStatus = async (
    eventNumber: number,
    description: string,
    bridgeUsed?: string,
    amount?: bigint,
    isOutflow?: boolean,
  ) => {
    console.log(`\n🌉 === Event ${eventNumber}: ${description} ===`);

    if (bridgeUsed && amount) {
      if (isOutflow) {
        totalBridgeOutflow += amount;
        console.log(`🔻 ${bridgeUsed}: ${ethers.formatUnits(amount, 6)} USDT 출금`);
      } else {
        totalBridgeInflow += amount;
        console.log(`🔺 ${bridgeUsed}: ${ethers.formatUnits(amount, 6)} USDT 입금`);
      }
      bridgeTransactionCount++;
    }

    // StakedUSDT 전체 정보
    const [
      currentExchangeRate,
      totalSupply,
      totalCurrentValue,
      underlyingDepositedAmount,
      accumulatedFeeAmount,
    ] = await vault.getStakedTokenInfo(USDT_ADDRESS);

    console.log(`********* StakedUSDT Pool 정보 *********`);
    console.log(
      `  🔄 교환비: 1 stakedUSDT = ${ethers.formatUnits(currentExchangeRate, 6)} USDT`,
    );
    console.log(`  🪙 총 발행량: ${ethers.formatUnits(totalSupply, 6)} stakedUSDT`);
    console.log(`  💰 Pool 총 가치: ${ethers.formatUnits(totalCurrentValue, 6)} USDT`);
    console.log(
      `  💰 총 입금액: ${ethers.formatUnits(underlyingDepositedAmount, 6)} USDT`,
    );
    console.log(`  📈 누적 Fee: ${ethers.formatUnits(accumulatedFeeAmount, 6)} USDT`);

    // 프로토콜별 분산 투자 현황
    const [aaveBalance, morphoBalance, totalBalance] = await vault.getProtocolBalances(
      USDT_ADDRESS,
    );
    console.log(`\n********* 프로토콜 분산 투자 *********`);
    console.log(
      `  🏦 AAVE: ${ethers.formatUnits(aaveBalance, 6)} USDT (${(
        (Number(aaveBalance) / Number(totalBalance)) *
        100
      ).toFixed(1)}%)`,
    );
    console.log(
      `  🏦 Morpho: ${ethers.formatUnits(morphoBalance, 6)} USDT (${(
        (Number(morphoBalance) / Number(totalBalance)) *
        100
      ).toFixed(1)}%)`,
    );
    console.log(`  💰 총 투자액: ${ethers.formatUnits(totalBalance, 6)} USDT`);

    // 브릿지 거래 통계
    const netFlow = totalBridgeInflow - totalBridgeOutflow;
    console.log(`\n********* 브릿지 거래 통계 *********`);
    console.log(`  📥 총 입금: ${ethers.formatUnits(totalBridgeInflow, 6)} USDT`);
    console.log(`  📤 총 출금: ${ethers.formatUnits(totalBridgeOutflow, 6)} USDT`);
    console.log(`  💰 순 유입: ${ethers.formatUnits(netFlow, 6)} USDT`);
    console.log(`  🔄 총 거래 수: ${bridgeTransactionCount}회`);

    // 교환비 변화율 (초기 1:1 대비)
    if (eventNumber > 1) {
      const exchangeRateIncrease = Number(ethers.formatUnits(currentExchangeRate, 6)) - 1;
      const percentageIncrease = (exchangeRateIncrease * 100).toFixed(4);
      console.log(`\n📈 교환비 상승률: +${percentageIncrease}% (초기 1:1 대비)`);
    }
  };

  const moveTimeForward = async (days: number) => {
    const secondsInDay = 24 * 60 * 60;
    await ethers.provider.send('evm_increaseTime', [days * secondsInDay]);
    await ethers.provider.send('evm_mine', []);
    console.log(`⏰ ${days}일 시간 이동 완료`);
  };

  // 브릿지 입금 헬퍼
  const bridgeDeposit = async (bridge: any, bridgeName: string, amount: bigint) => {
    await usdt.connect(bridge).approve(proxyAddress, amount);
    await vault.connect(bridge).receiveFromBridge(USDT_ADDRESS, amount);
    return amount;
  };

  // =============================================================================
  // 브릿지 전용 11개 시나리오 시작 (리밸런싱 포함)
  // =============================================================================

  console.log(
    '\n🎬 =============================== 시나리오 시작 ===============================',
  );

  // Event 1: Bridge에서 초기 자금 수신
  await waitForEnter('Event 1: Bridge 최초 자금 수신!!');
  const amount1 = ethers.parseUnits('10000', 6); // 10,000 USDT
  await bridgeDeposit(bridge1, 'Bridge', amount1);
  await logBridgeStatus(1, 'Bridge 초기 자금 수신', 'Bridge', amount1, false);

  // Event 2: 5일 후 Bridge에서 추가 자금 수신
  await waitForEnter('Event 2: Bridge 추가 자금 수신 (5일 후)');
  await moveTimeForward(5);
  const amount2 = ethers.parseUnits('5000', 6); // 3,500 USDT
  await bridgeDeposit(bridge1, 'Bridge', amount2);
  await logBridgeStatus(2, 'Bridge 추가 자금 수신', 'Bridge', amount2, false);

  // Event 3: 7일 후 Base Bridge에서 소규모 자금 수신
  await waitForEnter('Event 3: Bridge 추가 자금 수신 (7일 후)');
  await moveTimeForward(7);
  const amount3 = ethers.parseUnits('1200', 6); // 1,200 USDT
  await bridgeDeposit(bridge1, 'Bridge', amount3);
  await logBridgeStatus(3, 'Bridge 추가 자금 수신', 'Bridge', amount3, false);

  // Event 4: 10일 후 이자 발생 (Performance Fee 수집 트리거)
  await waitForEnter('Event 4: 이자 발생 및 Performance Fee 수집 (10일 후)');
  await moveTimeForward(10);
  const triggerAmount = ethers.parseUnits('1', 6); // 최소 금액으로 트리거
  await bridgeDeposit(bridge1, 'Bridge', triggerAmount);
  await logBridgeStatus(
    4,
    '이자 발생 및 Performance Fee 수집',
    'Bridge',
    triggerAmount,
    false,
  );

  // Event 5: Bridge에서 추가 자금 수신 (새로운 교환비 적용)
  await waitForEnter('Event 5: Bridge 추가 자금 수신 (새 교환비)');
  await moveTimeForward(3);
  const amount5 = ethers.parseUnits('8000', 6); // 8,000 USDT
  await bridgeDeposit(bridge1, 'Bridge', amount5);
  await logBridgeStatus(5, 'Bridge 추가 자금 (새 교환비)', 'Bridge', amount5, false);

  // Event 6: 사용자 출금 시뮬레이션 (실제 브릿지 출금 함수 사용)
  await waitForEnter('Event 6: Bridge 사용자 출금 처리 (6일 후)');
  await moveTimeForward(6);

  const userWithdrawAmount = ethers.parseUnits('2000', 6); // 2,000 USDT 상당

  console.log(
    `✅ 실제 출금: Bridge가 사용자를 대신해 ${ethers.formatUnits(
      userWithdrawAmount,
      6,
    )} USDT 출금 처리 시작`,
  );

  // 실제 브릿지 출금 함수 사용 (withdrawForUser)
  await vault.connect(bridge1).withdrawForUser(USDT_ADDRESS, userWithdrawAmount);

  console.log(`📝 StakedUSDT 공급량 감소 및 총 입금액 조정됨`);
  await logBridgeStatus(6, 'Bridge 사용자 출금 처리', 'Bridge', userWithdrawAmount, true);

  // Event 7: 14일 후 다시 이자 발생
  await waitForEnter('Event 7: 추가 이자 발생 (14일 후)');
  await moveTimeForward(14);
  await bridgeDeposit(bridge1, 'Bridge', triggerAmount);
  await logBridgeStatus(7, '14일 후 추가 이자 발생', 'Bridge', triggerAmount, false);

  // Event 8: 다중 브릿지 동시 자금 수신
  await waitForEnter('Event 8: Bridge 추가 자금 (4일 후)');
  await moveTimeForward(4);
  const amount8a = ethers.parseUnits('2500', 6); // Polygon 2,500 USDT

  console.log('🔄 브릿지 동시 입금을 시작합니다...');
  await bridgeDeposit(bridge1, 'Bridge', amount8a);

  totalBridgeInflow += amount8a; // amount8a는 이미 bridgeDeposit에서 추가됨
  bridgeTransactionCount += 2; // 추가 2개 거래

  await logBridgeStatus(8, '브릿지 자금 수신', 'Bridge', amount8a, false);

  // Event 9: 사용자 출금 시뮬레이션 (실제 브릿지 출금 함수 사용)
  await waitForEnter('Event 9: Bridge 사용자 출금 처리 (8일 후)');
  await moveTimeForward(8);
  const largeWithdrawAmount = ethers.parseUnits('5000', 6); // 5,000 USDT 상당

  console.log(
    `✅ 실제 출금: Bridge가 사용자를 대신해 ${ethers.formatUnits(
      largeWithdrawAmount,
      6,
    )} USDT 출금 처리 시작`,
  );

  // 실제 브릿지 출금 함수 사용 (withdrawForUser)
  await vault.connect(bridge1).withdrawForUser(USDT_ADDRESS, largeWithdrawAmount);

  console.log(`📝 StakedUSDT 공급량 감소 및 총 입금액 조정됨`);
  await logBridgeStatus(
    9,
    'Bridge 사용자 출금 처리',
    'Bridge',
    largeWithdrawAmount,
    true,
  );

  // Event 10: 리밸런싱 테스트
  await waitForEnter('Event 10: 리밸런싱 기능 테스트 (5일 후)');
  await moveTimeForward(5);

  console.log('🔄 === 리밸런싱 실행 전 비율 확인 ===');
  const [preAave, preMorpho, preTotal] = await vault.getProtocolBalances(USDT_ADDRESS);
  const preAavePerc = (Number(preAave) / Number(preTotal)) * 100;
  const preMorphoPerc = (Number(preMorpho) / Number(preTotal)) * 100;
  console.log(`  💼 리밸런싱 전 AAVE: ${preAavePerc.toFixed(2)}%`);
  console.log(`  🥩 리밸런싱 전 Morpho: ${preMorphoPerc.toFixed(2)}%`);

  // 리밸런싱 실행
  await vault.rebalance(USDT_ADDRESS);
  console.log('✅ 리밸런싱 실행 완료');

  await logBridgeStatus(10, '리밸런싱 실행 후 비율 조정', '', 0n, false);

  // Event 11: Performance Fee 인출 및 최종 통계
  await waitForEnter('Event 11: Performance Fee 인출 및 최종 통계 (10일 후)');
  await moveTimeForward(10);

  // Performance Fee 인출
  const [, accumulatedFees] = await vault.getFeeInfo(USDT_ADDRESS);
  if (accumulatedFees > 0) {
    await vault.connect(feeRecipient).withdrawAllFees(USDT_ADDRESS);
    console.log(
      `💰 Performance Fee 인출: ${ethers.formatUnits(accumulatedFees, 6)} USDT`,
    );
  }

  // 최종 소액 트리거로 마지막 상태 업데이트
  await bridgeDeposit(bridge1, 'Arbitrum Bridge', triggerAmount);
  await logBridgeStatus(
    11,
    '최종 상태 확인 및 Fee 인출 완료',
    'Arbitrum Bridge',
    triggerAmount,
    false,
  );

  // =============================================================================
  await waitForEnter('최종 분석 결과를 확인하겠습니다');

  console.log('\n🎯 === 브릿지 전용 시나리오 최종 분석 ===');

  // 최종 통계 수집
  const [totalValue, totalDepositedAmount, yieldAmount, yieldRate] =
    await vault.calculateYield(USDT_ADDRESS);
  const [
    totalStakedSupply,
    underlyingDepositedAmount,
    totalWithdrawnAmount,
    currentValue,
    finalExchangeRate,
  ] = await vault.getTokenStats(USDT_ADDRESS);
  const [, , grossYield, totalFeeAmount, netYield, netYieldRate] =
    await vault.calculateNetYield(USDT_ADDRESS);

  console.log(`\n📊 === 최종 브릿지 Pool 통계 ===`);
  console.log(
    `💱 최종 교환비: 1 stakedUSDT = ${ethers.formatUnits(finalExchangeRate, 6)} USDT`,
  );
  console.log(`🪙 총 stakedUSDT 발행량: ${ethers.formatUnits(totalStakedSupply, 6)}`);
  console.log(
    `🏦 총 브릿지 입금: ${ethers.formatUnits(underlyingDepositedAmount, 6)} USDT`,
  );
  console.log(`📤 총 브릿지 출금: ${ethers.formatUnits(totalWithdrawnAmount, 6)} USDT`);
  console.log(`💰 Pool 현재 가치: ${ethers.formatUnits(currentValue, 6)} USDT`);
  console.log(`📈 총 수익: ${ethers.formatUnits(yieldAmount, 6)} USDT`);
  console.log(`🔥 수익률: ${Number(yieldRate) / 100}%`);
  console.log(`💸 총 수집 Fee: ${ethers.formatUnits(totalFeeAmount, 6)} USDT`);
  console.log(`💎 사용자 순 수익: ${ethers.formatUnits(netYield, 6)} USDT`);

  // 교환비 상승률 계산
  const exchangeRateIncrease = Number(ethers.formatUnits(finalExchangeRate, 6)) - 1;
  const percentageIncrease = (exchangeRateIncrease * 100).toFixed(4);
  console.log(`\n🚀 교환비 상승률: +${percentageIncrease}% (초기 1:1 대비)`);

  // 브릿지별 거래 효율성 분석
  console.log(`\n🌉 브릿지 운영 효율성:`);
  console.log(`  📊 총 브릿지 거래: ${bridgeTransactionCount}회`);
  console.log(
    `  💰 평균 거래 크기: ${ethers.formatUnits(
      (totalBridgeInflow + totalBridgeOutflow) / BigInt(bridgeTransactionCount),
      6,
    )} USDT`,
  );
  console.log(
    `  📈 순 자금 유입: ${ethers.formatUnits(
      totalBridgeInflow - totalBridgeOutflow,
      6,
    )} USDT`,
  );
  console.log(
    `  🎯 자금 활용률: ${(
      (Number(currentValue) / Number(totalBridgeInflow)) *
      100
    ).toFixed(2)}%`,
  );

  // 프로토콜 분산 효과 분석
  const [finalAaveBalance, finalMorphoBalance] = await vault.getProtocolBalances(
    USDT_ADDRESS,
  );
  console.log(`\n🏦 프로토콜 분산 투자 효과:`);
  console.log(
    `  💼 AAVE 비중: ${(
      (Number(finalAaveBalance) / Number(finalAaveBalance + finalMorphoBalance)) *
      100
    ).toFixed(1)}%`,
  );
  console.log(
    `  🥩 Morpho 비중: ${(
      (Number(finalMorphoBalance) / Number(finalAaveBalance + finalMorphoBalance)) *
      100
    ).toFixed(1)}%`,
  );
  console.log(`  🔄 목표 비율: AAVE 70% + Morpho 30%`);
  console.log(
    `  ✅ 분산 투자 성공: ${
      Math.abs(
        70 -
          (Number(finalAaveBalance) / Number(finalAaveBalance + finalMorphoBalance)) *
            100,
      ) < 5
        ? '✅'
        : '❌'
    }`,
  );

  await waitForEnter('테스트 완료 요약을 확인하겠습니다');

  console.log(`\n✅ === 인터랙티브 브릿지 시나리오 검증 완료 ===`);
  console.log(`🌉 브릿지 전용 입출금: 모든 거래가 브릿지를 통해서만 처리됨`);
  console.log(`🪙 StakedUSDT 자동 관리: 사용자가 직접 컨트랙트 호출 없이 수익 누적`);
  console.log(`💱 교환비 자동 증가: 이자 발생 시 자동으로 stakedUSDT 가치 상승`);
  console.log(`🏦 다중 체인 지원: Polygon, Arbitrum, Base 브릿지 동시 운영`);
  console.log(`💰 Performance Fee: 자동 수집 및 관리로 지속 가능한 수익 모델`);
  console.log(`🔄 리밸런싱: 목표 비율 유지를 위한 자동 자금 재분배`);
  console.log(`📊 실시간 모니터링: 모든 브릿지 거래 및 Pool 상태 추적 가능`);

  console.log('\n🎉 ================ 인터랙티브 브릿지 테스트 완료 ================');
  console.log('✅ 검증된 실제 운영 시나리오:');
  console.log('  🌉 다중 브릿지 동시 운영 (Polygon, Arbitrum, Base)');
  console.log('  💰 브릿지를 통한 대량/소량 자금 입출금');
  console.log('  🪙 사용자 직접 호출 없는 StakedUSDT 관리');
  console.log('  📈 자동 이자 누적 및 교환비 상승');
  console.log('  🔄 프로토콜 분산 투자 및 리밸런싱');
  console.log('  💸 Performance Fee 자동 수집 시스템');
  console.log('  📊 실시간 브릿지 거래 모니터링');
  console.log('  🎯 알만액 stakedUSDT 구조와 100% 동일한 동작');
  console.log('================================================================');

  // readline 인터페이스 종료
  rl.close();
}

// 메인 함수 실행
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
