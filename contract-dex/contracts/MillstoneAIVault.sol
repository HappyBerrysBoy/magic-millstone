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
 * @dev 핵심 기능만 포함한 다중 프로토콜 분산 투자 vault
 */
contract MillstoneAIVault is 
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
    
    // StakedUSDT 토큰 시스템
    mapping(address => uint256) public totalStakedTokenSupply; // token -> 총 stakedToken 발행량
    mapping(address => uint256) public exchangeRateStakedToUnderlying; // token -> 교환비 (1 stakedToken = X underlying, 1e18 scale)
    mapping(address => mapping(address => uint256)) public userStakedTokenBalance; // user -> token -> stakedToken 보유량
    mapping(address => uint256) public totalUnderlyingDeposited; // token -> 실제 투자된 underlying 총량
    mapping(address => uint256) public totalDeposited; // 호환성을 위해 유지
    mapping(address => uint256) public totalWithdrawn; // 호환성을 위해 유지
    
    // Performance Fee 관리
    uint256 public performanceFeeRate; // basis points (1000 = 10%)
    mapping(address => uint256) public lastRecordedValue; // token -> last recorded total value
    mapping(address => uint256) public accumulatedFees; // token -> accumulated fees
    mapping(address => uint256) public totalFeesWithdrawn; // token -> total fees withdrawn
    address public feeRecipient; // fee를 받을 주소
    
    // 이벤트들
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
     * @dev USDT 예치하여 StakedUSDT 발행
     */
    function deposit(address token, uint256 assets) external nonReentrant returns (uint256 stakedTokens) {
        require(supportedTokens[token], "Token not supported");
        require(assets > 0, "Invalid amount");
        
        // Performance fee 수집 및 교환비 업데이트 (예치 전)
        _collectPerformanceFee(token);
        
        // 토큰 전송
        IERC20(token).safeTransferFrom(msg.sender, address(this), assets);
        
        // 현재 교환비로 StakedToken 수량 계산
        uint256 currentRate = exchangeRateStakedToUnderlying[token];
        if (currentRate == 0) {
            currentRate = 1e6; // 초기 1:1 비율
            exchangeRateStakedToUnderlying[token] = currentRate;
        }
        
        // stakedTokens = assets / exchangeRate
        stakedTokens = (assets * 1e18) / currentRate;
        
        // StakedToken 발행
        userStakedTokenBalance[msg.sender][token] += stakedTokens;
        totalStakedTokenSupply[token] += stakedTokens;
        totalUnderlyingDeposited[token] += assets;
        totalDeposited[token] += assets; // 호환성 유지
        
        // 프로토콜에 분산 투자
        _depositToProtocols(token, assets);
        
        emit StakedTokenMinted(msg.sender, token, stakedTokens, assets);
        return stakedTokens;
    }

    /**
     * @dev StakedUSDT 소각하여 USDT 출금
     */
    function redeem(address token, uint256 stakedTokenAmount) external nonReentrant returns (uint256 actualAmount) {
        require(userStakedTokenBalance[msg.sender][token] >= stakedTokenAmount, "Insufficient staked tokens");
        
        // Performance fee 수집 및 교환비 업데이트 (출금 전)
        _collectPerformanceFee(token);
        
        // 현재 교환비로 실제 출금액 계산
        uint256 currentRate = exchangeRateStakedToUnderlying[token];
        if (currentRate == 0) currentRate = 1e6;
        
        // actualAmount = stakedTokenAmount * exchangeRate
        actualAmount = (stakedTokenAmount * currentRate) / 1e6;
        
        // 프로토콜에서 출금
        uint256 withdrawn = _withdrawFromProtocols(token, actualAmount);
        
        // StakedToken 소각
        userStakedTokenBalance[msg.sender][token] -= stakedTokenAmount;
        totalStakedTokenSupply[token] -= stakedTokenAmount;
        totalWithdrawn[token] += withdrawn;
        
        // 사용자에게 전송
        IERC20(token).safeTransfer(msg.sender, withdrawn);
        
        emit StakedTokenBurned(msg.sender, token, stakedTokenAmount, withdrawn);
        return withdrawn;
    }

    /**
     * @dev 브릿지에서 자금 수신하여 StakedToken 발행 (사용자 없음)
     */
    function receiveFromBridge(address token, uint256 amount) external {
        require(authorizedBridges[msg.sender], "Unauthorized");
        require(supportedTokens[token], "Token not supported");
        
        // Performance fee 수집 및 교환비 업데이트 (기존 자금에 대해서)
        _collectPerformanceFee(token);
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // 현재 교환비로 StakedToken 수량 계산
        uint256 currentRate = exchangeRateStakedToUnderlying[token];
        if (currentRate == 0) {
            currentRate = 1e6; // 초기 1:1 비율
            exchangeRateStakedToUnderlying[token] = currentRate;
        }
        
        uint256 stakedTokens = (amount * 1e6) / currentRate;
        
        // StakedToken 발행 (Bridge는 사용자가 없으므로 토큰 소각됨)
        totalStakedTokenSupply[token] += stakedTokens;
        totalUnderlyingDeposited[token] += amount;
        totalDeposited[token] += amount; // 호환성 유지
        
        // 프로토콜에 분산 투자
        _depositToProtocols(token, amount);
        
        emit StakedTokenMinted(address(0), token, stakedTokens, amount); // Bridge는 사용자 없음
    }

    /**
     * @dev 브릿지에서 사용자 출금 처리 (StakedToken 소각)
     */
    function withdrawForUser(address token, uint256 underlyingAmount) external returns (uint256 actualAmount) {
        require(authorizedBridges[msg.sender], "Unauthorized");
        require(supportedTokens[token], "Token not supported");
        require(underlyingAmount > 0, "Invalid amount");
        
        // Performance fee 수집 및 교환비 업데이트 (출금 전)
        _collectPerformanceFee(token);
        
        // 현재 교환비로 소각할 StakedToken 수량 계산
        uint256 currentRate = exchangeRateStakedToUnderlying[token];
        if (currentRate == 0) currentRate = 1e6;
        
        uint256 stakedTokensToRedeem = (underlyingAmount * 1e6) / currentRate;
        
        // StakedToken 공급량에서 차감
        require(totalStakedTokenSupply[token] >= stakedTokensToRedeem, "Insufficient supply");
        totalStakedTokenSupply[token] -= stakedTokensToRedeem;
        totalWithdrawn[token] += underlyingAmount;
        
        // 프로토콜에서 출금
        actualAmount = _withdrawFromProtocols(token, underlyingAmount);
        
        // 브릿지에 전송
        IERC20(token).safeTransfer(msg.sender, actualAmount);
        
        emit StakedTokenBurned(address(0), token, stakedTokensToRedeem, actualAmount);
        return actualAmount;
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
     * @dev 사용자 정보 조회 (StakedToken 기반)
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
     * @dev 분배 비율 조회
     */
    function getAllocations(address token) external view returns (uint256 aave, uint256 morpho) {
        return (aaveAllocations[token], morphoAllocations[token]);
    }
    
    /**
     * @dev 현재 교환비 조회 (1 stakedToken = X underlying)
     */
    function getExchangeRate(address token) external view returns (uint256) {
        return exchangeRateStakedToUnderlying[token] == 0 ? 1e6 : exchangeRateStakedToUnderlying[token];
    }
    
    /**
     * @dev StakedToken 총 발행량 조회
     */
    function getTotalStakedTokenSupply(address token) external view returns (uint256) {
        return totalStakedTokenSupply[token];
    }
    
    /**
     * @dev 사용자 StakedToken 잔액 조회
     */
    function getStakedTokenBalance(address user, address token) external view returns (uint256) {
        return userStakedTokenBalance[user][token];
    }
    
    /**
     * @dev StakedToken 상세 정보 조회
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
     * @dev StakedToken 출금 미리보기
     */
    function previewRedeem(address token, uint256 stakedTokenAmount) external view returns (uint256 underlyingAmount) {
        uint256 currentRate = exchangeRateStakedToUnderlying[token] == 0 ? 1e18 : exchangeRateStakedToUnderlying[token];
        underlyingAmount = (stakedTokenAmount * currentRate) / 1e6;
    }
    
    /**
     * @dev USDT 예치 시 받을 StakedToken 미리보기
     */
    function previewDeposit(address token, uint256 underlyingAmount) external view returns (uint256 stakedTokenAmount) {
        uint256 currentRate = exchangeRateStakedToUnderlying[token] == 0 ? 1e18 : exchangeRateStakedToUnderlying[token];
        stakedTokenAmount = (underlyingAmount * 1e6) / currentRate;
    }
    
    /**
     * @dev 교환비 변화 시뮬레이션 (StakedToken 기반)
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
     * @dev Performance fee 수집 및 교환비 업데이트 (StakedToken 기반)
     */
    function _collectPerformanceFee(address token) internal {
        uint256 currentValue = getTotalValue(token);
        uint256 totalSupply = totalStakedTokenSupply[token];
        
        // StakedToken이 없으면 초기 교환비 설정하고 리턴
        if (totalSupply == 0) {
            if (exchangeRateStakedToUnderlying[token] == 0) {
                exchangeRateStakedToUnderlying[token] = 1e6; // 1 stakedToken = 1 underlying
            }
            return;
        }
        
        // 현재 교환비 계산: currentValue / totalSupply
        uint256 currentRate = (currentValue * 1e6) / totalSupply;
        uint256 previousRate = exchangeRateStakedToUnderlying[token];
        
        // 교환비가 증가한 경우에만 Fee 수집
        if (currentRate > previousRate) {
            // 증가분 계산: (새 교환비 - 이전 교환비) * 총 발행량
            uint256 totalGain = ((currentRate - previousRate) * totalSupply) / 1e6;
            uint256 feeAmount = (totalGain * performanceFeeRate) / 10000;
            
            // Performance Fee 누적
            if (feeAmount > 0) {
                accumulatedFees[token] += feeAmount;
                emit PerformanceFeeCollected(token, feeAmount);
            }
            
            // Fee를 제외한 새로운 교환비 계산
            uint256 netGain = totalGain - feeAmount;
            uint256 newRate = previousRate + (netGain * 1e6) / totalSupply;
            
            // 교환비 업데이트
            exchangeRateStakedToUnderlying[token] = newRate;
            emit ExchangeRateUpdated(token, newRate, previousRate);
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
     * @dev 수수료 제외 순 수익률 계산 (StakedToken 기반)
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
     * @dev 사용자에게 제공될 순 APY 계산 (fee 제외, StakedToken 기반)
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
     * @dev 토큰 통계 (StakedToken 기반)
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
        totalWithdrawnAmount = totalWithdrawn[token]; // 호환성 유지
        currentValue = getTotalValue(token);
        currentExchangeRate = exchangeRateStakedToUnderlying[token] == 0 ? 1e6 : exchangeRateStakedToUnderlying[token];
    }

    /**
     * @dev 리밸런싱
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