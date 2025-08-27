import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("KIP Compliance Tests", function () {
  let mmUSDTToken: Contract, withdrawNFT: Contract;
  let owner: HardhatEthersSigner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    // Deploy mmUSDT as upgradeable proxy
    const MmUSDT = await ethers.getContractFactory("mmUSDT");
    mmUSDTToken = await upgrades.deployProxy(MmUSDT, [
      "Magic Millstone USDT",
      "mmUSDT",
      6,
      owner.address,
    ]);
    await mmUSDTToken.waitForDeployment();

    // Deploy WithdrawNFT as upgradeable proxy
    const WithdrawNFT = await ethers.getContractFactory("WithdrawNFT");
    withdrawNFT = await upgrades.deployProxy(WithdrawNFT, [
      "Withdraw NFT",
      "WNFT",
      owner.address,
      ethers.ZeroAddress, // placeholder for vault contract
    ]);
    await withdrawNFT.waitForDeployment();
  });

  describe("KIP-7 Compliance (mmUSDT)", function () {
    it("Should support KIP-7 interface", async function () {
      const KIP7_INTERFACE_ID = "0x65787371";
      const supportsKIP7 = await mmUSDTToken.supportsInterface(
        KIP7_INTERFACE_ID
      );
      expect(supportsKIP7).to.be.true;
    });

    it("Should support ERC165 interface (base interface)", async function () {
      const ERC165_INTERFACE_ID = "0x01ffc9a7";
      const supportsERC165 = await mmUSDTToken.supportsInterface(
        ERC165_INTERFACE_ID
      );
      expect(supportsERC165).to.be.true;
    });

    it("Should have required KIP-7/ERC-20 functions", async function () {
      // Check that all required functions exist
      expect(mmUSDTToken.name).to.exist;
      expect(mmUSDTToken.symbol).to.exist;
      expect(mmUSDTToken.decimals).to.exist;
      expect(mmUSDTToken.totalSupply).to.exist;
      expect(mmUSDTToken.balanceOf).to.exist;
      expect(mmUSDTToken.transfer).to.exist;
      expect(mmUSDTToken.transferFrom).to.exist;
      expect(mmUSDTToken.approve).to.exist;
      expect(mmUSDTToken.allowance).to.exist;

      // Test some function calls
      const name = await mmUSDTToken.name();
      const symbol = await mmUSDTToken.symbol();
      const decimals = await mmUSDTToken.decimals();
      const totalSupply = await mmUSDTToken.totalSupply();

      expect(name).to.equal("Magic Millstone USDT");
      expect(symbol).to.equal("mmUSDT");
      expect(decimals).to.equal(6);
      expect(totalSupply).to.equal(0); // Initially 0
    });
  });

  describe("KIP-17 Compliance (WithdrawNFT)", function () {
    it("Should support KIP-17 interface", async function () {
      const KIP17_INTERFACE_ID = "0x80ac58cd";
      const supportsKIP17 = await withdrawNFT.supportsInterface(
        KIP17_INTERFACE_ID
      );
      expect(supportsKIP17).to.be.true;
    });

    it("Should support ERC721 interface (inherited by KIP-17)", async function () {
      const ERC721_INTERFACE_ID = "0x80ac58cd";
      const supportsERC721 = await withdrawNFT.supportsInterface(
        ERC721_INTERFACE_ID
      );
      expect(supportsERC721).to.be.true;
    });

    it("Should support ERC721Metadata interface", async function () {
      const ERC721_METADATA_INTERFACE_ID = "0x5b5e139f";
      const supportsMetadata = await withdrawNFT.supportsInterface(
        ERC721_METADATA_INTERFACE_ID
      );
      expect(supportsMetadata).to.be.true;
    });

    it("Should have required KIP-17/ERC-721 functions", async function () {
      // Check that all required functions exist
      expect(withdrawNFT.name).to.exist;
      expect(withdrawNFT.symbol).to.exist;
      expect(withdrawNFT.tokenURI).to.exist;
      expect(withdrawNFT.balanceOf).to.exist;
      expect(withdrawNFT.ownerOf).to.exist;
      expect(withdrawNFT.transferFrom).to.exist;
      expect(withdrawNFT.approve).to.exist;
      expect(withdrawNFT.getApproved).to.exist;
      expect(withdrawNFT.setApprovalForAll).to.exist;
      expect(withdrawNFT.isApprovedForAll).to.exist;

      // Test some function calls
      const name = await withdrawNFT.name();
      const symbol = await withdrawNFT.symbol();

      expect(name).to.equal("Withdraw NFT");
      expect(symbol).to.equal("WNFT");
    });

    it("Should generate proper tokenURI for minted tokens", async function () {
      // Grant minter role to owner for testing
      const MINTER_ROLE = await withdrawNFT.MINTER_ROLE();
      await withdrawNFT.grantRole(MINTER_ROLE, owner.address);

      // Mint a test token
      const amount = ethers.parseUnits("100", 6);
      await withdrawNFT.mint(owner.address, amount);

      // Get tokenURI
      const tokenURI = await withdrawNFT.tokenURI(1);
      expect(tokenURI).to.include("data:application/json;base64");

      // Decode and verify JSON structure
      const base64Data = tokenURI.replace("data:application/json;base64,", "");
      const decodedData = Buffer.from(base64Data, "base64").toString("utf8");
      const metadata = JSON.parse(decodedData);

      expect(metadata.name).to.include("Withdrawal Request #1");
      expect(metadata.description).to.equal("USDT Withdrawal Request");
      expect(metadata.status).to.equal("PENDING");
      expect(metadata.amount).to.equal("100.0");
    });
  });

  describe("Interface Integration", function () {
    it("Should maintain AccessControl interface support", async function () {
      const ACCESS_CONTROL_INTERFACE_ID = "0x7965db0b";

      const mmUSDTSupportsAccessControl = await mmUSDTToken.supportsInterface(
        ACCESS_CONTROL_INTERFACE_ID
      );
      const withdrawNFTSupportsAccessControl =
        await withdrawNFT.supportsInterface(ACCESS_CONTROL_INTERFACE_ID);

      expect(mmUSDTSupportsAccessControl).to.be.true;
      expect(withdrawNFTSupportsAccessControl).to.be.true;
    });

    it("Should return false for unsupported interfaces", async function () {
      const RANDOM_INTERFACE_ID = "0x12345678";

      const mmUSDTSupportsRandom = await mmUSDTToken.supportsInterface(
        RANDOM_INTERFACE_ID
      );
      const withdrawNFTSupportsRandom = await withdrawNFT.supportsInterface(
        RANDOM_INTERFACE_ID
      );

      expect(mmUSDTSupportsRandom).to.be.false;
      expect(withdrawNFTSupportsRandom).to.be.false;
    });
  });
});
