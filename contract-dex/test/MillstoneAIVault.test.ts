import { expect } from 'chai';
import { ethers } from 'hardhat';
import { MillstoneAIVault, MockERC20, EIP1967Proxy } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('MillstoneAIVault', function () {
  let vault: MillstoneAIVault;
  let usdt: MockERC20;
  let usdc: MockERC20;
  let owner: HardhatEthersSigner;
  let bridge: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  const USDT_DECIMALS = 6;
  const USDC_DECIMALS = 6;

  beforeEach(async function () {
    [owner, bridge, user1, user2] = await ethers.getSigners();

    // Deploy MockERC20 tokens
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

    // Deploy MillstoneAIVault implementation and proxy
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

    // Initial setup
    await vault.setBridgeAuthorization(bridge.address, true);
    await vault.setSupportedToken(await usdt.getAddress(), true);
    await vault.setSupportedToken(await usdc.getAddress(), true);

    // Set protocol allocations to 100% AAVE for testing (no actual protocols)
    await vault.setProtocolAllocations(await usdt.getAddress(), 10000, 0);
    await vault.setProtocolAllocations(await usdc.getAddress(), 10000, 0);

    // Distribute test tokens
    await usdt.transfer(bridge.address, ethers.parseUnits('10000', USDT_DECIMALS));
    await usdc.transfer(bridge.address, ethers.parseUnits('10000', USDC_DECIMALS));
    await usdt.transfer(user1.address, ethers.parseUnits('1000', USDT_DECIMALS));
    await usdc.transfer(user1.address, ethers.parseUnits('1000', USDC_DECIMALS));
  });

  describe('Initialization and Configuration', function () {
    it('should initialize contract correctly', async function () {
      expect(await vault.owner()).to.equal(owner.address);
      expect(await vault.authorizedBridges(bridge.address)).to.be.true;
      expect(await vault.supportedTokens(await usdt.getAddress())).to.be.true;
      expect(await vault.performanceFeeRate()).to.equal(1000); // 10% default
      expect(await vault.feeRecipient()).to.equal(owner.address);
    });

    it('only owner can set bridge authorization', async function () {
      await expect(
        vault.connect(user1).setBridgeAuthorization(user1.address, true),
      ).to.be.revertedWithCustomError(vault, 'OwnableUnauthorizedAccount');
    });

    it('only owner can set supported tokens', async function () {
      await expect(
        vault.connect(user1).setSupportedToken(await usdt.getAddress(), true),
      ).to.be.revertedWithCustomError(vault, 'OwnableUnauthorizedAccount');
    });

    it('should set performance fee rate correctly', async function () {
      await vault.setPerformanceFeeRate(500); // 5%
      expect(await vault.performanceFeeRate()).to.equal(500);
    });

    it('should reject performance fee rate above 20%', async function () {
      await expect(vault.setPerformanceFeeRate(2001)).to.be.revertedWith(
        'Fee rate too high',
      );
    });
  });

  describe('StakedToken System - Deposit', function () {
    it('should deposit tokens and mint StakedTokens', async function () {
      const amount = ethers.parseUnits('100', USDT_DECIMALS);

      await usdt.connect(user1).approve(await vault.getAddress(), amount);

      const tx = await vault.connect(user1).deposit(await usdt.getAddress(), amount);

      // Check StakedToken balance
      const stakedBalance = await vault.getStakedTokenBalance(
        user1.address,
        await usdt.getAddress(),
      );
      expect(stakedBalance).to.be.gt(0);

      // Check user info
      const [userStakedBalance, underlyingValue, exchangeRate] = await vault.getUserInfo(
        user1.address,
        await usdt.getAddress(),
      );
      expect(userStakedBalance).to.equal(stakedBalance);
      expect(underlyingValue).to.be.closeTo(
        amount,
        ethers.parseUnits('1', USDT_DECIMALS),
      );
      expect(exchangeRate).to.equal(1000000); // 1e6 initial rate
    });

    it('should reject deposit for unsupported token', async function () {
      const MockERC20 = await ethers.getContractFactory('MockERC20');
      const unsupportedToken = await MockERC20.deploy(
        'Unsupported',
        'UNS',
        18,
        ethers.parseEther('1000'),
      );
      await unsupportedToken.waitForDeployment();

      const amount = ethers.parseEther('100');
      await unsupportedToken.transfer(user1.address, amount);
      await unsupportedToken.connect(user1).approve(await vault.getAddress(), amount);

      await expect(
        vault.connect(user1).deposit(await unsupportedToken.getAddress(), amount),
      ).to.be.revertedWith('Token not supported');
    });
  });

  describe('StakedToken System - Withdrawal', function () {
    beforeEach(async function () {
      // Deposit some tokens first
      const amount = ethers.parseUnits('1000', USDT_DECIMALS);
      await usdt.connect(user1).approve(await vault.getAddress(), amount);
      await vault.connect(user1).deposit(await usdt.getAddress(), amount);
    });

    it('should reject withdrawal with insufficient balance', async function () {
      const excessAmount = ethers.parseUnits('10000', 6); // Large StakedToken amount

      await expect(
        vault.connect(user1).redeem(await usdt.getAddress(), excessAmount),
      ).to.be.revertedWith('Insufficient staked tokens');
    });
  });

  describe('Bridge Functions', function () {
    it('should allow authorized bridge to receive tokens', async function () {
      const amount = ethers.parseUnits('100', USDT_DECIMALS);

      await usdt.connect(bridge).approve(await vault.getAddress(), amount);

      await vault.connect(bridge).receiveFromBridge(await usdt.getAddress(), amount);

      const totalSupply = await vault.getTotalStakedTokenSupply(await usdt.getAddress());
      expect(totalSupply).to.be.gt(0);
    });

    it('should reject unauthorized bridge', async function () {
      const amount = ethers.parseUnits('100', USDT_DECIMALS);

      await usdt.transfer(user1.address, amount);
      await usdt.connect(user1).approve(await vault.getAddress(), amount);

      await expect(
        vault.connect(user1).receiveFromBridge(await usdt.getAddress(), amount),
      ).to.be.revertedWith('Unauthorized bridge');
    });
  });

  describe('Protocol Balances and Statistics', function () {
    beforeEach(async function () {
      const amount = ethers.parseUnits('1000', USDT_DECIMALS);
      await usdt.connect(user1).approve(await vault.getAddress(), amount);
      await vault.connect(user1).deposit(await usdt.getAddress(), amount);
    });

    it('should return correct total value', async function () {
      const totalValue = await vault.getTotalValue(await usdt.getAddress());
      expect(totalValue).to.be.gt(0);
    });

    it('should return token statistics', async function () {
      const [
        totalStaked,
        underlyingDeposited,
        totalWithdrawn,
        currentValue,
        exchangeRate,
      ] = await vault.getTokenStats(await usdt.getAddress());

      expect(totalStaked).to.be.gt(0);
      expect(underlyingDeposited).to.be.gt(0);
      expect(currentValue).to.be.gt(0);
      expect(exchangeRate).to.equal(1000000); // 1e6
    });

    it('should calculate yield correctly', async function () {
      const [totalValue, totalDeposited, yieldAmount, yieldRate] =
        await vault.calculateYield(await usdt.getAddress());

      expect(totalValue).to.be.gte(totalDeposited);
      expect(yieldAmount).to.equal(totalValue - totalDeposited);
    });
  });

  describe('Performance Fee System', function () {
    it('should return correct fee information', async function () {
      const [feeRate, accumulatedFee, totalFeesWithdrawn, recipient] =
        await vault.getFeeInfo(await usdt.getAddress());

      expect(feeRate).to.equal(1000); // 10% default
      expect(recipient).to.equal(owner.address);
    });

    it('should set fee recipient', async function () {
      await vault.setFeeRecipient(user1.address);
      expect(await vault.feeRecipient()).to.equal(user1.address);
    });
  });

  describe('Preview Functions', function () {
    it('should preview deposit correctly', async function () {
      const amount = ethers.parseUnits('100', USDT_DECIMALS);
      const previewStakedTokens = await vault.previewDeposit(
        await usdt.getAddress(),
        amount,
      );
      expect(previewStakedTokens).to.be.gt(0);
    });

    it('should preview redemption correctly', async function () {
      // First deposit
      const amount = ethers.parseUnits('100', USDT_DECIMALS);
      await usdt.connect(user1).approve(await vault.getAddress(), amount);
      await vault.connect(user1).deposit(await usdt.getAddress(), amount);

      const stakedBalance = await vault.getStakedTokenBalance(
        user1.address,
        await usdt.getAddress(),
      );
      const previewAmount = await vault.previewRedeem(
        await usdt.getAddress(),
        stakedBalance,
      );
      expect(previewAmount).to.be.gt(0);
    });
  });

  describe('Exchange Rate Management', function () {
    it('should return current exchange rate', async function () {
      const rate = await vault.getExchangeRate(await usdt.getAddress());
      expect(rate).to.equal(1000000); // 1e6 initial rate
    });

    it('should simulate exchange rate update', async function () {
      // First deposit to have some StakedTokens
      const amount = ethers.parseUnits('100', USDT_DECIMALS);
      await usdt.connect(user1).approve(await vault.getAddress(), amount);
      await vault.connect(user1).deposit(await usdt.getAddress(), amount);

      const [currentRate, newRate, totalGain, feeAmount, netGain] =
        await vault.simulateExchangeRateUpdate(await usdt.getAddress());

      expect(currentRate).to.equal(1000000);
    });
  });

  describe('Security Features', function () {
    it('should set bridge daily limit', async function () {
      const limit = ethers.parseUnits('10000', USDT_DECIMALS);
      await vault.setBridgeLimit(bridge.address, limit);

      const [dailyLimit, dailyUsed, lastResetTime, isPaused] =
        await vault.getBridgeSecurityStatus(bridge.address);
      expect(dailyLimit).to.equal(limit);
    });

    it('should set max rate increase', async function () {
      await vault.setMaxRateIncrease(await usdt.getAddress(), 500); // 5%

      const [maxDailyRate, lastUpdateTime, pendingRate, hasPending] =
        await vault.getSecurityStatus(await usdt.getAddress());
      expect(maxDailyRate).to.equal(500);
    });

    it('should emergency pause bridge', async function () {
      await vault.setBridgeEmergencyPause(bridge.address, true);

      const [, , , isPaused] = await vault.getBridgeSecurityStatus(bridge.address);
      expect(isPaused).to.be.true;

      const amount = ethers.parseUnits('100', USDT_DECIMALS);
      await usdt.connect(bridge).approve(await vault.getAddress(), amount);

      await expect(
        vault.connect(bridge).receiveFromBridge(await usdt.getAddress(), amount),
      ).to.be.revertedWith('Bridge paused');
    });
  });

  describe('Owner Functions', function () {
    it('should set protocol allocations', async function () {
      await vault.setProtocolAllocations(await usdt.getAddress(), 6000, 4000); // 60:40

      const [aave, morpho] = await vault.getAllocations(await usdt.getAddress());
      expect(aave).to.equal(6000);
      expect(morpho).to.equal(4000);
    });

    it('should reject invalid allocation ratios', async function () {
      await expect(
        vault.setProtocolAllocations(await usdt.getAddress(), 6000, 5000), // 110%
      ).to.be.revertedWith('Must sum to 100%');
    });
  });
});
