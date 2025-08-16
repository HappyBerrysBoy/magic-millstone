import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  MillstoneAIVault,
  MockERC20,
  MockLendingProtocol,
  EIP1967Proxy,
} from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('MillstoneAIVault', function () {
  let vault: MillstoneAIVault;
  let usdt: MockERC20;
  let usdc: MockERC20;
  let lendingProtocol: MockLendingProtocol;
  let owner: HardhatEthersSigner;
  let bridge: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  const USDT_DECIMALS = 6;
  const USDC_DECIMALS = 6;

  beforeEach(async function () {
    [owner, bridge, user1, user2] = await ethers.getSigners();

    // MockERC20 토큰들 배포
    const MockERC20 = await ethers.getContractFactory('MockERC20');

    usdt = await MockERC20.deploy(
      'Tether USD',
      'USDT',
      USDT_DECIMALS,
      ethers.parseUnits('1000000', USDT_DECIMALS),
    );
    await usdt.waitForDeployment();

    usdc = await MockERC20.deploy(
      'USD Coin',
      'USDC',
      USDC_DECIMALS,
      ethers.parseUnits('1000000', USDC_DECIMALS),
    );
    await usdc.waitForDeployment();

    // MockLendingProtocol 배포
    const MockLendingProtocol = await ethers.getContractFactory('MockLendingProtocol');
    lendingProtocol = await MockLendingProtocol.deploy();
    await lendingProtocol.waitForDeployment();

    // MillstoneAIVault 구현체 및 프록시 배포
    const MillstoneAIVault = await ethers.getContractFactory('MillstoneAIVault');
    const implementation = await MillstoneAIVault.deploy();
    await implementation.waitForDeployment();

    const EIP1967Proxy = await ethers.getContractFactory('EIP1967Proxy');
    const initData = implementation.interface.encodeFunctionData('initialize', [
      owner.address,
    ]);
    const proxy = await EIP1967Proxy.deploy(await implementation.getAddress(), initData);
    await proxy.waitForDeployment();

    vault = MillstoneAIVault.attach(await proxy.getAddress()) as MillstoneAIVault;

    // 초기 설정
    await vault.setBridgeAuthorization(bridge.address, true);
    await vault.setSupportedToken(await usdt.getAddress(), true);
    await vault.setSupportedToken(await usdc.getAddress(), true);
    await vault.setLendingProtocol(
      await usdt.getAddress(),
      await lendingProtocol.getAddress(),
    );
    await vault.setLendingProtocol(
      await usdc.getAddress(),
      await lendingProtocol.getAddress(),
    );

    // 테스트용 토큰 분배
    await usdt.transfer(bridge.address, ethers.parseUnits('10000', USDT_DECIMALS));
    await usdc.transfer(bridge.address, ethers.parseUnits('10000', USDC_DECIMALS));
  });

  describe('초기화 및 설정', function () {
    it('컨트랙트가 올바르게 초기화되어야 함', async function () {
      expect(await vault.owner()).to.equal(owner.address);
      expect(await vault.authorizedBridges(bridge.address)).to.be.true;
      expect(await vault.supportedTokens(await usdt.getAddress())).to.be.true;
    });

    it('owner만 브릿지 권한을 설정할 수 있어야 함', async function () {
      await expect(
        vault.connect(user1).setBridgeAuthorization(user1.address, true),
      ).to.be.revertedWithCustomError(vault, 'OwnableUnauthorizedAccount');
    });

    it('owner만 렌딩 프로토콜을 설정할 수 있어야 함', async function () {
      await expect(
        vault
          .connect(user1)
          .setLendingProtocol(
            await usdt.getAddress(),
            await lendingProtocol.getAddress(),
          ),
      ).to.be.revertedWithCustomError(vault, 'OwnableUnauthorizedAccount');
    });
  });

  describe('브릿지에서 토큰 받기', function () {
    it('권한이 있는 브릿지가 토큰을 전송할 수 있어야 함', async function () {
      const amount = ethers.parseUnits('100', USDT_DECIMALS);

      // 브릿지가 vault에 토큰 전송 승인
      await usdt.connect(bridge).approve(await vault.getAddress(), amount);

      // 브릿지에서 토큰 받기
      await expect(
        vault.connect(bridge).receiveFromBridge(await usdt.getAddress(), amount),
      )
        .to.emit(vault, 'TokenReceived')
        .withArgs(await usdt.getAddress(), amount, bridge.address);

      // 토큰이 자동으로 렌딩 프로토콜에 예치되었는지 확인 (이자 포함으로 원금보다 클 수 있음)
      const [, protocolBalance] = await vault.getTokenBalance(await usdt.getAddress());
      expect(protocolBalance).to.be.gte(amount); // 이자로 인해 원금보다 크거나 같음
    });

    it('권한이 없는 주소는 토큰을 전송할 수 없어야 함', async function () {
      const amount = ethers.parseUnits('100', USDT_DECIMALS);

      await usdt.transfer(user1.address, amount);
      await usdt.connect(user1).approve(await vault.getAddress(), amount);

      await expect(
        vault.connect(user1).receiveFromBridge(await usdt.getAddress(), amount),
      ).to.be.revertedWith('Unauthorized bridge');
    });

    it('지원하지 않는 토큰은 받을 수 없어야 함', async function () {
      // 지원하지 않는 토큰 생성
      const MockERC20 = await ethers.getContractFactory('MockERC20');
      const unsupportedToken = await MockERC20.deploy(
        'Unsupported',
        'UNS',
        18,
        ethers.parseEther('1000'),
      );
      await unsupportedToken.waitForDeployment();

      const amount = ethers.parseEther('100');
      await unsupportedToken.transfer(bridge.address, amount);
      await unsupportedToken.connect(bridge).approve(await vault.getAddress(), amount);

      await expect(
        vault
          .connect(bridge)
          .receiveFromBridge(await unsupportedToken.getAddress(), amount),
      ).to.be.revertedWith('Token not supported');
    });
  });

  describe('출금 기능', function () {
    beforeEach(async function () {
      // 먼저 토큰을 예치
      const amount = ethers.parseUnits('1000', USDT_DECIMALS);
      await usdt.connect(bridge).approve(await vault.getAddress(), amount);
      await vault.connect(bridge).receiveFromBridge(await usdt.getAddress(), amount);
    });

    it('출금 요청을 할 수 있어야 함', async function () {
      const withdrawAmount = ethers.parseUnits('100', USDT_DECIMALS);

      await expect(
        vault.connect(user1).requestWithdraw(await usdt.getAddress(), withdrawAmount),
      )
        .to.emit(vault, 'WithdrawRequested')
        .withArgs(1, await usdt.getAddress(), withdrawAmount, user1.address);

      const [request, isReady] = await vault.getWithdrawRequestInfo(1);
      expect(request.token).to.equal(await usdt.getAddress());
      expect(request.amount).to.equal(withdrawAmount);
      expect(request.requester).to.equal(user1.address);
      expect(request.claimed).to.be.false;
      expect(isReady).to.be.false; // 아직 대기 기간이므로 false
    });

    it('출금 대기 기간이 지나면 클레임할 수 있어야 함', async function () {
      const withdrawAmount = ethers.parseUnits('100', USDT_DECIMALS);

      // 출금 요청
      await vault.connect(user1).requestWithdraw(await usdt.getAddress(), withdrawAmount);

      // 출금 대기 기간 단축 (테스트용)
      await lendingProtocol.setWithdrawDelay(1); // 1초로 설정

      // 1초 대기
      await ethers.provider.send('evm_increaseTime', [2]);
      await ethers.provider.send('evm_mine', []);

      // 클레임 전 사용자 잔액
      const balanceBefore = await usdt.balanceOf(user1.address);

      // 클레임
      await expect(vault.connect(user1).claimWithdraw(1))
        .to.emit(vault, 'WithdrawClaimed')
        .withArgs(1, await usdt.getAddress(), withdrawAmount, user1.address);

      // 사용자가 토큰을 받았는지 확인
      const balanceAfter = await usdt.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.equal(withdrawAmount);

      // 요청이 claimed로 표시되었는지 확인
      const [request, ,] = await vault.getWithdrawRequestInfo(1);
      expect(request.claimed).to.be.true;
    });

    it('다른 사용자는 타인의 출금을 클레임할 수 없어야 함', async function () {
      const withdrawAmount = ethers.parseUnits('100', USDT_DECIMALS);

      await vault.connect(user1).requestWithdraw(await usdt.getAddress(), withdrawAmount);
      await lendingProtocol.setWithdrawDelay(0);

      await expect(vault.connect(user2).claimWithdraw(1)).to.be.revertedWith(
        'Not the requester',
      );
    });
  });

  describe('잔액 조회', function () {
    it('토큰 잔액을 올바르게 조회해야 함', async function () {
      const amount = ethers.parseUnits('1000', USDT_DECIMALS);

      // 초기 잔액 확인
      let [contractBalance, protocolBalance, totalBalance] = await vault.getTokenBalance(
        await usdt.getAddress(),
      );
      expect(contractBalance).to.equal(0);
      expect(protocolBalance).to.equal(0);
      expect(totalBalance).to.equal(0);

      // 토큰 예치 후
      await usdt.connect(bridge).approve(await vault.getAddress(), amount);
      await vault.connect(bridge).receiveFromBridge(await usdt.getAddress(), amount);

      [contractBalance, protocolBalance, totalBalance] = await vault.getTokenBalance(
        await usdt.getAddress(),
      );
      expect(contractBalance).to.equal(0); // 모두 프로토콜에 예치됨
      expect(protocolBalance).to.be.gt(amount); // 이자 포함
      expect(totalBalance).to.equal(protocolBalance);
    });

    it('토큰 통계를 올바르게 조회해야 함', async function () {
      const amount = ethers.parseUnits('1000', USDT_DECIMALS);

      await usdt.connect(bridge).approve(await vault.getAddress(), amount);
      await vault.connect(bridge).receiveFromBridge(await usdt.getAddress(), amount);

      const [deposited, withdrawn] = await vault.getTokenStats(await usdt.getAddress());
      expect(deposited).to.equal(amount);
      expect(withdrawn).to.equal(0);
    });
  });

  describe('수익률 계산', function () {
    it('수익률을 올바르게 계산해야 함', async function () {
      const amount = ethers.parseUnits('1000', USDT_DECIMALS);

      await usdt.connect(bridge).approve(await vault.getAddress(), amount);
      await vault.connect(bridge).receiveFromBridge(await usdt.getAddress(), amount);

      // 시간이 지난 후 수익률 확인 (MockLendingProtocol이 자동으로 이자 적용)
      const [totalValue, principal, yieldAmount, yieldRate] = await vault.calculateYield(
        await usdt.getAddress(),
      );

      expect(principal).to.equal(amount);
      expect(totalValue).to.be.gt(principal); // 이자로 인해 증가
      expect(yieldAmount).to.equal(totalValue - principal);
      expect(yieldRate).to.be.gt(0); // 양의 수익률
    });

    it('예치 없이는 수익률이 0이어야 함', async function () {
      const [totalValue, principal, yieldAmount, yieldRate] = await vault.calculateYield(
        await usdt.getAddress(),
      );

      expect(totalValue).to.equal(0);
      expect(principal).to.equal(0);
      expect(yieldAmount).to.equal(0);
      expect(yieldRate).to.equal(0);
    });
  });

  describe('사용자 출금 요청 조회', function () {
    it('사용자의 출금 요청 목록을 조회할 수 있어야 함', async function () {
      const amount1 = ethers.parseUnits('100', USDT_DECIMALS);
      const amount2 = ethers.parseUnits('200', USDT_DECIMALS);

      // 먼저 토큰 예치
      await usdt
        .connect(bridge)
        .approve(await vault.getAddress(), ethers.parseUnits('1000', USDT_DECIMALS));
      await vault
        .connect(bridge)
        .receiveFromBridge(
          await usdt.getAddress(),
          ethers.parseUnits('1000', USDT_DECIMALS),
        );

      // user1이 두 번 출금 요청
      await vault.connect(user1).requestWithdraw(await usdt.getAddress(), amount1);
      await vault.connect(user1).requestWithdraw(await usdt.getAddress(), amount2);

      // user2가 한 번 출금 요청
      await vault.connect(user2).requestWithdraw(await usdt.getAddress(), amount1);

      const user1Requests = await vault.getUserWithdrawRequests(user1.address);
      const user2Requests = await vault.getUserWithdrawRequests(user2.address);

      expect(user1Requests.length).to.equal(2);
      expect(user2Requests.length).to.equal(1);
      expect(user1Requests[0]).to.equal(1);
      expect(user1Requests[1]).to.equal(2);
      expect(user2Requests[0]).to.equal(3);
    });
  });

  describe('관리자 기능', function () {
    it('컨트랙트를 일시 정지할 수 있어야 함', async function () {
      await vault.pause();

      const amount = ethers.parseUnits('100', USDT_DECIMALS);
      await usdt.connect(bridge).approve(await vault.getAddress(), amount);

      await expect(
        vault.connect(bridge).receiveFromBridge(await usdt.getAddress(), amount),
      ).to.be.revertedWithCustomError(vault, 'EnforcedPause');
    });

    it('긴급 출금을 할 수 있어야 함', async function () {
      const amount = ethers.parseUnits('100', USDT_DECIMALS);

      // vault에 직접 토큰 전송 (테스트 시나리오)
      await usdt.transfer(await vault.getAddress(), amount);

      const ownerBalanceBefore = await usdt.balanceOf(owner.address);
      await vault.emergencyWithdraw(await usdt.getAddress(), amount);
      const ownerBalanceAfter = await usdt.balanceOf(owner.address);

      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(amount);
    });
  });
});
