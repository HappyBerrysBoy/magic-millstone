const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Simple Contract Test", function () {
  let testUSDT;
  let owner, user1;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    // Deploy TestUSDT
    const TestUSDTFactory = await ethers.getContractFactory("TestUSDT");
    testUSDT = await TestUSDTFactory.deploy();
    await testUSDT.waitForDeployment();
  });

  it("Should deploy TestUSDT successfully", async function () {
    expect(await testUSDT.getAddress()).to.not.equal(ethers.ZeroAddress);
    expect(await testUSDT.symbol()).to.equal("USDT");
  });

  it("Should allow faucet usage", async function () {
    const amount = ethers.parseUnits("1000", 6);
    await testUSDT.connect(user1).faucet(amount);
    
    const balance = await testUSDT.balanceOf(await user1.getAddress());
    expect(balance).to.equal(amount);
  });
});