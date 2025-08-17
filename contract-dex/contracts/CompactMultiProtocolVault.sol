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
 * @title CompactMultiProtocolVault
 * @dev 핵심 기능만 포함한 다중 프로토콜 분산 투자 vault
 */
contract CompactMultiProtocolVault is 
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    // 상태 변수들
    mapping(address => bool) public authorizedBridges;
    mapping(address => bool) public supportedTokens;
    
    // AAVE 설정
    IAavePool public aavePool;
    mapping(address => address) public aTokens;
    
    // Morpho vault 설정
    mapping(address => address) public morphoVaults;
    
    // 프로토콜 분배 비율 (token -> protocol -> percentage)
    mapping(address => uint256) public aaveAllocations; // basis points
    mapping(address => uint256) public morphoAllocations; // basis points
    
    // Yield-bearing token 상태
    mapping(address => uint256) public totalShares;
    mapping(address => uint256) public totalDeposited;
    mapping(address => uint256) public totalWithdrawn;
    mapping(address => mapping(address => uint256)) public userShares; // user -> token -> shares
    
    // Performance Fee 관리
    uint256 public performanceFeeRate; // basis points (1000 = 10%)
    mapping(address => uint256) public lastRecordedValue; // token -> last recorded total value
    mapping(address => uint256) public accumulatedFees; // token -> accumulated fees
    mapping(address => uint256) public totalFeesWithdrawn; // token -> total fees withdrawn
    address public feeRecipient; // fee를 받을 주소
    
    // 이벤트들
    event TokenSupported(address indexed token, bool supported);
    event AllocationSet(address indexed token, uint256 aavePercentage, uint256 morphoPercentage);
    event SharesMinted(address indexed user, address indexed token, uint256 shares, uint256 assets);
    event SharesRedeemed(address indexed user, address indexed token, uint256 shares, uint256 assets);
    event ProtocolDeposit(address indexed token, uint256 amount, string protocol);
    event PerformanceFeeSet(uint256 newFeeRate);
    event FeeRecipientSet(address indexed newRecipient);
    event PerformanceFeeCollected(address indexed token, uint256 feeAmount);
    event PerformanceFeeWithdrawn(address indexed token, uint256 amount, address indexed recipient);

    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) public initializer {
        __Ownable_init(_owner);
        __ReentrancyGuard_init();
        performanceFeeRate = 1000; // 10% 기본값
        feeRecipient = _owner; // 기본적으로 owner가 fee 수취인
    }

    /**
     * @dev 지원 토큰 설정
     */
    function setSupportedToken(address token, bool supported) external onlyOwner {
        require(token != address(0), "Invalid token");
        supportedTokens[token] = supported;
        
        if (supported) {
            // 기본 50:50 분배
            aaveAllocations[token] = 5000;
            morphoAllocations[token] = 5000;
        }
        
        emit TokenSupported(token, supported);
    }

    /**
     * @dev 프로토콜 분배 비율 설정
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
     * @dev AAVE 설정
     */
    function setAaveConfig(address _aavePool, address token, address aToken) external onlyOwner {
        aavePool = IAavePool(_aavePool);
        aTokens[token] = aToken;
    }

    /**
     * @dev Morpho vault 설정
     */
    function setMorphoVault(address token, address vault) external onlyOwner {
        morphoVaults[token] = vault;
    }

    /**
     * @dev Bridge 권한 설정
     */
    function setBridgeAuthorization(address bridge, bool authorized) external onlyOwner {
        authorizedBridges[bridge] = authorized;
    }
    
    /**
     * @dev Performance fee 비율 설정
     * @param _feeRate basis points (1000 = 10%)
     */
    function setPerformanceFeeRate(uint256 _feeRate) external onlyOwner {
        require(_feeRate <= 2000, "Fee rate too high"); // 최대 20%
        performanceFeeRate = _feeRate;
        emit PerformanceFeeSet(_feeRate);
    }
    
    /**
     * @dev Fee 수취인 설정
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid recipient");
        feeRecipient = _feeRecipient;
        emit FeeRecipientSet(_feeRecipient);
    }

    /**
     * @dev Yield-bearing token 예치
     */
    function deposit(address token, uint256 assets) external nonReentrant returns (uint256 shares) {
        require(supportedTokens[token], "Token not supported");
        require(assets > 0, "Invalid amount");
        
        // Performance fee 수집 (예치 전)
        _collectPerformanceFee(token);
        
        // 토큰 전송
        IERC20(token).safeTransferFrom(msg.sender, address(this), assets);
        
        // Shares 계산
        shares = _convertToShares(token, assets);
        
        // Shares 발행
        totalShares[token] += shares;
        userShares[msg.sender][token] += shares;
        totalDeposited[token] += assets;
        
        // 프로토콜에 분배 예치
        _depositToProtocols(token, assets);
        
        emit SharesMinted(msg.sender, token, shares, assets);
        return shares;
    }

    /**
     * @dev Shares로 출금
     */
    function redeem(address token, uint256 shares) external nonReentrant returns (uint256 assets) {
        require(userShares[msg.sender][token] >= shares, "Insufficient shares");
        
        // Performance fee 수집 (출금 전)
        _collectPerformanceFee(token);
        
        // Assets 계산
        assets = _convertToAssets(token, shares);
        
        // 프로토콜에서 출금
        uint256 withdrawn = _withdrawFromProtocols(token, assets);
        
        // Shares 소각
        totalShares[token] -= shares;
        userShares[msg.sender][token] -= shares;
        totalWithdrawn[token] += withdrawn;
        
        // 사용자에게 전송
        IERC20(token).safeTransfer(msg.sender, withdrawn);
        
        emit SharesRedeemed(msg.sender, token, shares, withdrawn);
        return withdrawn;
    }

    /**
     * @dev 기존 브릿지 방식 (하위 호환)
     */
    function receiveFromBridge(address token, uint256 amount) external {
        require(authorizedBridges[msg.sender], "Unauthorized");
        require(supportedTokens[token], "Token not supported");
        
        // Performance fee 수집
        _collectPerformanceFee(token);
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        totalDeposited[token] += amount;
        
        _depositToProtocols(token, amount);
    }

    /**
     * @dev 프로토콜 분배 예치
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
     * @dev AAVE 예치
     */
    function _depositToAave(address token, uint256 amount) internal {
        if (address(aavePool) != address(0)) {
            IERC20(token).forceApprove(address(aavePool), amount);
            aavePool.supply(token, amount, address(this), 0);
            emit ProtocolDeposit(token, amount, "AAVE");
        }
    }

    /**
     * @dev Morpho 예치
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
     * @dev 프로토콜에서 출금
     */
    function _withdrawFromProtocols(address token, uint256 amount) internal returns (uint256) {
        uint256 aaveAmount = (amount * aaveAllocations[token]) / 10000;
        uint256 morphoAmount = amount - aaveAmount;
        
        uint256 totalWithdrawnAmount = 0;
        
        if (aaveAmount > 0) {
            totalWithdrawnAmount += _withdrawFromAave(token, aaveAmount);
        }
        if (morphoAmount > 0) {
            totalWithdrawnAmount += _withdrawFromMorpho(token, morphoAmount);
        }
        
        return totalWithdrawnAmount;
    }

    /**
     * @dev AAVE 출금
     */
    function _withdrawFromAave(address token, uint256 amount) internal returns (uint256) {
        if (address(aavePool) != address(0)) {
            return aavePool.withdraw(token, amount, address(this));
        }
        return 0;
    }

    /**
     * @dev Morpho 출금
     */
    function _withdrawFromMorpho(address token, uint256 amount) internal returns (uint256) {
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
     * @dev Assets를 Shares로 변환 (fee 제외 가치 기준)
     */
    function _convertToShares(address token, uint256 assets) internal view returns (uint256) {
        uint256 totalSharesSupply = totalShares[token];
        uint256 netValue = _getNetValue(token);
        
        if (totalSharesSupply == 0 || netValue == 0) {
            return assets; // 1:1 초기 비율
        }
        
        return (assets * totalSharesSupply) / netValue;
    }

    /**
     * @dev Shares를 Assets로 변환 (fee 제외 가치 기준)
     */
    function _convertToAssets(address token, uint256 shares) internal view returns (uint256) {
        uint256 totalSharesSupply = totalShares[token];
        
        if (totalSharesSupply == 0) {
            return 0;
        }
        
        uint256 netValue = _getNetValue(token);
        return (shares * netValue) / totalSharesSupply;
    }
    
    /**
     * @dev Fee를 제외한 순 자산 가치 계산
     */
    function _getNetValue(address token) internal view returns (uint256) {
        uint256 totalValue = getTotalValue(token);
        uint256 feeAmount = accumulatedFees[token];
        
        return totalValue > feeAmount ? totalValue - feeAmount : 0;
    }

    /**
     * @dev 전체 vault 가치 조회
     */
    function getTotalValue(address token) public view returns (uint256) {
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        uint256 aaveBalance = 0;
        uint256 morphoBalance = 0;
        
        // AAVE 잔액
        if (aTokens[token] != address(0)) {
            aaveBalance = IERC20(aTokens[token]).balanceOf(address(this));
        }
        
        // Morpho 잔액
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
     * @dev 프로토콜별 잔액 조회
     */
    function getProtocolBalances(address token) external view returns (
        uint256 aaveBalance,
        uint256 morphoBalance,
        uint256 totalBalance
    ) {
        // AAVE 잔액
        if (aTokens[token] != address(0)) {
            aaveBalance = IERC20(aTokens[token]).balanceOf(address(this));
        }
        
        // Morpho 잔액
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
     * @dev 사용자 정보 조회 (fee 제외 가치)
     */
    function getUserInfo(address user, address token) external view returns (
        uint256 shares,
        uint256 assets,
        uint256 shareValue
    ) {
        shares = userShares[user][token];
        assets = _convertToAssets(token, shares);
        
        uint256 totalSharesSupply = totalShares[token];
        if (totalSharesSupply > 0) {
            shareValue = (_getNetValue(token) * 1e18) / totalSharesSupply;
        } else {
            shareValue = 1e18; // 1:1 비율
        }
    }

    /**
     * @dev 분배 비율 조회
     */
    function getAllocations(address token) external view returns (uint256 aave, uint256 morpho) {
        return (aaveAllocations[token], morphoAllocations[token]);
    }

    /**
     * @dev Performance fee 수집 (내부 함수)
     */
    function _collectPerformanceFee(address token) internal {
        uint256 currentValue = getTotalValue(token);
        uint256 principal = totalDeposited[token] - totalWithdrawn[token];
        
        // 원금보다 가치가 낮거나 원금이 없으면 수집하지 않음
        if (currentValue <= principal || principal == 0) {
            return;
        }
        
        // 전체 수익 계산
        uint256 totalProfit = currentValue - principal;
        uint256 totalFeeExpected = (totalProfit * performanceFeeRate) / 10000;
        uint256 alreadyCollected = accumulatedFees[token] + totalFeesWithdrawn[token];
        
        // 추가로 수집해야 할 fee 계산
        if (totalFeeExpected > alreadyCollected) {
            uint256 newFeeAmount = totalFeeExpected - alreadyCollected;
            accumulatedFees[token] += newFeeAmount;
            emit PerformanceFeeCollected(token, newFeeAmount);
        }
    }
    
    /**
     * @dev Performance fee 인출
     */
    function withdrawPerformanceFee(address token, uint256 amount) external {
        require(msg.sender == feeRecipient || msg.sender == owner(), "Unauthorized");
        require(amount <= accumulatedFees[token], "Insufficient fees");
        require(amount > 0, "Invalid amount");
        
        accumulatedFees[token] -= amount;
        totalFeesWithdrawn[token] += amount;
        
        // Fee를 위해 프로토콜에서 인출
        uint256 withdrawn = _withdrawFromProtocols(token, amount);
        require(withdrawn >= amount, "Insufficient withdrawal");
        
        IERC20(token).safeTransfer(feeRecipient, amount);
        
        emit PerformanceFeeWithdrawn(token, amount, feeRecipient);
    }
    
    /**
     * @dev 모든 fee 인출
     */
    function withdrawAllFees(address token) external {
        require(msg.sender == feeRecipient || msg.sender == owner(), "Unauthorized");
        uint256 amount = accumulatedFees[token];
        if (amount > 0) {
            require(amount > 0, "No fees to withdraw");
            
            accumulatedFees[token] -= amount;
            totalFeesWithdrawn[token] += amount;
            
            // Fee를 위해 프로토콜에서 인출
            uint256 withdrawn = _withdrawFromProtocols(token, amount);
            require(withdrawn >= amount, "Insufficient withdrawal");
            
            IERC20(token).safeTransfer(feeRecipient, amount);
            
            emit PerformanceFeeWithdrawn(token, amount, feeRecipient);
        }
    }
    
    /**
     * @dev Fee 정보 조회
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
     * @dev 수수료 제외 순 수익률 계산
     */
    function calculateYield(address token) external view returns (
        uint256 totalValue,
        uint256 principal,
        uint256 yieldAmount,
        uint256 yieldRate
    ) {
        totalValue = getTotalValue(token);
        principal = totalDeposited[token] - totalWithdrawn[token];
        
        if (totalValue >= principal && principal > 0) {
            yieldAmount = totalValue - principal;
            yieldRate = (yieldAmount * 10000) / principal; // basis points
        }
    }
    
    /**
     * @dev 사용자에게 제공될 순 APY 계산 (fee 제외)
     */
    function calculateNetYield(address token) external view returns (
        uint256 totalValue,
        uint256 principal,
        uint256 grossYield,
        uint256 feeAmount,
        uint256 netYield,
        uint256 netYieldRate
    ) {
        totalValue = getTotalValue(token);
        principal = totalDeposited[token] - totalWithdrawn[token];
        
        if (totalValue >= principal && principal > 0) {
            grossYield = totalValue - principal;
            feeAmount = (grossYield * performanceFeeRate) / 10000;
            netYield = grossYield - feeAmount;
            netYieldRate = (netYield * 10000) / principal; // basis points
        }
    }

    /**
     * @dev 토큰 통계
     */
    function getTokenStats(address token) external view returns (
        uint256 deposited,
        uint256 withdrawn,
        uint256 totalSharesSupply,
        uint256 currentValue
    ) {
        deposited = totalDeposited[token];
        withdrawn = totalWithdrawn[token];
        totalSharesSupply = totalShares[token];
        currentValue = getTotalValue(token);
    }

    /**
     * @dev 리밸런싱 (간단 버전)
     */
    function rebalance(address token) external onlyOwner {
        (uint256 aaveBalance, uint256 morphoBalance, uint256 totalBalance) = this.getProtocolBalances(token);
        
        if (totalBalance == 0) return;
        
        uint256 targetAave = (totalBalance * aaveAllocations[token]) / 10000;
        uint256 currentAavePerc = (aaveBalance * 10000) / totalBalance;
        uint256 targetAavePerc = aaveAllocations[token];
        
        // 5% 이상 차이가 날 때만 리밸런싱
        if (currentAavePerc > targetAavePerc + 500) {
            // AAVE에서 Morpho로 이동
            uint256 moveAmount = aaveBalance - targetAave;
            if (moveAmount > 0) {
                uint256 withdrawn = _withdrawFromAave(token, moveAmount);
                if (withdrawn > 0) {
                    _depositToMorpho(token, withdrawn);
                }
            }
        } else if (currentAavePerc < targetAavePerc - 500) {
            // Morpho에서 AAVE로 이동
            uint256 moveAmount = targetAave - aaveBalance;
            if (moveAmount > 0 && moveAmount <= morphoBalance) {
                uint256 withdrawn = _withdrawFromMorpho(token, moveAmount);
                if (withdrawn > 0) {
                    _depositToAave(token, withdrawn);
                }
            }
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}