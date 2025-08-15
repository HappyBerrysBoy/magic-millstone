// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./mmUSDT.sol";
import "./WithdrawNFT.sol";

contract VaultContract is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    IERC20 public usdt;
    mmUSDT public mmUSDTToken;
    WithdrawNFT public withdrawNFT;

    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    uint256 public bridgeBalance;

    uint256 public constant MINIMUM_DEPOSIT = 1e6;
    uint256 public constant MINIMUM_WITHDRAW = 1e6;

    mapping(address => uint256) public userDeposits;
    mapping(address => uint256) public userWithdrawals;

    event Deposited(
        address indexed user,
        uint256 amount,
        uint256 mmUSDTMinted,
        uint256 timestamp
    );

    event WithdrawRequested(
        address indexed user,
        uint256 amount,
        uint256 nftId,
        uint256 timestamp
    );

    event WithdrawExecuted(
        address indexed user,
        uint256 amount,
        uint256 nftId,
        uint256 timestamp
    );

    event BridgeTransfer(
        uint256 amount,
        uint256 timestamp
    );

    event BridgeDeposit(
        uint256 amount,
        uint256 timestamp
    );

    event EmergencyWithdraw(
        address indexed admin,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );

    function initialize(
        address _usdt,
        address _mmUSDTToken,
        address _withdrawNFT,
        address _admin
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        usdt = IERC20(_usdt);
        mmUSDTToken = mmUSDT(_mmUSDTToken);
        withdrawNFT = WithdrawNFT(_withdrawNFT);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(PAUSER_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
    }

    function deposit(uint256 amount) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(amount >= MINIMUM_DEPOSIT, "VaultContract: Amount too small");
        require(amount > 0, "VaultContract: Amount must be greater than 0");

        usdt.safeTransferFrom(msg.sender, address(this), amount);

        mmUSDTToken.mint(msg.sender, amount);

        userDeposits[msg.sender] += amount;
        totalDeposited += amount;

        emit Deposited(msg.sender, amount, amount, block.timestamp);
    }

    function requestWithdraw(uint256 amount) 
        external 
        nonReentrant 
        whenNotPaused 
        returns (uint256) 
    {
        require(amount >= MINIMUM_WITHDRAW, "VaultContract: Amount too small");
        require(amount > 0, "VaultContract: Amount must be greater than 0");
        require(mmUSDTToken.balanceOf(msg.sender) >= amount, "VaultContract: Insufficient mmUSDT balance");

        mmUSDTToken.burn(msg.sender, amount);

        uint256 nftId = withdrawNFT.mint(msg.sender, amount);

        emit WithdrawRequested(msg.sender, amount, nftId, block.timestamp);

        return nftId;
    }

    function executeWithdraw(uint256 nftId) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(withdrawNFT.ownerOf(nftId) == msg.sender, "VaultContract: Not NFT owner");
        
        WithdrawNFT.WithdrawRequest memory request = withdrawNFT.getWithdrawRequest(nftId);
        require(request.status == WithdrawNFT.WithdrawStatus.READY, "VaultContract: Withdraw not ready");
        require(request.requester == msg.sender, "VaultContract: Not original requester");

        uint256 amount = request.amount;
        require(usdt.balanceOf(address(this)) >= amount, "VaultContract: Insufficient USDT balance");

        withdrawNFT.markWithdrawClaimed(nftId);
        withdrawNFT.burn(nftId);

        usdt.safeTransfer(msg.sender, amount);

        userWithdrawals[msg.sender] += amount;
        totalWithdrawn += amount;

        emit WithdrawExecuted(msg.sender, amount, nftId, block.timestamp);
    }

    function markWithdrawReady(uint256[] calldata nftIds) 
        external 
        onlyRole(ADMIN_ROLE) 
        whenNotPaused 
    {
        withdrawNFT.markWithdrawReady(nftIds);
    }

    function transferToBridge(uint256 amount) 
        external 
        onlyRole(ADMIN_ROLE) 
        nonReentrant 
        whenNotPaused 
    {
        require(amount > 0, "VaultContract: Amount must be greater than 0");
        require(usdt.balanceOf(address(this)) >= amount, "VaultContract: Insufficient balance");

        usdt.safeTransfer(msg.sender, amount);
        bridgeBalance += amount;

        emit BridgeTransfer(amount, block.timestamp);
    }

    function depositFromBridge(uint256 amount) 
        external 
        onlyRole(ADMIN_ROLE) 
        nonReentrant 
        whenNotPaused 
    {
        require(amount > 0, "VaultContract: Amount must be greater than 0");

        usdt.safeTransferFrom(msg.sender, address(this), amount);
        
        if (bridgeBalance >= amount) {
            bridgeBalance -= amount;
        } else {
            bridgeBalance = 0;
        }

        emit BridgeDeposit(amount, block.timestamp);
    }

    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(token != address(0), "VaultContract: Invalid token address");
        require(amount > 0, "VaultContract: Amount must be greater than 0");

        IERC20(token).safeTransfer(msg.sender, amount);

        emit EmergencyWithdraw(msg.sender, token, amount, block.timestamp);
    }

    function getVaultInfo() external view returns (
        uint256 usdtBalance,
        uint256 totalMmUSDTSupply,
        uint256 totalDepositedAmount,
        uint256 totalWithdrawnAmount,
        uint256 bridgeBalanceAmount
    ) {
        return (
            usdt.balanceOf(address(this)),
            mmUSDTToken.totalSupply(),
            totalDeposited,
            totalWithdrawn,
            bridgeBalance
        );
    }

    function getUserInfo(address user) external view returns (
        uint256 mmUSDTBalance,
        uint256 userDepositAmount,
        uint256 userWithdrawAmount
    ) {
        return (
            mmUSDTToken.balanceOf(user),
            userDeposits[user],
            userWithdrawals[user]
        );
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}

    uint256[40] private __gap;
}