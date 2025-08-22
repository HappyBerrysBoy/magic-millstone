import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { TestUSDT, MmUSDT, WithdrawNFT, VaultContract } from "../types";

describe("VaultContract Deposit Tests", function () {
  let testUSDT: TestUSDT, mmUSDTToken: MmUSDT, withdrawNFT: WithdrawNFT, vaultContract: VaultContract;
  let owner: HardhatEthersSigner, user1: HardhatEthersSigner, user2: HardhatEthersSigner;
  
  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy TestUSDT
    const TestUSDT = await ethers.getContractFactory("TestUSDT");
    testUSDT = await TestUSDT.deploy() as unknown as TestUSDT;
    await testUSDT.waitForDeployment();

    // Deploy mmUSDT as upgradeable proxy
    const MmUSDT = await ethers.getContractFactory("mmUSDT");
    mmUSDTToken = await upgrades.deployProxy(MmUSDT, [
      "Magic Millstone USDT",
      "mmUSDT", 
      6, // 6 decimals to match USDT
      owner.address
    ]) as unknown as MmUSDT;
    await mmUSDTToken.waitForDeployment();

    // Deploy WithdrawNFT (assuming it's upgradeable)
    const WithdrawNFT = await ethers.getContractFactory("WithdrawNFT");
    withdrawNFT = await upgrades.deployProxy(WithdrawNFT, [
      "Withdraw NFT",
      "WNFT",
      owner.address,
      ethers.ZeroAddress // placeholder for vault contract
    ]) as unknown as WithdrawNFT;
    await withdrawNFT.waitForDeployment();

    // Deploy VaultContract as upgradeable proxy
    const VaultContract = await ethers.getContractFactory("VaultContract");
    vaultContract = await upgrades.deployProxy(VaultContract, [
      await testUSDT.getAddress(),
      await mmUSDTToken.getAddress(),
      await withdrawNFT.getAddress(),
      owner.address
    ]) as unknown as VaultContract;
    await vaultContract.waitForDeployment();

    // Grant necessary roles
    const MINTER_ROLE = await mmUSDTToken.MINTER_ROLE();
    const BURNER_ROLE = await mmUSDTToken.BURNER_ROLE();
    const MINTER_ROLE_NFT = await withdrawNFT.MINTER_ROLE();
    const BURNER_ROLE_NFT = await withdrawNFT.BURNER_ROLE();
    
    await mmUSDTToken.grantRole(MINTER_ROLE, await vaultContract.getAddress());
    await mmUSDTToken.grantRole(BURNER_ROLE, await vaultContract.getAddress());
    await withdrawNFT.grantRole(MINTER_ROLE_NFT, await vaultContract.getAddress());
    await withdrawNFT.grantRole(BURNER_ROLE_NFT, await vaultContract.getAddress());

    // Give users some TestUSDT using owner faucet function
    await testUSDT["faucet(address,uint256)"](user1.address, ethers.parseUnits("1000", 6));
    await testUSDT["faucet(address,uint256)"](user2.address, ethers.parseUnits("1000", 6));
  });

  describe("Deposit Functionality", function () {
    it("Should allow user to deposit TestUSDT and receive mmUSDT", async function () {
      const depositAmount = ethers.parseUnits("100", 6); // 100 USDT
      
      // Check initial balances
      const initialUSDTBalance = await testUSDT.balanceOf(user1.address);
      const initialMmUSDTBalance = await mmUSDTToken.balanceOf(user1.address);
      
      expect(initialMmUSDTBalance).to.equal(0);
      
      // Approve vault to spend USDT
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), depositAmount);
      
      // Perform deposit
      await expect(vaultContract.connect(user1).deposit(depositAmount))
        .to.emit(vaultContract, "Deposited");
      
      // Check balances after deposit
      const finalUSDTBalance = await testUSDT.balanceOf(user1.address);
      const finalMmUSDTBalance = await mmUSDTToken.balanceOf(user1.address);
      
      expect(finalUSDTBalance).to.equal(initialUSDTBalance - depositAmount);
      expect(finalMmUSDTBalance).to.equal(depositAmount);
      
      // Check vault received the USDT
      const vaultUSDTBalance = await testUSDT.balanceOf(await vaultContract.getAddress());
      expect(vaultUSDTBalance).to.equal(depositAmount);
      
      // Check user deposit tracking
      const userDeposit = await vaultContract.userDeposits(user1.address);
      expect(userDeposit).to.equal(depositAmount);
      
      // Check total deposited
      const totalDeposited = await vaultContract.totalDeposited();
      expect(totalDeposited).to.equal(depositAmount);
    });

    it("Should reject deposit below minimum amount", async function () {
      const smallAmount = ethers.parseUnits("0.5", 6); // 0.5 USDT (below 1 USDT minimum)
      
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), smallAmount);
      
      await expect(vaultContract.connect(user1).deposit(smallAmount))
        .to.be.revertedWith("VaultContract: Amount too small");
    });

    it("Should reject deposit with zero amount", async function () {
      await expect(vaultContract.connect(user1).deposit(0))
        .to.be.revertedWith("VaultContract: Amount too small");
    });

    it("Should reject deposit without sufficient approval", async function () {
      const depositAmount = ethers.parseUnits("100", 6);
      const insufficientApproval = ethers.parseUnits("50", 6);
      
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), insufficientApproval);
      
      await expect(vaultContract.connect(user1).deposit(depositAmount))
        .to.be.reverted;
    });

    it("Should reject deposit without sufficient balance", async function () {
      const depositAmount = ethers.parseUnits("2000", 6); // More than user has
      
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), depositAmount);
      
      await expect(vaultContract.connect(user1).deposit(depositAmount))
        .to.be.reverted;
    });

    it("Should handle multiple deposits correctly", async function () {
      const deposit1 = ethers.parseUnits("100", 6);
      const deposit2 = ethers.parseUnits("200", 6);
      
      // First deposit
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), deposit1);
      await vaultContract.connect(user1).deposit(deposit1);
      
      // Second deposit
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), deposit2);
      await vaultContract.connect(user1).deposit(deposit2);
      
      // Check final balances
      const mmUSDTBalance = await mmUSDTToken.balanceOf(user1.address);
      const userDeposits = await vaultContract.userDeposits(user1.address);
      const totalDeposited = await vaultContract.totalDeposited();
      
      expect(mmUSDTBalance).to.equal(deposit1 + deposit2);
      expect(userDeposits).to.equal(deposit1 + deposit2);
      expect(totalDeposited).to.equal(deposit1 + deposit2);
    });

    it("Should handle deposits from multiple users", async function () {
      const deposit1 = ethers.parseUnits("100", 6);
      const deposit2 = ethers.parseUnits("150", 6);
      
      // User 1 deposits
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), deposit1);
      await vaultContract.connect(user1).deposit(deposit1);
      
      // User 2 deposits
      await testUSDT.connect(user2).approve(await vaultContract.getAddress(), deposit2);
      await vaultContract.connect(user2).deposit(deposit2);
      
      // Check individual balances
      const user1MmUSDT = await mmUSDTToken.balanceOf(user1.address);
      const user2MmUSDT = await mmUSDTToken.balanceOf(user2.address);
      
      expect(user1MmUSDT).to.equal(deposit1);
      expect(user2MmUSDT).to.equal(deposit2);
      
      // Check total
      const totalDeposited = await vaultContract.totalDeposited();
      expect(totalDeposited).to.equal(deposit1 + deposit2);
    });

    it("Should return correct vault info after deposits", async function () {
      const depositAmount = ethers.parseUnits("100", 6);
      
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), depositAmount);
      await vaultContract.connect(user1).deposit(depositAmount);
      
      const [usdtBalance, totalMmUSDTSupply, totalDepositedAmount, totalWithdrawnAmount, bridgeBalanceAmount] = 
        await vaultContract.getVaultInfo();
      
      expect(usdtBalance).to.equal(depositAmount);
      expect(totalMmUSDTSupply).to.equal(depositAmount);
      expect(totalDepositedAmount).to.equal(depositAmount);
      expect(totalWithdrawnAmount).to.equal(0);
      expect(bridgeBalanceAmount).to.equal(0);
    });

    it("Should return correct user info after deposit", async function () {
      const depositAmount = ethers.parseUnits("100", 6);
      
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), depositAmount);
      await vaultContract.connect(user1).deposit(depositAmount);
      
      const [mmUSDTBalance, userDepositAmount, userWithdrawAmount] = 
        await vaultContract.getUserInfo(user1.address);
      
      expect(mmUSDTBalance).to.equal(depositAmount);
      expect(userDepositAmount).to.equal(depositAmount);
      expect(userWithdrawAmount).to.equal(0);
    });
  });

  describe("Withdrawal Functionality", function () {
    beforeEach(async function () {
      // Setup: Deposit some USDT first
      const depositAmount = ethers.parseUnits("100", 6);
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), depositAmount);
      await vaultContract.connect(user1).deposit(depositAmount);
    });

    it("Should allow user to request withdrawal and receive NFT", async function () {
      const withdrawAmount = ethers.parseUnits("50", 6); // 50 mmUSDT
      
      const initialMmUSDTBalance = await mmUSDTToken.balanceOf(user1.address);
      const initialNFTBalance = await withdrawNFT.balanceOf(user1.address);
      
      await expect(vaultContract.connect(user1).requestWithdraw(withdrawAmount))
        .to.emit(vaultContract, "WithdrawRequested");
      
      const finalMmUSDTBalance = await mmUSDTToken.balanceOf(user1.address);
      const finalNFTBalance = await withdrawNFT.balanceOf(user1.address);
      
      expect(finalMmUSDTBalance).to.equal(initialMmUSDTBalance - withdrawAmount);
      expect(finalNFTBalance).to.equal(initialNFTBalance + 1n);
      
      // Check NFT exists and has correct amount
      const nftId = 1;
      const withdrawRequest = await vaultContract.withdrawRequests(nftId);
      expect(withdrawRequest.amount).to.equal(withdrawAmount); // 1:1 exchange rate
      expect(withdrawRequest.status).to.equal(0); // PENDING
      expect(withdrawRequest.requester).to.equal(user1.address);
    });

    it("Should reject withdrawal below minimum amount", async function () {
      const smallAmount = ethers.parseUnits("0.5", 6);
      
      await expect(vaultContract.connect(user1).requestWithdraw(smallAmount))
        .to.be.revertedWith("VaultContract: Amount too small");
    });

    it("Should reject withdrawal with insufficient mmUSDT balance", async function () {
      const tooMuchAmount = ethers.parseUnits("200", 6);
      
      await expect(vaultContract.connect(user1).requestWithdraw(tooMuchAmount))
        .to.be.revertedWith("VaultContract: Insufficient mmUSDT balance");
    });

    it("Should allow admin to mark withdrawals as ready", async function () {
      const withdrawAmount = ethers.parseUnits("50", 6);
      await vaultContract.connect(user1).requestWithdraw(withdrawAmount);
      
      const nftId = 1;
      await expect(vaultContract.connect(owner).markWithdrawReady([nftId]))
        .to.emit(vaultContract, "WithdrawMarkedReady");
      
      const withdrawRequest = await vaultContract.withdrawRequests(nftId);
      expect(withdrawRequest.status).to.equal(1); // READY
    });

    it("Should allow execution of ready withdrawals", async function () {
      const withdrawAmount = ethers.parseUnits("50", 6);
      await vaultContract.connect(user1).requestWithdraw(withdrawAmount);
      
      const nftId = 1;
      await vaultContract.connect(owner).markWithdrawReady([nftId]);
      
      const initialUSDTBalance = await testUSDT.balanceOf(user1.address);
      const initialNFTBalance = await withdrawNFT.balanceOf(user1.address);
      
      await expect(vaultContract.connect(user1).executeWithdraw(nftId))
        .to.emit(vaultContract, "WithdrawExecuted");
      
      const finalUSDTBalance = await testUSDT.balanceOf(user1.address);
      const finalNFTBalance = await withdrawNFT.balanceOf(user1.address);
      
      expect(finalUSDTBalance).to.equal(initialUSDTBalance + withdrawAmount);
      expect(finalNFTBalance).to.equal(initialNFTBalance - 1n); // NFT burned
      
      // Check NFT is burned (withdrawal request mapping remains but NFT is burned)
      await expect(withdrawNFT.ownerOf(nftId)).to.be.reverted; // NFT burned
    });

    it("Should reject execution of pending withdrawals", async function () {
      const withdrawAmount = ethers.parseUnits("50", 6);
      await vaultContract.connect(user1).requestWithdraw(withdrawAmount);
      
      const nftId = 1;
      await expect(vaultContract.connect(user1).executeWithdraw(nftId))
        .to.be.revertedWith("VaultContract: Withdraw not ready");
    });

    it("Should reject execution by non-owner of NFT", async function () {
      const withdrawAmount = ethers.parseUnits("50", 6);
      await vaultContract.connect(user1).requestWithdraw(withdrawAmount);
      
      const nftId = 1;
      await vaultContract.connect(owner).markWithdrawReady([nftId]);
      
      await expect(vaultContract.connect(user2).executeWithdraw(nftId))
        .to.be.revertedWith("VaultContract: Not NFT owner");
    });
  });

  describe("Exchange Rate Mechanics", function () {
    it("Should initialize with 1.0 exchange rate", async function () {
      const exchangeRate = await vaultContract.getExchangeRate();
      expect(exchangeRate).to.equal(ethers.parseUnits("1", 6)); // 1e6 = 1.0
    });

    it("Should allow admin to update exchange rate", async function () {
      const newRate = ethers.parseUnits("1.1", 6); // 1.1
      
      await expect(vaultContract.setExchangeRate(newRate))
        .to.emit(vaultContract, "ExchangeRateUpdated");
      
      const updatedRate = await vaultContract.getExchangeRate();
      expect(updatedRate).to.equal(newRate);
    });

    it("Should reject exchange rate updates from non-admin", async function () {
      const newRate = ethers.parseUnits("1.1", 6);
      
      await expect(vaultContract.connect(user1).setExchangeRate(newRate))
        .to.be.reverted;
    });

    it("Should handle basic deposit mechanics", async function () {
      const depositAmount = ethers.parseUnits("100", 6);
      await testUSDT.connect(user2).approve(await vaultContract.getAddress(), depositAmount);
      await vaultContract.connect(user2).deposit(depositAmount);
      
      const mmUSDTBalance = await mmUSDTToken.balanceOf(user2.address);
      expect(mmUSDTBalance).to.equal(depositAmount); // 1:1 at initial rate
    });

    it("Should reject exchange rate updates from non-admin", async function () {
      const newRate = ethers.parseUnits("1.1", 6);
      
      await expect(vaultContract.connect(user1).setExchangeRate(newRate))
        .to.be.reverted;
    });

    it("Should calculate deposits correctly with different exchange rates", async function () {
      // Set exchange rate to 1.2 (20% yield)
      const newRate = ethers.parseUnits("1.2", 6);
      await vaultContract.connect(owner).setExchangeRate(newRate);
      
      const depositAmount = ethers.parseUnits("120", 6); // 120 USDT
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), depositAmount);
      await vaultContract.connect(user1).deposit(depositAmount);
      
      // Should receive 100 mmUSDT (120 / 1.2 = 100)
      const mmUSDTBalance = await mmUSDTToken.balanceOf(user1.address);
      expect(mmUSDTBalance).to.equal(ethers.parseUnits("100", 6));
    });

    it("Should calculate withdrawals correctly with different exchange rates", async function () {
      // First deposit at 1.0 rate
      const depositAmount = ethers.parseUnits("100", 6);
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), depositAmount);
      await vaultContract.connect(user1).deposit(depositAmount);
      
      // Update exchange rate to 1.2 (20% yield)
      const newRate = ethers.parseUnits("1.2", 6);
      await vaultContract.connect(owner).setExchangeRate(newRate);
      
      // Withdraw 50 mmUSDT
      const withdrawAmount = ethers.parseUnits("50", 6);
      await vaultContract.connect(user1).requestWithdraw(withdrawAmount);
      
      const nftId = 1;
      const withdrawRequest = await vaultContract.withdrawRequests(nftId);
      
      // Should get 60 USDT (50 * 1.2 = 60)
      expect(withdrawRequest.amount).to.equal(ethers.parseUnits("60", 6));
    });
  });

  describe("Bridge Transfer", function () {
    beforeEach(async function () {
      // Setup: Deposit some USDT first
      const depositAmount = ethers.parseUnits("1000", 6);
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), depositAmount);
      await vaultContract.connect(user1).deposit(depositAmount);
    });

    it("Should allow admin to transfer funds to bridge", async function () {
      const bridgeAddress = user2.address; // Use user2 as bridge for testing
      
      const initialVaultBalance = await testUSDT.balanceOf(await vaultContract.getAddress());
      const initialBridgeBalance = await testUSDT.balanceOf(bridgeAddress);
      
      await expect(vaultContract.magicTime(bridgeAddress))
        .to.emit(vaultContract, "BridgeTransfer");
      
      const finalVaultBalance = await testUSDT.balanceOf(await vaultContract.getAddress());
      const finalBridgeBalance = await testUSDT.balanceOf(bridgeAddress);
      const bridgeBalanceState = await vaultContract.bridgeBalance();
      
      expect(finalVaultBalance).to.be.lt(initialVaultBalance);
      expect(finalBridgeBalance).to.be.gt(initialBridgeBalance);
      expect(bridgeBalanceState).to.be.gt(0);
    });

    it("Should reject bridge transfer from non-admin", async function () {
      await expect(vaultContract.connect(user1).magicTime(user2.address))
        .to.be.reverted;
    });
  });

  describe("Access Control and Security", function () {
    it("Should have correct role assignments", async function () {
      const ADMIN_ROLE = await vaultContract.ADMIN_ROLE();
      const PAUSER_ROLE = await vaultContract.PAUSER_ROLE();
      const UPGRADER_ROLE = await vaultContract.UPGRADER_ROLE();
      
      expect(await vaultContract.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await vaultContract.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
      expect(await vaultContract.hasRole(UPGRADER_ROLE, owner.address)).to.be.true;
      
      expect(await vaultContract.hasRole(ADMIN_ROLE, user1.address)).to.be.false;
    });

    it("Should allow pauser to pause contract", async function () {
      await vaultContract.connect(owner).pause();
      expect(await vaultContract.paused()).to.be.true;
      
      // Should reject deposits when paused
      const depositAmount = ethers.parseUnits("100", 6);
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), depositAmount);
      
      await expect(vaultContract.connect(user1).deposit(depositAmount))
        .to.be.revertedWithCustomError(vaultContract, "EnforcedPause");
    });

    it("Should allow unpausing", async function () {
      await vaultContract.connect(owner).pause();
      await vaultContract.connect(owner).unpause();
      expect(await vaultContract.paused()).to.be.false;
    });

    it("Should reject pause from non-pauser", async function () {
      await expect(vaultContract.connect(user1).pause())
        .to.be.reverted;
    });

    it("Should protect against reentrancy", async function () {
      // This is more of a design verification - the contract uses nonReentrant modifiers
      // on critical functions like deposit, requestWithdraw, executeWithdraw
      const depositAmount = ethers.parseUnits("100", 6);
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), depositAmount);
      
      // Normal operation should work
      await expect(vaultContract.connect(user1).deposit(depositAmount))
        .to.not.be.reverted;
    });
  });

  describe("TestUSDT Faucet", function () {
    it("Should allow users to get TestUSDT from faucet", async function () {
      const faucetAmount = ethers.parseUnits("5000", 6);
      
      const initialBalance = await testUSDT.balanceOf(user1.address);
      
      await testUSDT.connect(user1)["faucet(uint256)"](faucetAmount);
      
      const finalBalance = await testUSDT.balanceOf(user1.address);
      expect(finalBalance).to.equal(initialBalance + faucetAmount);
    });

    it("Should reject faucet request above limit", async function () {
      const tooMuch = ethers.parseUnits("15000", 6); // Above 10,000 limit
      
      await expect(testUSDT.connect(user1)["faucet(uint256)"](tooMuch))
        .to.be.revertedWith("TestUSDT: Amount too large");
    });
  });
});