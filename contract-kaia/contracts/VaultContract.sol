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
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    IERC20 public usdt;
    mmUSDT public mmUSDTToken;
    WithdrawNFT public withdrawNFT;

    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    uint256 public bridgeBalance;
    uint256 public exchangeRate; // 1e6 = 1.0 (6 decimal places)

    uint256 public constant MINIMUM_DEPOSIT = 1e6;
    uint256 public constant MINIMUM_WITHDRAW = 1e6;
    uint256 public constant EXCHANGE_RATE_DECIMALS = 1e6;

    mapping(address => uint256) public userDeposits;
    mapping(address => uint256) public userWithdrawals;

    enum WithdrawStatus { PENDING, READY }
    
    struct WithdrawRequest {
        uint256 amount;
        uint256 requestTime;
        uint256 readyTime;
        WithdrawStatus status;
        address requester;
    }
    
    mapping(uint256 => WithdrawRequest) public withdrawRequests;

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

    event WithdrawMarkedReady(
        uint256 indexed nftId,
        uint256 timestamp
    );

    event WithdrawExecuted(
        address indexed user,
        uint256 amount,
        uint256 nftId,
        uint256 timestamp
    );

    event BridgeTransfer(
        address indexed destination,
        uint256 amount,
        uint256 timestamp
    );



    event EmergencyWithdraw(
        address indexed admin,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );

    event ExchangeRateUpdated(
        uint256 oldRate,
        uint256 newRate,
        address indexed updatedBy,
        uint256 timestamp
    );

    event VaultDeposit(
        address indexed depositor,
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
        
        // Initialize exchange rate to 1.0 (1e6)
        exchangeRate = EXCHANGE_RATE_DECIMALS;
    }

    function deposit(uint256 amount) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(amount >= MINIMUM_DEPOSIT, "VaultContract: Amount too small");
        require(amount > 0, "VaultContract: Amount must be greater than 0");

        usdt.safeTransferFrom(msg.sender, address(this), amount);
        
        uint256 mmUSDTToMint = (amount * EXCHANGE_RATE_DECIMALS) / exchangeRate;
        mmUSDTToken.mint(msg.sender, mmUSDTToMint);

        userDeposits[msg.sender] += amount;
        totalDeposited += amount;

        _updatePendingWithdrawalsToReady();

        emit Deposited(msg.sender, amount, mmUSDTToMint, block.timestamp);
    }

    function depositToVault(uint256 amount) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(amount > 0, "VaultContract: Amount must be greater than 0");

        usdt.safeTransferFrom(msg.sender, address(this), amount);

        _updatePendingWithdrawalsToReady();

        emit VaultDeposit(msg.sender, amount, block.timestamp);
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

        uint256 finalUsdtAmount = (amount * exchangeRate) / EXCHANGE_RATE_DECIMALS;

        uint256 nftId = withdrawNFT.mint(msg.sender, finalUsdtAmount);

        withdrawRequests[nftId] = WithdrawRequest({
            amount: finalUsdtAmount,
            requestTime: block.timestamp,
            readyTime: 0,
            status: WithdrawStatus.PENDING,
            requester: msg.sender
        });

        emit WithdrawRequested(msg.sender, finalUsdtAmount, nftId, block.timestamp);

        return nftId;
    }

    function markWithdrawReady(uint256[] calldata nftIds) 
        external 
        onlyRole(ADMIN_ROLE) 
        whenNotPaused 
    {
        for (uint256 i = 0; i < nftIds.length; i++) {
            uint256 nftId = nftIds[i];
            WithdrawRequest storage request = withdrawRequests[nftId];
            
            require(request.requester != address(0), "VaultContract: Invalid NFT ID");
            require(request.status == WithdrawStatus.PENDING, "VaultContract: Invalid status");
            
            request.status = WithdrawStatus.READY;
            request.readyTime = block.timestamp;
            
            emit WithdrawMarkedReady(nftId, block.timestamp);
        }
    }

    function executeWithdraw(uint256 nftId) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(withdrawNFT.ownerOf(nftId) == msg.sender, "VaultContract: Not NFT owner");
        
        WithdrawRequest storage request = withdrawRequests[nftId];
        require(request.status == WithdrawStatus.READY, "VaultContract: Withdraw not ready");
        require(request.requester == msg.sender, "VaultContract: Not original requester");

        uint256 payoutAmount = request.amount;
        
        require(usdt.balanceOf(address(this)) >= payoutAmount, "VaultContract: Insufficient USDT balance");

        totalWithdrawn += payoutAmount;
        userWithdrawals[msg.sender] += payoutAmount;

        withdrawNFT.burn(nftId);

        usdt.safeTransfer(msg.sender, payoutAmount);

        _updatePendingWithdrawalsToReady();

        emit WithdrawExecuted(msg.sender, payoutAmount, nftId, block.timestamp);
    }

    function getTotalRequestedWithdrawals() public view returns (uint256) {
        uint256 total = 0;
        uint256 currentTokenId = withdrawNFT.getCurrentTokenId();
        
        if (currentTokenId <= 1) {
            return 0;
        }
        
        for (uint256 i = 1; i < currentTokenId; i++) {
            try withdrawNFT.ownerOf(i) returns (address) {
                total += withdrawRequests[i].amount;
            } catch {
                continue;
            }
        }
        
        return total;
    }

    function getRequiredReserves() public view returns (uint256) {
        uint256 totalRequested = getTotalRequestedWithdrawals();
        return totalRequested;
    }

    function getMaxTransferableAmount() external view returns (uint256) {
        uint256 currentBalance = usdt.balanceOf(address(this));
        uint256 requiredReserves = getRequiredReserves();
        
        if (currentBalance <= requiredReserves) {
            return 0;
        }
        
        return currentBalance - requiredReserves;
    }

    function updatePendingWithdrawals() external whenNotPaused {
        _updatePendingWithdrawalsToReady();
    }

    function _updatePendingWithdrawalsToReady() internal {
        uint256 currentBalance = usdt.balanceOf(address(this));
        uint256 currentTokenId = withdrawNFT.getCurrentTokenId();
        
        uint256 reservedForReady = 0;
        uint256 pendingCount = 0;
        
        for (uint256 i = 1; i < currentTokenId; i++) {
            try withdrawNFT.ownerOf(i) returns (address) {
                WithdrawRequest storage request = withdrawRequests[i];
                if (request.status == WithdrawStatus.READY) {
                    reservedForReady += request.amount;
                } else if (request.status == WithdrawStatus.PENDING) {
                    pendingCount++;
                }
            } catch {
                continue;
            }
        }
        
        if (pendingCount == 0 || currentBalance <= reservedForReady) {
            return;
        }
        
        uint256 availableBalance = currentBalance - reservedForReady;
        uint256 usedBalance = 0;
        
        for (uint256 i = 1; i < currentTokenId; i++) {
            try withdrawNFT.ownerOf(i) returns (address) {
                WithdrawRequest storage request = withdrawRequests[i];
                
                if (request.status == WithdrawStatus.PENDING) {
                    uint256 requiredAmount = request.amount;
                    
                    if (usedBalance + requiredAmount <= availableBalance) {
                        request.status = WithdrawStatus.READY;
                        request.readyTime = block.timestamp;
                        usedBalance += requiredAmount;
                        
                        emit WithdrawMarkedReady(i, block.timestamp);
                    } else {
                        break;
                    }
                }
            } catch {
                continue;
            }
        }
    }

    function _checkAndMarkSingleNFTReady(uint256 nftId) internal {
        WithdrawRequest storage request = withdrawRequests[nftId];
        
        if (request.status != WithdrawStatus.PENDING) {
            return;
        }
        
        uint256 currentBalance = usdt.balanceOf(address(this));
        uint256 requiredAmount = request.amount;
        
        uint256 reservedForReady = 0;
        uint256 currentTokenId = withdrawNFT.getCurrentTokenId();
        
        for (uint256 i = 1; i < currentTokenId; i++) {
            if (i == nftId) continue;
            
            try withdrawNFT.ownerOf(i) returns (address) {
                WithdrawRequest storage otherRequest = withdrawRequests[i];
                if (otherRequest.status == WithdrawStatus.READY) {
                    reservedForReady += otherRequest.amount;
                }
            } catch {
                continue;
            }
        }
        
        if (currentBalance >= reservedForReady + requiredAmount) {
            request.status = WithdrawStatus.READY;
            request.readyTime = block.timestamp;
            
            emit WithdrawMarkedReady(nftId, block.timestamp);
        }
    }

    function sendToBridge(address destination, uint256 amount) 
        external 
        onlyRole(ADMIN_ROLE) 
        nonReentrant 
        whenNotPaused 
    {
        require(destination != address(0), "VaultContract: Invalid destination address");
        require(amount > 0, "VaultContract: Amount must be greater than 0");
        
        uint256 currentBalance = usdt.balanceOf(address(this));
        require(currentBalance >= amount, "VaultContract: Insufficient balance");
        
        uint256 requiredReserves = getRequiredReserves();
        require(currentBalance - amount >= requiredReserves, "VaultContract: Cannot transfer more than available reserves");

        usdt.safeTransfer(destination, amount);
        bridgeBalance += amount;

        emit BridgeTransfer(destination, amount, block.timestamp);
    }

    function magicTime(address destination) 
        external 
        onlyRole(ADMIN_ROLE) 
        nonReentrant 
        whenNotPaused 
        returns (uint256 amountSent, uint256 neededAmount)
    {
        require(destination != address(0), "VaultContract: Invalid destination address");
        
        uint256 vaultBalance = usdt.balanceOf(address(this));
        uint256 requiredReserves = getRequiredReserves();
        
        if (vaultBalance > requiredReserves) {
            uint256 amountToSend = vaultBalance - requiredReserves;
            
            usdt.safeTransfer(destination, amountToSend);
            bridgeBalance += amountToSend;
            
            emit BridgeTransfer(destination, amountToSend, block.timestamp);
            return (amountToSend, 0);
        }
        
        uint256 deficit = requiredReserves - vaultBalance;
        return (0, deficit);
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

    function setExchangeRate(uint256 newRate) 
        external 
        onlyRole(ADMIN_ROLE) 
        whenNotPaused 
    {
        require(newRate > 0, "VaultContract: Exchange rate must be greater than 0");
        
        uint256 oldRate = exchangeRate;
        exchangeRate = newRate;
        
        emit ExchangeRateUpdated(oldRate, newRate, msg.sender, block.timestamp);
    }

    function getExchangeRate() external view returns (uint256) {
        return exchangeRate;
    }

    function getWithdrawRequest(uint256 nftId) external view returns (WithdrawRequest memory) {
        require(withdrawRequests[nftId].requester != address(0), "VaultContract: Invalid NFT ID");
        return withdrawRequests[nftId];
    }

    function getVaultInfo() external view returns (
        uint256 usdtBalance,
        uint256 totalMmUSDTSupply,
        uint256 totalDepositedAmount,
        uint256 totalWithdrawnAmount,
        uint256 bridgeBalanceAmount,
        uint256 totalRequestedAmount,
        uint256 currentExchangeRate
    ) {
        return (
            usdt.balanceOf(address(this)),
            mmUSDTToken.totalSupply(),
            totalDeposited,
            totalWithdrawn,
            bridgeBalance,
            getTotalRequestedWithdrawals(),
            exchangeRate
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