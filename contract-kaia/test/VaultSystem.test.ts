import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { TestUSDT, MmUSDT, WithdrawNFT, VaultContract } from "../types/ethers-contracts";

describe("KAIA Yield Farming Vault System", function () {
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let admin: HardhatEthersSigner;

  let testUSDT: TestUSDT;
  let mmUSDTToken: MmUSDT;
  let withdrawNFT: WithdrawNFT;
  let vaultContract: VaultContract;

  const USDT_DECIMALS = 6;
  const INITIAL_BALANCE = ethers.parseUnits("10000", USDT_DECIMALS);
  const DEPOSIT_AMOUNT = ethers.parseUnits("1000", USDT_DECIMALS);
  const WITHDRAW_AMOUNT = ethers.parseUnits("500", USDT_DECIMALS);

  beforeEach(async function () {
    [owner, user1, user2, admin] = await ethers.getSigners();

    // Deploy TestUSDT
    const TestUSDTFactory = await ethers.getContractFactory("TestUSDT");
    testUSDT = (await TestUSDTFactory.deploy()) as unknown as TestUSDT;
    await testUSDT.waitForDeployment();

    // Deploy mmUSDT as upgradeable
    const mmUSDTFactory = await ethers.getContractFactory("mmUSDT");
    mmUSDTToken = (await upgrades.deployProxy(
      mmUSDTFactory,
      ["Magic Millstone USDT", "mmUSDT", USDT_DECIMALS, await admin.getAddress()],
      { initializer: "initialize" }
    )) as unknown as MmUSDT;
    await mmUSDTToken.waitForDeployment();

    // Deploy WithdrawNFT as upgradeable (vaultContract will be set later)
    const WithdrawNFTFactory = await ethers.getContractFactory("WithdrawNFT");
    withdrawNFT = (await upgrades.deployProxy(
      WithdrawNFTFactory,
      ["Withdraw Request NFT", "wNFT", await admin.getAddress(), ethers.ZeroAddress],
      { initializer: "initialize" }
    )) as unknown as WithdrawNFT;
    await withdrawNFT.waitForDeployment();

    // Deploy VaultContract as upgradeable
    const VaultContractFactory = await ethers.getContractFactory("VaultContract");
    vaultContract = (await upgrades.deployProxy(
      VaultContractFactory,
      [
        await testUSDT.getAddress(),
        await mmUSDTToken.getAddress(),
        await withdrawNFT.getAddress(),
        await admin.getAddress()
      ],
      { initializer: "initialize" }
    )) as unknown as VaultContract;
    await vaultContract.waitForDeployment();

    // Setup roles
    const MINTER_ROLE = await mmUSDTToken.MINTER_ROLE();
    const BURNER_ROLE = await mmUSDTToken.BURNER_ROLE();
    const NFT_MINTER_ROLE = await withdrawNFT.MINTER_ROLE();
    const NFT_BURNER_ROLE = await withdrawNFT.BURNER_ROLE();

    await mmUSDTToken.connect(admin).grantRole(MINTER_ROLE, await vaultContract.getAddress());
    await mmUSDTToken.connect(admin).grantRole(BURNER_ROLE, await vaultContract.getAddress());
    await withdrawNFT.connect(admin).grantRole(NFT_MINTER_ROLE, await vaultContract.getAddress());
    await withdrawNFT.connect(admin).grantRole(NFT_BURNER_ROLE, await vaultContract.getAddress());
    
    // Update vault contract address in WithdrawNFT
    await withdrawNFT.connect(admin).updateVaultContract(await vaultContract.getAddress());

    // Distribute test USDT to users
    await testUSDT.connect(user1).faucet(INITIAL_BALANCE);
    await testUSDT.connect(user2).faucet(INITIAL_BALANCE);
  });

  describe("Deployment", function () {
    it("Should deploy all contracts successfully", async function () {
      expect(await testUSDT.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await mmUSDTToken.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await withdrawNFT.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await vaultContract.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("Should set correct initial values", async function () {
      expect(await testUSDT.symbol()).to.equal("USDT");
      expect(await mmUSDTToken.symbol()).to.equal("mmUSDT");
      expect(await withdrawNFT.symbol()).to.equal("wNFT");
    });
  });

  describe("Deposit Flow", function () {
    it("Should allow users to deposit USDT and receive mmUSDT", async function () {
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), DEPOSIT_AMOUNT);
      
      await expect(vaultContract.connect(user1).deposit(DEPOSIT_AMOUNT))
        .to.emit(vaultContract, "Deposited")
        .withArgs(await user1.getAddress(), DEPOSIT_AMOUNT, DEPOSIT_AMOUNT, await ethers.provider.getBlock("latest").then((b: any) => b!.timestamp + 1));

      expect(await mmUSDTToken.balanceOf(await user1.getAddress())).to.equal(DEPOSIT_AMOUNT);
      expect(await testUSDT.balanceOf(await vaultContract.getAddress())).to.equal(DEPOSIT_AMOUNT);
    });

    it("Should reject deposits below minimum", async function () {
      const smallAmount = ethers.parseUnits("0.5", USDT_DECIMALS);
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), smallAmount);
      
      await expect(vaultContract.connect(user1).deposit(smallAmount))
        .to.be.revertedWith("VaultContract: Amount too small");
    });
  });

  describe("Withdraw Request Flow", function () {
    beforeEach(async function () {
      // User deposits first
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), DEPOSIT_AMOUNT);
      await vaultContract.connect(user1).deposit(DEPOSIT_AMOUNT);
    });

    it("Should allow users to request withdrawal and receive NFT", async function () {
      await expect(vaultContract.connect(user1).requestWithdraw(WITHDRAW_AMOUNT))
        .to.emit(vaultContract, "WithdrawRequested");

      expect(await mmUSDTToken.balanceOf(await user1.getAddress())).to.equal(DEPOSIT_AMOUNT - WITHDRAW_AMOUNT);
      expect(await withdrawNFT.balanceOf(await user1.getAddress())).to.equal(1);
    });

    it("Should reject withdrawal requests exceeding mmUSDT balance", async function () {
      const excessiveAmount = DEPOSIT_AMOUNT + ethers.parseUnits("100", USDT_DECIMALS);
      
      await expect(vaultContract.connect(user1).requestWithdraw(excessiveAmount))
        .to.be.revertedWith("VaultContract: Insufficient mmUSDT balance");
    });
  });

  describe("Withdraw Execution Flow", function () {
    let nftId: bigint;

    beforeEach(async function () {
      // User deposits and requests withdrawal
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), DEPOSIT_AMOUNT);
      await vaultContract.connect(user1).deposit(DEPOSIT_AMOUNT);
      
      const tx = await vaultContract.connect(user1).requestWithdraw(WITHDRAW_AMOUNT);
      const receipt = await tx.wait();
      const event = receipt!.logs.find((log: any) => {
        try {
          return vaultContract.interface.parseLog(log)?.name === "WithdrawRequested";
        } catch {
          return false;
        }
      });
      
      if (event) {
        const parsedEvent = vaultContract.interface.parseLog(event);
        nftId = parsedEvent!.args[2];
      }
    });

    it("Should allow admin to mark withdrawals as ready", async function () {
      await expect(vaultContract.connect(admin).markWithdrawReady([nftId]))
        .to.emit(withdrawNFT, "WithdrawStatusUpdated");

      const request = await withdrawNFT.getWithdrawRequest(nftId);
      expect(request.status).to.equal(1); // READY status
    });

    it("Should allow users to execute ready withdrawals", async function () {
      await vaultContract.connect(admin).markWithdrawReady([nftId]);
      
      const initialBalance = await testUSDT.balanceOf(await user1.getAddress());
      
      await expect(vaultContract.connect(user1).executeWithdraw(nftId))
        .to.emit(vaultContract, "WithdrawExecuted");

      const finalBalance = await testUSDT.balanceOf(await user1.getAddress());
      expect(finalBalance - initialBalance).to.equal(WITHDRAW_AMOUNT);
      expect(await withdrawNFT.balanceOf(await user1.getAddress())).to.equal(0);
    });

    it("Should reject execution of pending withdrawals", async function () {
      await expect(vaultContract.connect(user1).executeWithdraw(nftId))
        .to.be.revertedWith("VaultContract: Withdraw not ready");
    });
  });

  describe("Bridge Operations", function () {
    beforeEach(async function () {
      // Add some USDT to vault
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), DEPOSIT_AMOUNT);
      await vaultContract.connect(user1).deposit(DEPOSIT_AMOUNT);
    });

    it("Should allow admin to transfer to bridge", async function () {
      const bridgeAmount = ethers.parseUnits("100", USDT_DECIMALS);
      
      await expect(vaultContract.connect(admin).transferToBridge(bridgeAmount))
        .to.emit(vaultContract, "BridgeTransfer");

      const vaultInfo = await vaultContract.getVaultInfo();
      expect(vaultInfo.bridgeBalanceAmount).to.equal(bridgeAmount);
    });

    it("Should allow admin to deposit from bridge", async function () {
      const bridgeAmount = ethers.parseUnits("100", USDT_DECIMALS);
      
      // Transfer to bridge first
      await vaultContract.connect(admin).transferToBridge(bridgeAmount);
      
      // Simulate bridge return with profit
      const returnAmount = ethers.parseUnits("110", USDT_DECIMALS);
      await testUSDT.connect(admin).faucet(returnAmount);
      await testUSDT.connect(admin).approve(await vaultContract.getAddress(), returnAmount);
      
      await expect(vaultContract.connect(admin).depositFromBridge(returnAmount))
        .to.emit(vaultContract, "BridgeDeposit");
    });
  });

  describe("NFT Metadata", function () {
    let nftId: bigint;

    beforeEach(async function () {
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), DEPOSIT_AMOUNT);
      await vaultContract.connect(user1).deposit(DEPOSIT_AMOUNT);
      
      const tx = await vaultContract.connect(user1).requestWithdraw(WITHDRAW_AMOUNT);
      const receipt = await tx.wait();
      const event = receipt!.logs.find((log: any) => {
        try {
          return vaultContract.interface.parseLog(log)?.name === "WithdrawRequested";
        } catch {
          return false;
        }
      });
      
      if (event) {
        const parsedEvent = vaultContract.interface.parseLog(event);
        nftId = parsedEvent!.args[2];
      }
    });

    it("Should return correct metadata for NFT", async function () {
      const tokenURI = await withdrawNFT.tokenURI(nftId);
      expect(tokenURI).to.include("data:application/json;base64,");
      
      const base64Data = tokenURI.split(",")[1];
      const jsonData = Buffer.from(base64Data, "base64").toString();
      const metadata = JSON.parse(jsonData);
      
      expect(metadata.name).to.include("Withdraw Request #");
      expect(metadata.status).to.equal("PENDING");
      expect(metadata.amount).to.equal("500.0");
    });
  });

  describe("Access Control", function () {
    it("Should only allow admin to mark withdrawals ready", async function () {
      await expect(vaultContract.connect(user1).markWithdrawReady([1]))
        .to.be.reverted;
    });

    it("Should only allow admin to transfer to bridge", async function () {
      await expect(vaultContract.connect(user1).transferToBridge(100))
        .to.be.reverted;
    });
  });

  describe("getUserWithdrawals Function", function () {
    beforeEach(async function () {
      // User1 deposits and creates multiple withdrawal requests
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), DEPOSIT_AMOUNT);
      await vaultContract.connect(user1).deposit(DEPOSIT_AMOUNT);
      
      // User2 also deposits to test isolation
      await testUSDT.connect(user2).approve(await vaultContract.getAddress(), DEPOSIT_AMOUNT);
      await vaultContract.connect(user2).deposit(DEPOSIT_AMOUNT);
    });

    it("Should return empty arrays for user with no withdrawals", async function () {
      const result = await withdrawNFT.getUserWithdrawals(await admin.getAddress());
      expect(result.tokenIds.length).to.equal(0);
      expect(result.amounts.length).to.equal(0);
      expect(result.totalAmount).to.equal(0);
    });

    it("Should return correct data for user with single withdrawal", async function () {
      const withdrawAmount = ethers.parseUnits("200", USDT_DECIMALS);
      await vaultContract.connect(user1).requestWithdraw(withdrawAmount);
      
      const result = await withdrawNFT.getUserWithdrawals(await user1.getAddress());
      expect(result.tokenIds.length).to.equal(1);
      expect(result.amounts.length).to.equal(1);
      expect(result.amounts[0]).to.equal(withdrawAmount);
      expect(result.totalAmount).to.equal(withdrawAmount);
    });

    it("Should return correct data for user with multiple withdrawals", async function () {
      const withdrawal1 = ethers.parseUnits("200", USDT_DECIMALS);
      const withdrawal2 = ethers.parseUnits("300", USDT_DECIMALS);
      
      await vaultContract.connect(user1).requestWithdraw(withdrawal1);
      await vaultContract.connect(user1).requestWithdraw(withdrawal2);
      
      const result = await withdrawNFT.getUserWithdrawals(await user1.getAddress());
      expect(result.tokenIds.length).to.equal(2);
      expect(result.amounts.length).to.equal(2);
      expect(result.totalAmount).to.equal(withdrawal1 + withdrawal2);
    });

    it("Should isolate withdrawals between different users", async function () {
      const user1Amount = ethers.parseUnits("200", USDT_DECIMALS);
      const user2Amount = ethers.parseUnits("150", USDT_DECIMALS);
      
      await vaultContract.connect(user1).requestWithdraw(user1Amount);
      await vaultContract.connect(user2).requestWithdraw(user2Amount);
      
      const user1Result = await withdrawNFT.getUserWithdrawals(await user1.getAddress());
      const user2Result = await withdrawNFT.getUserWithdrawals(await user2.getAddress());
      
      expect(user1Result.tokenIds.length).to.equal(1);
      expect(user1Result.totalAmount).to.equal(user1Amount);
      
      expect(user2Result.tokenIds.length).to.equal(1);
      expect(user2Result.totalAmount).to.equal(user2Amount);
    });

    it("Should test specific address 0x26AC28D33EcBf947951d6B7d8a1e6569eE73d076", async function () {
      const testAddress = "0x26AC28D33EcBf947951d6B7d8a1e6569eE73d076";
      const result = await withdrawNFT.getUserWithdrawals(testAddress);
      
      console.log("Address:", testAddress);
      console.log("Token IDs:", result.tokenIds.map(id => id.toString()));
      console.log("Amounts:", result.amounts.map(amt => amt.toString()));
      console.log("Total Amount:", result.totalAmount.toString());
      
      expect(result.tokenIds.length).to.equal(0);
      expect(result.amounts.length).to.equal(0);
      expect(result.totalAmount).to.equal(0);
    });

    it("Should not include burned NFTs in results", async function () {
      const withdrawAmount = ethers.parseUnits("200", USDT_DECIMALS);
      const tx = await vaultContract.connect(user1).requestWithdraw(withdrawAmount);
      
      // Get the NFT ID from the event
      const receipt = await tx.wait();
      const event = receipt!.logs.find((log: any) => {
        try {
          return vaultContract.interface.parseLog(log)?.name === "WithdrawRequested";
        } catch {
          return false;
        }
      });
      
      let nftId: bigint = 0n;
      if (event) {
        const parsedEvent = vaultContract.interface.parseLog(event);
        nftId = parsedEvent!.args[2];
      }
      
      // Check if withdrawal is already ready (auto-marked), if not mark it ready
      const request = await vaultContract.getWithdrawRequest(nftId);
      if (request.status === 0) { // PENDING
        await vaultContract.connect(admin).markWithdrawReady([nftId]);
      }
      
      // Execute withdrawal (which burns the NFT)
      await vaultContract.connect(user1).executeWithdraw(nftId);
      
      const result = await withdrawNFT.getUserWithdrawals(await user1.getAddress());
      expect(result.tokenIds.length).to.equal(0);
      expect(result.totalAmount).to.equal(0);
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow admin to emergency withdraw tokens", async function () {
      const amount = ethers.parseUnits("100", USDT_DECIMALS);
      
      // First add some USDT to the vault
      await testUSDT.connect(user1).approve(await vaultContract.getAddress(), DEPOSIT_AMOUNT);
      await vaultContract.connect(user1).deposit(DEPOSIT_AMOUNT);
      
      const initialBalance = await testUSDT.balanceOf(await admin.getAddress());
      
      await expect(vaultContract.connect(admin).emergencyWithdraw(await testUSDT.getAddress(), amount))
        .to.emit(vaultContract, "EmergencyWithdraw");
      
      const finalBalance = await testUSDT.balanceOf(await admin.getAddress());
      expect(finalBalance - initialBalance).to.equal(amount);
    });
  });
});