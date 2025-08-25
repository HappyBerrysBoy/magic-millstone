// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IAavePool.sol";
import "./interfaces/IERC4626.sol";

/**
 * @title MillstoneAIVault
 * @dev Multi-protocol distributed investment vault with core functionalities
 */
contract MillstoneAIVault is 
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    // State variables
    mapping(address => bool) public authorizedBridges;
    mapping(address => bool) public supportedTokens;
    
    // AAVE configuration
    IAavePool public aavePool;
    mapping(address => address) public aTokens;
    
    // Morpho vault configuration
    mapping(address => address) public morphoVaults;
    
    // Protocol allocation ratios (token -> protocol -> percentage)
    mapping(address => uint256) public aaveAllocations; // basis points
    mapping(address => uint256) public morphoAllocations; // basis points
    
    // StakedUSDT token system
    mapping(address => uint256) public totalStakedTokenSupply; // token -> total stakedToken supply
    mapping(address => uint256) public exchangeRateStakedToUnderlying; // token -> exchange rate (1 stakedToken = X underlying, 1e6 scale)
    mapping(address => mapping(address => uint256)) public userStakedTokenBalance; // user -> token -> stakedToken balance
    mapping(address => uint256) public totalUnderlyingDeposited; // token -> total underlying amount actually invested
    mapping(address => uint256) public totalDeposited; // maintained for compatibility
    mapping(address => uint256) public totalWithdrawn; // maintained for compatibility
    
    // Performance Fee management
    uint256 public performanceFeeRate; // basis points (1000 = 10%)
    mapping(address => uint256) public lastRecordedValue; // token -> last recorded total value
    mapping(address => uint256) public accumulatedFees; // token -> accumulated fees
    mapping(address => uint256) public totalFeesWithdrawn; // token -> total fees withdrawn
    address public feeRecipient; // address to receive fees
    
    // Exchange Rate protection system
    mapping(address => uint256) public maxDailyRateIncrease; // token -> max daily increase (basis points, default 1000 = 10%)
    uint256 public constant MAX_RATE_INCREASE_LIMIT = 3000; // 30% max
    mapping(address => uint256) public pendingRateIncrease; // token -> pending rate increase
    mapping(address => uint256) public rateIncreaseStartTime; // token -> when rate increase started
    mapping(address => uint256) public lastRateUpdateTime; // token -> last rate update timestamp
    
    // Bridge security system
    mapping(address => uint256) public bridgeDailyLimits; // bridge -> daily limit
    mapping(address => uint256) public bridgeDailyUsed; // bridge -> daily used amount
    mapping(address => uint256) public bridgeLastResetTime; // bridge -> last reset time
    mapping(address => bool) public bridgeEmergencyPause; // bridge -> emergency pause status
    
    // TimeLock for critical operations
    mapping(bytes32 => uint256) public timelockOperations; // operation hash -> execution time
    uint256 public timelockDelay = 24 hours; // 24 hour delay for critical operations
    
    // Events
    event TokenSupported(address indexed token, bool supported);
    event AllocationSet(address indexed token, uint256 aavePercentage, uint256 morphoPercentage);
    event StakedTokenMinted(address indexed user, address indexed token, uint256 stakedTokenAmount, uint256 underlyingAmount);
    event StakedTokenBurned(address indexed user, address indexed token, uint256 stakedTokenAmount, uint256 underlyingAmount);
    event ExchangeRateUpdated(address indexed token, uint256 newRate, uint256 previousRate);
    event ProtocolDeposit(address indexed token, uint256 amount, string protocol);
    event PerformanceFeeSet(uint256 newFeeRate);
    event FeeRecipientSet(address indexed newRecipient);
    event PerformanceFeeCollected(address indexed token, uint256 feeAmount);
    event PerformanceFeeWithdrawn(address indexed token, uint256 amount, address indexed recipient);
    
    // Security related events
    event MaxRateIncreaseSet(address indexed token, uint256 newMaxIncrease);
    event RateIncreaseQueued(address indexed token, uint256 targetRate, uint256 executeTime);
    event BridgeLimitSet(address indexed bridge, uint256 dailyLimit);
    event BridgeEmergencyPause(address indexed bridge, bool paused);
    event TimelockOperationQueued(bytes32 indexed operationHash, uint256 executeTime);
    event TimelockOperationExecuted(bytes32 indexed operationHash);
    event ProtocolWithdrawalFailed(address indexed token, string protocol, uint256 requestedAmount, uint256 actualAmount);
    event WithdrawalDebug(address indexed token, uint256 requestedAmount, uint256 aaveAmount, uint256 morphoAmount, uint256 totalWithdrawn);

    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) public initializer {
        require(_owner != address(0), "Invalid owner");
        __Ownable_init(_owner);
        __ReentrancyGuard_init();
        performanceFeeRate = 1000; // 10% default value
        feeRecipient = _owner; // owner is default fee recipient
    }

    // ========== MODIFIERS ==========
    
    modifier onlyAuthorizedBridge() {
        require(authorizedBridges[msg.sender], "Unauthorized bridge");
        require(!bridgeEmergencyPause[msg.sender], "Bridge paused");
        _;
    }
    
    modifier checkBridgeLimit(uint256 amount) {
        _checkAndUpdateBridgeLimit(msg.sender, amount);
        _;
    }
    
    modifier onlyAfterTimelock(bytes32 operationHash) {
        require(timelockOperations[operationHash] != 0, "Operation not queued");
        require(block.timestamp >= timelockOperations[operationHash], "Timelock not expired");
        _;
        delete timelockOperations[operationHash];
        emit TimelockOperationExecuted(operationHash);
    }

    // ========== SECURITY FUNCTIONS ==========
    
    /**
     * @dev Set maximum exchange rate increase
     */
    function setMaxRateIncrease(address token, uint256 maxIncrease) external onlyOwner {
        require(supportedTokens[token], "Token not supported");
        require(maxIncrease <= MAX_RATE_INCREASE_LIMIT, "Exceeds max limit");
        maxDailyRateIncrease[token] = maxIncrease;
        emit MaxRateIncreaseSet(token, maxIncrease);
    }
    
    /**
     * @dev Set bridge daily limit
     */
    function setBridgeLimit(address bridge, uint256 dailyLimit) external onlyOwner {
        require(bridge != address(0), "Invalid bridge");
        bridgeDailyLimits[bridge] = dailyLimit;
        emit BridgeLimitSet(bridge, dailyLimit);
    }
    
    /**
     * @dev Bridge emergency pause
     */
    function setBridgeEmergencyPause(address bridge, bool paused) external onlyOwner {
        require(bridge != address(0), "Invalid bridge");
        bridgeEmergencyPause[bridge] = paused;
        emit BridgeEmergencyPause(bridge, paused);
    }
    
    /**
     * @dev Set TimeLock delay time
     */
    function setTimelockDelay(uint256 delay) external onlyOwner {
        require(delay >= 1 hours && delay <= 72 hours, "Invalid delay");
        timelockDelay = delay;
    }
    
    /**
     * @dev Add critical operations to TimeLock queue
     */
    function queueTimelockOperation(bytes32 operationHash) external onlyOwner {
        uint256 executeTime = block.timestamp + timelockDelay;
        timelockOperations[operationHash] = executeTime;
        emit TimelockOperationQueued(operationHash, executeTime);
    }
    
    /**
     * @dev Check and update bridge limit
     */
    function _checkAndUpdateBridgeLimit(address bridge, uint256 amount) internal {
        // Check daily reset
        if (block.timestamp >= bridgeLastResetTime[bridge] + 1 days) {
            bridgeDailyUsed[bridge] = 0;
            bridgeLastResetTime[bridge] = block.timestamp;
        }
        
        // Check limit
        uint256 limit = bridgeDailyLimits[bridge];
        if (limit > 0) {
            require(bridgeDailyUsed[bridge] + amount <= limit, "Bridge daily limit exceeded");
            bridgeDailyUsed[bridge] += amount;
        }
    }

    /**
     * @dev Set supported token
     */
    function setSupportedToken(address token, bool supported) external onlyOwner {
        require(token != address(0), "Invalid token");
        supportedTokens[token] = supported;
        
        if (supported) {
            // Default 50:50 allocation
            aaveAllocations[token] = 5000;
            morphoAllocations[token] = 5000;
            // Set default 10% daily max increase rate
            maxDailyRateIncrease[token] = 1000;
            // Set initial exchange rate
            if (exchangeRateStakedToUnderlying[token] == 0) {
                exchangeRateStakedToUnderlying[token] = 1e6;
            }
        }
        
        emit TokenSupported(token, supported);
    }

    /**
     * @dev Set protocol allocation ratios
     */
    function setProtocolAllocations(
        address token,
        uint256 aavePercentage,
        uint256 morphoPercentage
    ) external onlyOwner {
        require(supportedTokens[token], "Token not supported");
        require(aavePercentage + morphoPercentage == 10000, "Must sum to 100%");
        
        aaveAllocations[token] = aavePercentage;
        morphoAllocations[token] = morphoPercentage;
        
        emit AllocationSet(token, aavePercentage, morphoPercentage);
    }

    /**
     * @dev AAVE configuration
     */
    function setAaveConfig(address _aavePool, address token, address aToken) external onlyOwner {
        require(_aavePool != address(0), "Invalid pool");
        require(token != address(0), "Invalid token");
        require(aToken != address(0), "Invalid aToken");
        aavePool = IAavePool(_aavePool);
        aTokens[token] = aToken;
    }

    /**
     * @dev Morpho vault configuration
     */
    function setMorphoVault(address token, address vault) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(vault != address(0), "Invalid vault");
        morphoVaults[token] = vault;
    }

    /**
     * @dev Set bridge authorization
     */
    function setBridgeAuthorization(address bridge, bool authorized) external onlyOwner {
        require(bridge != address(0), "Invalid bridge");
        authorizedBridges[bridge] = authorized;
        
        // Set default limit for new bridge (1M USDT)
        if (authorized && bridgeDailyLimits[bridge] == 0) {
            bridgeDailyLimits[bridge] = 1000000 * 1e6; // 1M USDT
        }
    }
    
    /**
     * @dev Set performance fee rate
     * @param _feeRate basis points (1000 = 10%)
     */
    function setPerformanceFeeRate(uint256 _feeRate) external onlyOwner {
        require(_feeRate <= 2000, "Fee rate too high"); // maximum 20%
        performanceFeeRate = _feeRate;
        emit PerformanceFeeSet(_feeRate);
    }
    
    /**
     * @dev Set fee recipient
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid recipient");
        feeRecipient = _feeRecipient;
        emit FeeRecipientSet(_feeRecipient);
    }

    /**
     * @dev Deposit USDT to mint StakedUSDT
     */
    function deposit(address token, uint256 assets) external nonReentrant returns (uint256 stakedTokens) {
        require(supportedTokens[token], "Token not supported");
        require(assets > 0, "Invalid amount");
        
        // Collect performance fee and update exchange rate (before deposit)
        _collectPerformanceFee(token);
        
        // Transfer tokens
        IERC20(token).safeTransferFrom(msg.sender, address(this), assets);
        
        // Calculate StakedToken amount with current exchange rate (unified to 1e6 scale)
        uint256 currentRate = exchangeRateStakedToUnderlying[token];
        if (currentRate == 0) {
            currentRate = 1e6; // initial 1:1 ratio
            exchangeRateStakedToUnderlying[token] = currentRate;
        }
        
        // stakedTokens = assets * 1e6 / exchangeRate (unified to 1e6 scale)
        stakedTokens = (assets * 1e6) / currentRate;
        require(stakedTokens > 0, "Zero staked tokens");
        
        // Mint StakedToken
        userStakedTokenBalance[msg.sender][token] += stakedTokens;
        totalStakedTokenSupply[token] += stakedTokens;
        totalUnderlyingDeposited[token] += assets;
        totalDeposited[token] += assets; // maintain compatibility
        
        // Distribute investment to protocols
        _depositToProtocols(token, assets);
        
        emit StakedTokenMinted(msg.sender, token, stakedTokens, assets);
        return stakedTokens;
    }

    /**
     * @dev Burn StakedUSDT to withdraw USDT
     */
    function redeem(address token, uint256 stakedTokenAmount) external nonReentrant returns (uint256 actualAmount) {
        require(userStakedTokenBalance[msg.sender][token] >= stakedTokenAmount, "Insufficient staked tokens");
        require(stakedTokenAmount > 0, "Invalid amount");
        
        // Collect performance fee and update exchange rate (before withdrawal)
        _collectPerformanceFee(token);
        
        // Calculate actual withdrawal amount with current exchange rate (unified to 1e6 scale)
        uint256 currentRate = exchangeRateStakedToUnderlying[token];
        if (currentRate == 0) currentRate = 1e6;
        
        // actualAmount = stakedTokenAmount * exchangeRate / 1e6 (unified to 1e6 scale)
        actualAmount = (stakedTokenAmount * currentRate) / 1e6;
        require(actualAmount > 0, "Zero withdrawal amount");
        
        // Burn StakedToken (perform state changes first)
        userStakedTokenBalance[msg.sender][token] -= stakedTokenAmount;
        totalStakedTokenSupply[token] -= stakedTokenAmount;
        
        // Withdraw from protocols
        uint256 withdrawn = _withdrawFromProtocols(token, actualAmount);
        require(withdrawn >= actualAmount, "Insufficient withdrawal");
        
        totalWithdrawn[token] += withdrawn;
        
        // Transfer to user
        IERC20(token).safeTransfer(msg.sender, withdrawn);
        
        emit StakedTokenBurned(msg.sender, token, stakedTokenAmount, withdrawn);
        return withdrawn;
    }

    /**
     * @dev Receive funds from bridge and mint StakedToken (no user)
     */
    function receiveFromBridge(address token, uint256 amount) external nonReentrant onlyAuthorizedBridge checkBridgeLimit(amount) {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Invalid amount");
        
        // Collect performance fee and update exchange rate (for existing funds)
        _collectPerformanceFee(token);
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Calculate StakedToken amount with current exchange rate (unified to 1e6 scale)
        uint256 currentRate = exchangeRateStakedToUnderlying[token];
        if (currentRate == 0) {
            currentRate = 1e6; // initial 1:1 ratio
            exchangeRateStakedToUnderlying[token] = currentRate;
        }
        
        uint256 stakedTokens = (amount * 1e6) / currentRate;
        require(stakedTokens > 0, "Zero staked tokens");
        
        // Mint StakedToken (tokens are burned as Bridge has no user)
        totalStakedTokenSupply[token] += stakedTokens;
        totalUnderlyingDeposited[token] += amount;
        totalDeposited[token] += amount; // maintain compatibility
        
        // Distribute investment to protocols
        _depositToProtocols(token, amount);
        
        emit StakedTokenMinted(address(0), token, stakedTokens, amount); // Bridge has no user
    }

    /**
     * @dev Handle user withdrawal from bridge (StakedToken burning) - Enhanced security
     */
    function withdrawForUser(address token, uint256 underlyingAmount) external nonReentrant onlyAuthorizedBridge checkBridgeLimit(underlyingAmount) returns (uint256 actualAmount) {
        require(supportedTokens[token], "Token not supported");
        require(underlyingAmount > 0, "Invalid amount");
        
        // Collect performance fee and update exchange rate (before withdrawal)
        _collectPerformanceFee(token);
        
        // Calculate StakedToken amount to burn with current exchange rate (unified to 1e6 scale)
        uint256 currentRate = exchangeRateStakedToUnderlying[token];
        if (currentRate == 0) currentRate = 1e6;
        
        uint256 stakedTokensToRedeem = (underlyingAmount * 1e6) / currentRate;
        require(stakedTokensToRedeem > 0, "Zero staked tokens to redeem");
        require(totalStakedTokenSupply[token] >= stakedTokensToRedeem, "Insufficient staked token supply");
        
        // Additional security validation: prevent excessive withdrawal
        uint256 totalValue = getTotalValue(token);
        require(underlyingAmount <= totalValue * 95 / 100, "Withdrawal too large"); // 95% limit
        
        // State changes (StakedToken burning)
        totalStakedTokenSupply[token] -= stakedTokensToRedeem;
        
        // Attempt withdrawal from protocols (enhanced security)
        actualAmount = _withdrawFromProtocolsSafely(token, underlyingAmount);
        require(actualAmount > 0, "Zero withdrawal amount");
        
        totalWithdrawn[token] += actualAmount;
        
        // Transfer to bridge (actual withdrawn amount)
        IERC20(token).safeTransfer(msg.sender, actualAmount);
        
        emit StakedTokenBurned(address(0), token, stakedTokensToRedeem, actualAmount);
        return actualAmount;
    }

    /**
     * @dev Protocol distribution deposit
     */
    function _depositToProtocols(address token, uint256 amount) internal {
        uint256 aaveAmount = (amount * aaveAllocations[token]) / 10000;
        uint256 morphoAmount = amount - aaveAmount;
        
        if (aaveAmount > 0) {
            _depositToAave(token, aaveAmount);
        }
        if (morphoAmount > 0) {
            _depositToMorpho(token, morphoAmount);
        }
    }

    /**
     * @dev AAVE deposit
     */
    function _depositToAave(address token, uint256 amount) internal {
        if (address(aavePool) != address(0)) {
            IERC20(token).forceApprove(address(aavePool), amount);
            aavePool.supply(token, amount, address(this), 0);
            emit ProtocolDeposit(token, amount, "AAVE");
        }
    }

    /**
     * @dev Morpho deposit
     */
    function _depositToMorpho(address token, uint256 amount) internal {
        address vault = morphoVaults[token];
        if (vault != address(0)) {
            IERC20(token).forceApprove(vault, amount);
            IERC4626(vault).deposit(amount, address(this));
            emit ProtocolDeposit(token, amount, "Morpho");
        }
    }

    /**
     * @dev Withdraw from protocols (Legacy support)
     */
    function _withdrawFromProtocols(address token, uint256 amount) internal returns (uint256) {
        return _withdrawFromProtocolsSafely(token, amount);
    }

    /**
     * @dev AAVE withdrawal (External for try-catch)
     */
    function _withdrawFromAave(address token, uint256 amount) external returns (uint256) {
        require(msg.sender == address(this), "Internal only");
        if (address(aavePool) != address(0)) {
            return aavePool.withdraw(token, amount, address(this));
        }
        return 0;
    }

    /**
     * @dev Morpho withdrawal (External for try-catch)
     */
    function _withdrawFromMorpho(address token, uint256 amount) external returns (uint256) {
        require(msg.sender == address(this), "Internal only");
        address vault = morphoVaults[token];
        if (vault != address(0)) {
            try IERC4626(vault).withdraw(amount, address(this), address(this)) returns (uint256) {
                return amount;
            } catch {
                return 0;
            }
        }
        return 0;
    }


    /**
     * @dev Get total vault value
     */
    function getTotalValue(address token) public view returns (uint256) {
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        uint256 aaveBalance = 0;
        uint256 morphoBalance = 0;
        
        // AAVE balance
        if (aTokens[token] != address(0)) {
            aaveBalance = IERC20(aTokens[token]).balanceOf(address(this));
        }
        
        // Morpho balance
        address vault = morphoVaults[token];
        if (vault != address(0)) {
            try IERC4626(vault).balanceOf(address(this)) returns (uint256 shares) {
                if (shares > 0) {
                    try IERC4626(vault).convertToAssets(shares) returns (uint256 assets) {
                        morphoBalance = assets;
                    } catch {}
                }
            } catch {}
        }
        
        return contractBalance + aaveBalance + morphoBalance;
    }

    /**
     * @dev Get protocol-wise balances
     */
    function getProtocolBalances(address token) external view returns (
        uint256 aaveBalance,
        uint256 morphoBalance,
        uint256 totalBalance
    ) {
        // AAVE balance
        if (aTokens[token] != address(0)) {
            aaveBalance = IERC20(aTokens[token]).balanceOf(address(this));
        }
        
        // Morpho balance
        address vault = morphoVaults[token];
        if (vault != address(0)) {
            try IERC4626(vault).balanceOf(address(this)) returns (uint256 shares) {
                if (shares > 0) {
                    try IERC4626(vault).convertToAssets(shares) returns (uint256 assets) {
                        morphoBalance = assets;
                    } catch {}
                }
            } catch {}
        }
        
        totalBalance = aaveBalance + morphoBalance;
    }

    /**
     * @dev Get user information (StakedToken based)
     */
    function getUserInfo(address user, address token) external view returns (
        uint256 stakedTokenBalance,
        uint256 underlyingValue,
        uint256 currentExchangeRate
    ) {
        stakedTokenBalance = userStakedTokenBalance[user][token];
        currentExchangeRate = exchangeRateStakedToUnderlying[token] == 0 ? 1e6 : exchangeRateStakedToUnderlying[token];
        underlyingValue = (stakedTokenBalance * currentExchangeRate) / 1e6;
    }

    /**
     * @dev Get allocation ratios
     */
    function getAllocations(address token) external view returns (uint256 aave, uint256 morpho) {
        return (aaveAllocations[token], morphoAllocations[token]);
    }
    
    /**
     * @dev Get current exchange rate (1 stakedToken = X underlying)
     */
    function getExchangeRate(address token) external view returns (uint256) {
        return exchangeRateStakedToUnderlying[token] == 0 ? 1e6 : exchangeRateStakedToUnderlying[token];
    }
    
    /**
     * @dev Get total StakedToken supply
     */
    function getTotalStakedTokenSupply(address token) external view returns (uint256) {
        return totalStakedTokenSupply[token];
    }
    
    /**
     * @dev Get user StakedToken balance
     */
    function getStakedTokenBalance(address user, address token) external view returns (uint256) {
        return userStakedTokenBalance[user][token];
    }
    
    /**
     * @dev Get StakedToken detailed information
     */
    function getStakedTokenInfo(address token) external view returns (
        uint256 currentExchangeRate,
        uint256 totalSupply,
        uint256 totalCurrentValue,
        uint256 underlyingDepositedAmount,
        uint256 accumulatedFeeAmount
    ) {
        currentExchangeRate = exchangeRateStakedToUnderlying[token] == 0 ? 1e6 : exchangeRateStakedToUnderlying[token];
        totalSupply = totalStakedTokenSupply[token];
        totalCurrentValue = getTotalValue(token);
        underlyingDepositedAmount = totalUnderlyingDeposited[token];
        accumulatedFeeAmount = accumulatedFees[token];
    }
    
    /**
     * @dev Preview StakedToken withdrawal
     */
    function previewRedeem(address token, uint256 stakedTokenAmount) external view returns (uint256 underlyingAmount) {
        uint256 currentRate = exchangeRateStakedToUnderlying[token] == 0 ? 1e18 : exchangeRateStakedToUnderlying[token];
        underlyingAmount = (stakedTokenAmount * currentRate) / 1e6;
    }
    
    /**
     * @dev Preview StakedToken to receive when depositing USDT
     */
    function previewDeposit(address token, uint256 underlyingAmount) external view returns (uint256 stakedTokenAmount) {
        uint256 currentRate = exchangeRateStakedToUnderlying[token] == 0 ? 1e18 : exchangeRateStakedToUnderlying[token];
        stakedTokenAmount = (underlyingAmount * 1e6) / currentRate;
    }
    
    /**
     * @dev Simulate exchange rate change (StakedToken based)
     */
    function simulateExchangeRateUpdate(address token) external view returns (
        uint256 currentRate,
        uint256 newRate,
        uint256 totalGain,
        uint256 feeAmount,
        uint256 netGain
    ) {
        currentRate = exchangeRateStakedToUnderlying[token] == 0 ? 1e18 : exchangeRateStakedToUnderlying[token];
        uint256 totalSupply = totalStakedTokenSupply[token];
        
        if (totalSupply > 0) {
            uint256 currentValue = getTotalValue(token);
            uint256 potentialRate = (currentValue * 1e6) / totalSupply;
            
            if (potentialRate > currentRate) {
                totalGain = ((potentialRate - currentRate) * totalSupply) / 1e6;
                feeAmount = (totalGain * performanceFeeRate) / 10000;
                netGain = totalGain - feeAmount;
                newRate = currentRate + (netGain * 1e6) / totalSupply;
            } else {
                newRate = currentRate;
            }
        } else {
            newRate = currentRate;
        }
    }

    /**
     * @dev Collect performance fee and safe exchange rate update (Enhanced security)
     */
    function _collectPerformanceFee(address token) internal {
        uint256 currentValue = getTotalValue(token);
        uint256 totalSupply = totalStakedTokenSupply[token];
        
        // If no StakedToken, set initial exchange rate and return
        if (totalSupply == 0) {
            if (exchangeRateStakedToUnderlying[token] == 0) {
                exchangeRateStakedToUnderlying[token] = 1e6; // 1 stakedToken = 1 underlying
            }
            lastRateUpdateTime[token] = block.timestamp;
            return;
        }
        
        // Calculate potential new exchange rate
        uint256 potentialNewRate = (currentValue * 1e6) / totalSupply;
        uint256 previousRate = exchangeRateStakedToUnderlying[token];
        if (previousRate == 0) {
            previousRate = 1e6;
            exchangeRateStakedToUnderlying[token] = previousRate;
            lastRateUpdateTime[token] = block.timestamp;
            return;
        }
        
        // Process only when exchange rate increases
        if (potentialNewRate <= previousRate) {
            return;
        }
        
        // Gradual exchange rate update logic
        uint256 targetRate = _calculateSafeExchangeRate(token, potentialNewRate, previousRate);
        
        if (targetRate > previousRate) {
            // Calculate increase: (new exchange rate - previous exchange rate) * total supply
            uint256 totalGain = ((targetRate - previousRate) * totalSupply) / 1e6;
            uint256 feeAmount = (totalGain * performanceFeeRate) / 10000;
            
            // Accumulate Performance Fee
            if (feeAmount > 0) {
                accumulatedFees[token] += feeAmount;
                emit PerformanceFeeCollected(token, feeAmount);
            }
            
            // Calculate new exchange rate excluding fee
            uint256 netGain = totalGain - feeAmount;
            uint256 newRate = previousRate + (netGain * 1e6) / totalSupply;
            
            // Update exchange rate
            exchangeRateStakedToUnderlying[token] = newRate;
            lastRateUpdateTime[token] = block.timestamp;
            emit ExchangeRateUpdated(token, newRate, previousRate);
        }
    }
    
    /**
     * @dev Safe exchange rate calculation (10% daily limit, 30% max, 1-day gradual application)
     */
    function _calculateSafeExchangeRate(address token, uint256 potentialRate, uint256 currentRate) internal returns (uint256) {
        // Get default maximum increase rate (default: 10%)
        uint256 maxDailyIncrease = maxDailyRateIncrease[token];
        if (maxDailyIncrease == 0) {
            maxDailyIncrease = 1000; // 10%
        }
        
        // Calculate time-based limits
        uint256 lastUpdate = lastRateUpdateTime[token];
        uint256 timeDiff = block.timestamp - lastUpdate;
        
        // If less than a day has passed, apply stricter limits
        if (timeDiff < 1 days) {
            // Calculate allowed increase proportional to time
            uint256 timeBasedMaxIncrease = (maxDailyIncrease * timeDiff) / 1 days;
            maxDailyIncrease = timeBasedMaxIncrease;
        }
        
        // Calculate maximum allowed exchange rate
        uint256 maxAllowedRate = currentRate + (currentRate * maxDailyIncrease) / 10000;
        
        // Apply gradual application if pending rate exists
        if (pendingRateIncrease[token] > 0) {
            uint256 pendingStartTime = rateIncreaseStartTime[token];
            uint256 pendingTargetRate = pendingRateIncrease[token];
            
            if (block.timestamp >= pendingStartTime + 1 days) {
                // If a day has passed, fully apply pending rate
                pendingRateIncrease[token] = 0; // Reset pending
                rateIncreaseStartTime[token] = 0;
                return pendingTargetRate > potentialRate ? potentialRate : pendingTargetRate;
            } else {
                // Gradual increase proportional to time
                uint256 progress = (block.timestamp - pendingStartTime) * 1e6 / 1 days;
                uint256 totalIncrease = pendingTargetRate - currentRate;
                uint256 gradualRate = currentRate + (totalIncrease * progress) / 1e6;
                return gradualRate > potentialRate ? potentialRate : gradualRate;
            }
        }
        
        // If new increase exceeds allowed range
        if (potentialRate > maxAllowedRate) {
            // Check 30% maximum limit
            uint256 maxPossibleRate = currentRate + (currentRate * MAX_RATE_INCREASE_LIMIT) / 10000;
            if (potentialRate > maxPossibleRate) {
                potentialRate = maxPossibleRate;
            }
            
            // Set new pending rate
            pendingRateIncrease[token] = potentialRate;
            rateIncreaseStartTime[token] = block.timestamp;
            
            emit RateIncreaseQueued(token, potentialRate, block.timestamp + 1 days);
            return maxAllowedRate; // Currently only up to allowed range
        }
        
        return potentialRate;
    }
    
    /**
     * @dev Withdraw performance fee (Enhanced security - protect user funds)
     */
    function withdrawPerformanceFee(address token, uint256 amount) external nonReentrant {
        require(msg.sender == feeRecipient || msg.sender == owner(), "Unauthorized");
        require(amount <= accumulatedFees[token], "Insufficient fees");
        require(amount > 0, "Invalid amount");
        
        // Check contract balance first to avoid affecting user withdrawals
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        uint256 withdrawnAmount = 0;
        
        if (contractBalance >= amount) {
            // If contract balance is sufficient
            withdrawnAmount = amount;
        } else {
            // Partially from contract balance, rest carefully withdrawn from protocols
            withdrawnAmount = contractBalance;
            uint256 remainingAmount = amount - contractBalance;
            
            // Safely withdraw from protocols (minimize impact on user withdrawals)
            uint256 protocolWithdrawn = _withdrawFromProtocolsForFee(token, remainingAmount);
            withdrawnAmount += protocolWithdrawn;
        }
        
        // Deduct from fee only the amount actually withdrawn
        require(withdrawnAmount > 0, "No withdrawal possible");
        uint256 feeToDeduct = withdrawnAmount > amount ? amount : withdrawnAmount;
        
        accumulatedFees[token] -= feeToDeduct;
        totalFeesWithdrawn[token] += feeToDeduct;
        
        IERC20(token).safeTransfer(feeRecipient, withdrawnAmount);
        
        emit PerformanceFeeWithdrawn(token, withdrawnAmount, feeRecipient);
    }
    
    /**
     * @dev Withdraw all fees (Enhanced security)
     */
    function withdrawAllFees(address token) external nonReentrant {
        require(msg.sender == feeRecipient || msg.sender == owner(), "Unauthorized");
        uint256 amount = accumulatedFees[token];
        require(amount > 0, "No fees to withdraw");
        
        // Check contract balance first to avoid affecting user withdrawals
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        uint256 withdrawnAmount = 0;
        
        if (contractBalance >= amount) {
            // If contract balance is sufficient
            withdrawnAmount = amount;
        } else {
            // Partially from contract balance, rest carefully withdrawn from protocols
            withdrawnAmount = contractBalance;
            uint256 remainingAmount = amount - contractBalance;
            
            // Safely withdraw from protocols (minimize impact on user withdrawals)
            uint256 protocolWithdrawn = _withdrawFromProtocolsForFee(token, remainingAmount);
            withdrawnAmount += protocolWithdrawn;
        }
        
        // Deduct from fee only the amount actually withdrawn
        require(withdrawnAmount > 0, "No withdrawal possible");
        uint256 feeToDeduct = withdrawnAmount > amount ? amount : withdrawnAmount;
        
        accumulatedFees[token] -= feeToDeduct;
        totalFeesWithdrawn[token] += feeToDeduct;
        
        IERC20(token).safeTransfer(feeRecipient, withdrawnAmount);
        
        emit PerformanceFeeWithdrawn(token, withdrawnAmount, feeRecipient);
    }
    
    /**
     * @dev Safe protocol withdrawal for fee withdrawal (minimize impact on user funds)
     */
    function _withdrawFromProtocolsForFee(address token, uint256 amount) internal returns (uint256) {
        // More conservative approach: use only user withdrawal reserve
        uint256 totalValue = getTotalValue(token);
        uint256 totalSupply = totalStakedTokenSupply[token];
        uint256 userTotalValue = 0;
        
        if (totalSupply > 0) {
            uint256 currentRate = exchangeRateStakedToUnderlying[token];
            userTotalValue = (totalSupply * currentRate) / 1e6;
        }
        
        // Protect user funds: use only reserve so users can withdraw anytime
        uint256 reserveBuffer = userTotalValue * 105 / 100; // 5% buffer (less strict)
        
        if (totalValue <= reserveBuffer) {
            // Try to withdraw minimum fee (100 USDT or less)
            if (amount <= 100 * 1e6) { // Allow if 100 USDT or less
                return _withdrawFromProtocols(token, amount);
            }
            return 0; // Cannot withdraw fee
        }
        
        uint256 availableForFee = totalValue - reserveBuffer;
        uint256 withdrawAmount = amount > availableForFee ? availableForFee : amount;
        
        if (withdrawAmount > 0) {
            return _withdrawFromProtocols(token, withdrawAmount);
        }
        
        return 0;
    }
    
    /**
     * @dev Get fee information
     */
    function getFeeInfo(address token) external view returns (
        uint256 feeRate,
        uint256 accumulatedFeeAmount,
        uint256 totalFeesWithdrawnAmount,
        address recipient
    ) {
        return (
            performanceFeeRate,
            accumulatedFees[token],
            totalFeesWithdrawn[token],
            feeRecipient
        );
    }
    
    /**
     * @dev Calculate net yield excluding fees (StakedToken based)
     */
    function calculateYield(address token) external view returns (
        uint256 totalValue,
        uint256 totalDepositedAmount,
        uint256 yieldAmount,
        uint256 yieldRate
    ) {
        totalValue = getTotalValue(token);
        totalDepositedAmount = totalUnderlyingDeposited[token];
        
        if (totalValue >= totalDepositedAmount && totalDepositedAmount > 0) {
            yieldAmount = totalValue - totalDepositedAmount;
            yieldRate = (yieldAmount * 10000) / totalDepositedAmount; // basis points
        }
    }
    
    /**
     * @dev Calculate net APY to be provided to users (excluding fees, StakedToken based)
     */
    function calculateNetYield(address token) external view returns (
        uint256 totalValue,
        uint256 totalDepositedAmount,
        uint256 grossYield,
        uint256 feeAmount,
        uint256 netYield,
        uint256 netYieldRate
    ) {
        totalValue = getTotalValue(token);
        totalDepositedAmount = totalUnderlyingDeposited[token];
        
        if (totalValue >= totalDepositedAmount && totalDepositedAmount > 0) {
            grossYield = totalValue - totalDepositedAmount;
            feeAmount = (grossYield * performanceFeeRate) / 10000;
            netYield = grossYield - feeAmount;
            netYieldRate = (netYield * 10000) / totalDepositedAmount; // basis points
        }
    }

    /**
     * @dev Token statistics (StakedToken based)
     */
    function getTokenStats(address token) external view returns (
        uint256 totalStakedSupply,
        uint256 underlyingDepositedAmount,
        uint256 totalWithdrawnAmount,
        uint256 currentValue,
        uint256 currentExchangeRate
    ) {
        totalStakedSupply = totalStakedTokenSupply[token];
        underlyingDepositedAmount = totalUnderlyingDeposited[token];
        totalWithdrawnAmount = totalWithdrawn[token]; // maintain compatibility
        currentValue = getTotalValue(token);
        currentExchangeRate = exchangeRateStakedToUnderlying[token] == 0 ? 1e6 : exchangeRateStakedToUnderlying[token];
    }

    /**
     * @dev Rebalancing
     */
    function rebalance(address token) external onlyOwner {
        (uint256 aaveBalance, uint256 morphoBalance, uint256 totalBalance) = this.getProtocolBalances(token);
        
        if (totalBalance == 0) return;
        
        uint256 targetAave = (totalBalance * aaveAllocations[token]) / 10000;
        uint256 currentAavePerc = (aaveBalance * 10000) / totalBalance;
        uint256 targetAavePerc = aaveAllocations[token];
        
        // Rebalance only when difference is 5% or more
        if (currentAavePerc > targetAavePerc + 500) {
            // Move from AAVE to Morpho
            uint256 moveAmount = aaveBalance - targetAave;
            if (moveAmount > 0) {
                try this._withdrawFromAave(token, moveAmount) returns (uint256 withdrawn) {
                    if (withdrawn > 0) {
                        _depositToMorpho(token, withdrawn);
                    }
                } catch {}
            }
        } else if (currentAavePerc < targetAavePerc - 500) {
            // Move from Morpho to AAVE
            uint256 moveAmount = targetAave - aaveBalance;
            if (moveAmount > 0 && moveAmount <= morphoBalance) {
                try this._withdrawFromMorpho(token, moveAmount) returns (uint256 withdrawn) {
                    if (withdrawn > 0) {
                        _depositToAave(token, withdrawn);
                    }
                } catch {}
            }
        }
    }

    /**
     * @dev Safe protocol withdrawal (Enhanced error handling)
     */
    function _withdrawFromProtocolsSafely(address token, uint256 amount) internal returns (uint256) {
        uint256 aaveAmount = (amount * aaveAllocations[token]) / 10000;
        uint256 morphoAmount = amount - aaveAmount;
        
        uint256 totalWithdrawnAmount = 0;
        
        // Attempt withdrawal from AAVE
        if (aaveAmount > 0) {
            try this._withdrawFromAave(token, aaveAmount) returns (uint256 withdrawn) {
                totalWithdrawnAmount += withdrawn;
            } catch {
                emit ProtocolWithdrawalFailed(token, "AAVE", aaveAmount, 0);
            }
        }
        
        // Attempt withdrawal from Morpho
        if (morphoAmount > 0) {
            try this._withdrawFromMorpho(token, morphoAmount) returns (uint256 withdrawn) {
                totalWithdrawnAmount += withdrawn;
            } catch {
                emit ProtocolWithdrawalFailed(token, "Morpho", morphoAmount, 0);
            }
        }
        
        // If insufficient, attempt additional withdrawal from other protocols
        if (totalWithdrawnAmount < amount) {
            uint256 remainingAmount = amount - totalWithdrawnAmount;
            uint256 additionalWithdrawn = _tryAlternativeWithdrawal(token, remainingAmount);
            totalWithdrawnAmount += additionalWithdrawn;
        }
        
        emit WithdrawalDebug(token, amount, aaveAmount, morphoAmount, totalWithdrawnAmount);
        return totalWithdrawnAmount;
    }
    
    /**
     * @dev Attempt alternative withdrawal (when one protocol fails)
     */
    function _tryAlternativeWithdrawal(address token, uint256 amount) internal returns (uint256) {
        uint256 alternativeWithdrawn = 0;
        
        // Try AAVE first
        try this._withdrawFromAave(token, amount) returns (uint256 withdrawn) {
            if (withdrawn > 0) {
                alternativeWithdrawn += withdrawn;
                if (alternativeWithdrawn >= amount) return alternativeWithdrawn;
            }
        } catch {}
        
        // If insufficient, try remaining from Morpho
        if (alternativeWithdrawn < amount) {
            uint256 remaining = amount - alternativeWithdrawn;
            try this._withdrawFromMorpho(token, remaining) returns (uint256 withdrawn) {
                alternativeWithdrawn += withdrawn;
            } catch {}
        }
        
        return alternativeWithdrawn;
    }
    
    // ========== EXCHANGE RATE MANAGEMENT FUNCTIONS ==========
    
    /**
     * @dev Add to gradual exchange rate increase queue
     */
    function queueExchangeRateIncrease(address token, uint256 targetRate) external onlyOwner {
        require(supportedTokens[token], "Token not supported");
        uint256 currentRate = exchangeRateStakedToUnderlying[token];
        if (currentRate == 0) currentRate = 1e6;
        
        require(targetRate > currentRate, "Target rate must be higher");
        
        // Check 30% maximum limit
        uint256 maxAllowedRate = currentRate + (currentRate * MAX_RATE_INCREASE_LIMIT) / 10000;
        require(targetRate <= maxAllowedRate, "Exceeds max rate increase limit");
        
        pendingRateIncrease[token] = targetRate;
        rateIncreaseStartTime[token] = block.timestamp;
        
        emit RateIncreaseQueued(token, targetRate, block.timestamp + 1 days);
    }
    
    /**
     * @dev Get Pending Rate information
     */
    function getPendingRateInfo(address token) external view returns (
        uint256 pendingRate,
        uint256 startTime,
        uint256 progress,
        bool isActive
    ) {
        pendingRate = pendingRateIncrease[token];
        startTime = rateIncreaseStartTime[token];
        isActive = pendingRate > 0;
        
        if (isActive && block.timestamp > startTime) {
            uint256 elapsed = block.timestamp - startTime;
            progress = elapsed >= 1 days ? 1e6 : (elapsed * 1e6) / 1 days; // 0-100% (1e6 scale)
        }
    }
    
    /**
     * @dev Apply Pending Rate immediately (for emergency)
     */
    function applyPendingRateImmediately(address token) external onlyOwner {
        require(pendingRateIncrease[token] > 0, "No pending rate increase");
        
        uint256 targetRate = pendingRateIncrease[token];
        exchangeRateStakedToUnderlying[token] = targetRate;
        lastRateUpdateTime[token] = block.timestamp;
        
        // Reset pending rate
        pendingRateIncrease[token] = 0;
        rateIncreaseStartTime[token] = 0;
        
        emit ExchangeRateUpdated(token, targetRate, exchangeRateStakedToUnderlying[token]);
    }
    
    /**
     * @dev Cancel Pending Rate
     */
    function cancelPendingRate(address token) external onlyOwner {
        require(pendingRateIncrease[token] > 0, "No pending rate increase");
        
        pendingRateIncrease[token] = 0;
        rateIncreaseStartTime[token] = 0;
    }
    
    /**
     * @dev Get security status
     */
    function getSecurityStatus(address token) external view returns (
        uint256 maxDailyRate,
        uint256 lastUpdateTime,
        uint256 pendingRate,
        bool hasPendingIncrease
    ) {
        maxDailyRate = maxDailyRateIncrease[token];
        lastUpdateTime = lastRateUpdateTime[token];
        pendingRate = pendingRateIncrease[token];
        hasPendingIncrease = pendingRate > 0;
    }
    
    /**
     * @dev Get bridge security status
     */
    function getBridgeSecurityStatus(address bridge) external view returns (
        uint256 dailyLimit,
        uint256 dailyUsed,
        uint256 lastResetTime,
        bool isPaused
    ) {
        dailyLimit = bridgeDailyLimits[bridge];
        dailyUsed = bridgeDailyUsed[bridge];
        lastResetTime = bridgeLastResetTime[bridge];
        isPaused = bridgeEmergencyPause[bridge];
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}