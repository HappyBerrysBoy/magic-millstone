const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("VaultContract Deposit Tests", function () {
  let testUSDT, mmUSDTToken, withdrawNFT, vaultContract;
  let owner, user1, user2;
  
  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy TestUSDT
    const TestUSDT = await ethers.getContractFactory("TestUSDT");
    testUSDT = await TestUSDT.deploy();
    await testUSDT.waitForDeployment();

    // Deploy mmUSDT as upgradeable proxy
    const MmUSDT = await ethers.getContractFactory("mmUSDT");
    mmUSDTToken = await upgrades.deployProxy(MmUSDT, [
      "Magic Millstone USDT",
      "mmUSDT", 
      6, // 6 decimals to match USDT
      owner.address
    ]);
    await mmUSDTToken.waitForDeployment();

    // Deploy WithdrawNFT (assuming it's upgradeable)
    const WithdrawNFT = await ethers.getContractFactory("WithdrawNFT");
    withdrawNFT = await upgrades.deployProxy(WithdrawNFT, [
      "Withdraw NFT",
      "WNFT",
      owner.address
    ]);
    await withdrawNFT.waitForDeployment();

    // Deploy VaultContract as upgradeable proxy
    const VaultContract = await ethers.getContractFactory("VaultContract");
    vaultContract = await upgrades.deployProxy(VaultContract, [
      await testUSDT.getAddress(),
      await mmUSDTToken.getAddress(),
      await withdrawNFT.getAddress(),
      owner.address
    ]);
    await vaultContract.waitForDeployment();

    // Grant necessary roles
    const MINTER_ROLE = await mmUSDTToken.MINTER_ROLE();
    const BURNER_ROLE = await mmUSDTToken.BURNER_ROLE();
    const MINTER_ROLE_NFT = await withdrawNFT.MINTER_ROLE();
    const BURNER_ROLE_NFT = await withdrawNFT.BURNER_ROLE();
    const MANAGER_ROLE_NFT = await withdrawNFT.MANAGER_ROLE();
    
    await mmUSDTToken.grantRole(MINTER_ROLE, await vaultContract.getAddress());
    await mmUSDTToken.grantRole(BURNER_ROLE, await vaultContract.getAddress());
    await withdrawNFT.grantRole(MINTER_ROLE_NFT, await vaultContract.getAddress());
    await withdrawNFT.grantRole(BURNER_ROLE_NFT, await vaultContract.getAddress());
    await withdrawNFT.grantRole(MANAGER_ROLE_NFT, await vaultContract.getAddress());

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

