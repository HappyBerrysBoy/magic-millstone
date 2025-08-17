// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ILendingProtocol.sol";
import "./interfaces/IAavePool.sol";
import "./interfaces/IMorpho.sol";
import "./interfaces/IMorphoBlue.sol";
import "./interfaces/IERC4626.sol";

/**
 * @title MillstoneAIVault
 * @dev 브릿지로부터 토큰을 받아 렌딩 프로토콜에 예치하고 관리하는 업그레이드 가능한 컨트랙트
 */
contract MillstoneAIVault is 
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    // 상태 변수들
    mapping(address => bool) public authorizedBridges;
    mapping(address => ILendingProtocol[]) public lendingProtocols; // 토큰당 여러 프로토콜 지원
    mapping(address => mapping(address => bool)) public protocolEnabled; // token -> protocol -> enabled
    mapping(address => bool) public supportedTokens;
    
    // AAVE Pool 설정
    IAavePool public aavePool;
    mapping(address => address) public aTokens; // token -> aToken 매핑
    bool public useRealAave; // true면 실제 AAVE 사용, false면 기존 Mock 사용
    
    // Morpho Pool 설정
    IMorpho public morphoPool;
    IMorphoLens public morphoLens;
    IMorphoBlue public morphoBlue; // Morpho Blue 프로토콜
    bool public useRealMorpho; // true면 실제 Morpho 사용
    bool public useMorphoBlue; // true면 Morpho Blue 사용
    uint256 public morphoMaxIterations; // Morpho 최대 반복 횟수 (기본값: 4)
    
    // Morpho Blue 마켓 파라미터 저장
    mapping(address => IMorphoBlue.MarketParams) public morphoBlueMarkets;
    
    // Steakhouse-style vault 설정
    mapping(address => address) public morphoVaults; // token -> vault 매핑
    bool public useDirectMorphoVault; // true면 직접 Morpho vault 사용
    
    // 토큰별 예치/출금 추적
    mapping(address => uint256) public totalDeposited;
    mapping(address => uint256) public totalWithdrawn;
    
    // 출금 요청 추적
    struct WithdrawRequest {
        address token;
        uint256 amount;
        uint256 requestTime;
        uint256 protocolRequestId;
        bool claimed;
        address requester;
    }
    
    mapping(uint256 => WithdrawRequest) public withdrawRequests;
    mapping(address => uint256[]) public userWithdrawRequests;
    uint256 public nextRequestId;
    
    // 수익률 계산을 위한 스냅샷
    mapping(address => uint256) public principalSnapshots;
    
    // 프로토콜 분배 비율 관리 (token -> protocol -> allocation percentage)
    mapping(address => mapping(uint8 => uint256)) public protocolAllocations; // 0: AAVE, 1: Morpho
    mapping(address => uint256) public totalShares; // Yield-bearing token shares
    mapping(address => uint256) public totalAssets; // Total underlying assets
    
    // 프로토콜 타입 열거형
    enum ProtocolType { AAVE, MORPHO }
    
    // APY 추적을 위한 구조체
    struct APYSnapshot {
        uint256 timestamp;
        uint256 totalValue;
        uint256 principal;
        uint256 apy; // basis points (10000 = 100%)
    }
    
    mapping(address => APYSnapshot[]) public apyHistory;
    mapping(address => uint256) public lastAPYUpdate;
    
    // 이벤트들
    event BridgeAuthorized(address indexed bridge, bool authorized);
    event LendingProtocolAdded(address indexed token, address indexed protocol);
    event LendingProtocolRemoved(address indexed token, address indexed protocol);
    event LendingProtocolEnabled(address indexed token, address indexed protocol, bool enabled);
    event TokenSupported(address indexed token, bool supported);
    event TokenReceived(address indexed token, uint256 amount, address indexed from);
    event TokenDeposited(address indexed token, uint256 amount, address indexed protocol);
    event WithdrawRequested(uint256 indexed requestId, address indexed token, uint256 amount, address indexed requester);
    event WithdrawClaimed(uint256 indexed requestId, address indexed token, uint256 amount, address indexed requester);
    event YieldCalculated(address indexed token, uint256 totalValue, uint256 principal, uint256 yield, uint256 yieldRate);
    event ProtocolAllocationSet(address indexed token, uint8 protocol, uint256 allocation);
    event SharesMinted(address indexed user, address indexed token, uint256 shares, uint256 assets);
    event SharesBurned(address indexed user, address indexed token, uint256 shares, uint256 assets);
    event APYUpdated(address indexed token, uint256 apy, uint256 timestamp);
    
    // AAVE 관련 이벤트들
    event AavePoolSet(address indexed aavePool);
    event AaveTokenMapped(address indexed token, address indexed aToken);
    event AaveModeToggled(bool useRealAave);
    
    // Morpho 관련 이벤트들
    event MorphoPoolSet(address indexed morphoPool);
    event MorphoLensSet(address indexed morphoLens);
    event MorphoModeToggled(bool useRealMorpho);
    event MorphoMaxIterationsSet(uint256 maxIterations);
    event MorphoBlueSet(address indexed morphoBlue);
    event MorphoBlueModeToggled(bool useMorphoBlue);
    event MorphoBlueMarketSet(address indexed token, IMorphoBlue.MarketParams marketParams);
    event MorphoVaultSet(address indexed token, address indexed vault);
    event DirectMorphoVaultModeToggled(bool useDirectMorphoVault);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev 컨트랙트 초기화
     */
    function initialize(address _owner) public initializer {
        __Ownable_init(_owner);
        __Pausable_init();
        __ReentrancyGuard_init();
        nextRequestId = 1;
        morphoMaxIterations = 4; // Morpho 기본 반복 횟수 설정
    }

    /**
     * @dev 브릿지 권한 설정
     * @param bridge 브릿지 주소
     * @param authorized 권한 여부
     */
    function setBridgeAuthorization(address bridge, bool authorized) external onlyOwner {
        require(bridge != address(0), "Invalid bridge address");
        authorizedBridges[bridge] = authorized;
        emit BridgeAuthorized(bridge, authorized);
    }

    /**
     * @dev AAVE Pool 주소 설정
     * @param _aavePool AAVE Pool 컨트랙트 주소
     */
    function setAavePool(address _aavePool) external onlyOwner {
        require(_aavePool != address(0), "Invalid AAVE pool address");
        aavePool = IAavePool(_aavePool);
        emit AavePoolSet(_aavePool);
    }

    /**
     * @dev 토큰과 aToken 매핑 설정
     * @param token 기본 토큰 주소
     * @param aToken 해당하는 aToken 주소
     */
    function setATokenMapping(address token, address aToken) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(aToken != address(0), "Invalid aToken address");
        aTokens[token] = aToken;
        emit AaveTokenMapped(token, aToken);
    }

    /**
     * @dev AAVE 사용 모드 토글
     * @param _useRealAave true면 실제 AAVE 사용, false면 Mock 프로토콜 사용
     */
    function toggleAaveMode(bool _useRealAave) external onlyOwner {
        if (_useRealAave) {
            require(address(aavePool) != address(0), "AAVE pool not set");
        }
        useRealAave = _useRealAave;
        emit AaveModeToggled(_useRealAave);
    }

    /**
     * @dev AAVE Pool 주소 조회
     * @return AAVE Pool 컨트랙트 주소
     */
    function getAavePoolAddress() external view returns (address) {
        return address(aavePool);
    }

    /**
     * @dev Morpho Pool 주소 설정
     * @param _morphoPool Morpho Pool 컨트랙트 주소
     */
    function setMorphoPool(address _morphoPool) external onlyOwner {
        require(_morphoPool != address(0), "Invalid Morpho pool address");
        morphoPool = IMorpho(_morphoPool);
        emit MorphoPoolSet(_morphoPool);
    }

    /**
     * @dev Morpho Lens 주소 설정
     * @param _morphoLens Morpho Lens 컨트랙트 주소
     */
    function setMorphoLens(address _morphoLens) external onlyOwner {
        require(_morphoLens != address(0), "Invalid Morpho lens address");
        morphoLens = IMorphoLens(_morphoLens);
        emit MorphoLensSet(_morphoLens);
    }

    /**
     * @dev Morpho 사용 모드 토글
     * @param _useRealMorpho true면 실제 Morpho 사용, false면 Mock 프로토콜 사용
     */
    function toggleMorphoMode(bool _useRealMorpho) external onlyOwner {
        if (_useRealMorpho) {
            require(address(morphoPool) != address(0), "Morpho pool not set");
        }
        useRealMorpho = _useRealMorpho;
        emit MorphoModeToggled(_useRealMorpho);
    }

    /**
     * @dev Morpho 최대 반복 횟수 설정
     * @param _maxIterations 최대 반복 횟수 (가스 최적화용)
     */
    function setMorphoMaxIterations(uint256 _maxIterations) external onlyOwner {
        require(_maxIterations > 0 && _maxIterations <= 10, "Invalid max iterations");
        morphoMaxIterations = _maxIterations;
        emit MorphoMaxIterationsSet(_maxIterations);
    }

    /**
     * @dev Morpho Blue 프로토콜 설정
     * @param _morphoBlue Morpho Blue 컨트랙트 주소
     */
    function setMorphoBlue(address _morphoBlue) external onlyOwner {
        require(_morphoBlue != address(0), "Invalid Morpho Blue address");
        morphoBlue = IMorphoBlue(_morphoBlue);
        emit MorphoBlueSet(_morphoBlue);
    }

    /**
     * @dev Morpho Blue 모드 토글
     * @param _useMorphoBlue Morpho Blue 사용 여부
     */
    function toggleMorphoBlueMode(bool _useMorphoBlue) external onlyOwner {
        if (_useMorphoBlue) {
            require(address(morphoBlue) != address(0), "Morpho Blue not set");
        }
        useMorphoBlue = _useMorphoBlue;
        emit MorphoBlueModeToggled(_useMorphoBlue);
    }

    /**
     * @dev Morpho Blue 마켓 파라미터 설정
     * @param token 토큰 주소
     * @param marketParams 마켓 파라미터
     */
    function setMorphoBlueMarket(
        address token,
        IMorphoBlue.MarketParams memory marketParams
    ) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(marketParams.loanToken == token, "Token mismatch in market params");
        morphoBlueMarkets[token] = marketParams;
        emit MorphoBlueMarketSet(token, marketParams);
    }

    /**
     * @dev Morpho vault 주소 설정 (Steakhouse USDT vault 같은)
     * @param token 토큰 주소
     * @param vault Morpho vault 주소
     */
    function setMorphoVault(address token, address vault) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(vault != address(0), "Invalid vault address");
        morphoVaults[token] = vault;
        emit MorphoVaultSet(token, vault);
    }

    /**
     * @dev 직접 Morpho vault 모드 토글
     * @param _useDirectMorphoVault 직접 Morpho vault 사용 여부
     */
    function toggleDirectMorphoVaultMode(bool _useDirectMorphoVault) external onlyOwner {
        useDirectMorphoVault = _useDirectMorphoVault;
        emit DirectMorphoVaultModeToggled(_useDirectMorphoVault);
    }

    /**
     * @dev Morpho Pool 주소 조회
     * @return Morpho Pool 컨트랙트 주소
     */
    function getMorphoPoolAddress() external view returns (address) {
        return address(morphoPool);
    }

    /**
     * @dev Morpho Lens 주소 조회
     * @return Morpho Lens 컨트랙트 주소
     */
    function getMorphoLensAddress() external view returns (address) {
        return address(morphoLens);
    }

    /**
     * @dev 토큰에 렌딩 프로토콜 추가
     * @param token 토큰 주소
     * @param protocol 렌딩 프로토콜 주소
     */
    function addLendingProtocol(address token, address protocol) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(protocol != address(0), "Invalid protocol address");
        require(!protocolEnabled[token][protocol], "Protocol already added");
        
        lendingProtocols[token].push(ILendingProtocol(protocol));
        protocolEnabled[token][protocol] = true;
        emit LendingProtocolAdded(token, protocol);
    }

    /**
     * @dev 토큰에서 렌딩 프로토콜 제거
     * @param token 토큰 주소
     * @param protocol 렌딩 프로토콜 주소
     */
    function removeLendingProtocol(address token, address protocol) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(protocol != address(0), "Invalid protocol address");
        require(protocolEnabled[token][protocol], "Protocol not found");
        
        ILendingProtocol[] storage protocols = lendingProtocols[token];
        for (uint256 i = 0; i < protocols.length; i++) {
            if (address(protocols[i]) == protocol) {
                protocols[i] = protocols[protocols.length - 1];
                protocols.pop();
                break;
            }
        }
        
        protocolEnabled[token][protocol] = false;
        emit LendingProtocolRemoved(token, protocol);
    }

    /**
     * @dev 토큰의 렌딩 프로토콜 목록 조회
     * @param token 토큰 주소
     * @return 렌딩 프로토콜 주소 배열
     */
    function getLendingProtocols(address token) external view returns (address[] memory) {
        ILendingProtocol[] memory protocols = lendingProtocols[token];
        address[] memory protocolAddresses = new address[](protocols.length);
        
        for (uint256 i = 0; i < protocols.length; i++) {
            protocolAddresses[i] = address(protocols[i]);
        }
        
        return protocolAddresses;
    }

    /**
     * @dev 지원 토큰 설정
     * @param token 토큰 주소
     * @param supported 지원 여부
     */
    function setSupportedToken(address token, bool supported) external onlyOwner {
        require(token != address(0), "Invalid token address");
        supportedTokens[token] = supported;
        
        if (supported) {
            // 토큰 추가 시 기본 분배 비율 설정 (50:50)
            protocolAllocations[token][uint8(ProtocolType.AAVE)] = 5000; // 50%
            protocolAllocations[token][uint8(ProtocolType.MORPHO)] = 5000; // 50%
        }
        
        emit TokenSupported(token, supported);
    }
    
    /**
     * @dev 프로토콜 분배 비율 설정
     * @param token 토큰 주소
     * @param aavePercentage AAVE 분배 비율 (basis points, 10000 = 100%)
     * @param morphoPercentage Morpho 분배 비율 (basis points, 10000 = 100%)
     */
    function setProtocolAllocations(
        address token,
        uint256 aavePercentage,
        uint256 morphoPercentage
    ) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(supportedTokens[token], "Token not supported");
        require(aavePercentage + morphoPercentage == 10000, "Percentages must sum to 100%");
        
        protocolAllocations[token][uint8(ProtocolType.AAVE)] = aavePercentage;
        protocolAllocations[token][uint8(ProtocolType.MORPHO)] = morphoPercentage;
        
        emit ProtocolAllocationSet(token, uint8(ProtocolType.AAVE), aavePercentage);
        emit ProtocolAllocationSet(token, uint8(ProtocolType.MORPHO), morphoPercentage);
    }
    
    /**
     * @dev 프로토콜 분배 비율 조회
     * @param token 토큰 주소
     * @return aavePercentage AAVE 분배 비율
     * @return morphoPercentage Morpho 분배 비율
     */
    function getProtocolAllocations(address token) external view returns (
        uint256 aavePercentage,
        uint256 morphoPercentage
    ) {
        aavePercentage = protocolAllocations[token][uint8(ProtocolType.AAVE)];
        morphoPercentage = protocolAllocations[token][uint8(ProtocolType.MORPHO)];
    }

    /**
     * @dev Yield-bearing token 예치 (사용자가 vault shares 받기)
     * @param token 토큰 주소
     * @param assets 예치할 자산 수량
     * @return shares 발행된 shares 수량
     */
    function deposit(address token, uint256 assets) external whenNotPaused nonReentrant returns (uint256 shares) {
        require(supportedTokens[token], "Token not supported");
        require(assets > 0, "Assets must be greater than 0");
        
        // 사용자로부터 토큰 전송 받기
        IERC20(token).safeTransferFrom(msg.sender, address(this), assets);
        
        // shares 계산
        shares = _convertToShares(token, assets);
        require(shares > 0, "Invalid shares amount");
        
        // shares 발행
        totalShares[token] += shares;
        totalAssets[token] += assets;
        totalDeposited[token] += assets;
        
        emit SharesMinted(msg.sender, token, shares, assets);
        emit TokenReceived(token, assets, msg.sender);
        
        // 자동으로 렌딩 프로토콜에 예치
        _depositToLendingProtocol(token, assets);
        
        return shares;
    }
    
    /**
     * @dev Yield-bearing token 출금 (shares로 출금)
     * @param token 토큰 주소
     * @param shares 출금할 shares 수량
     * @return assets 받은 자산 수량
     */
    function redeem(address token, uint256 shares) external whenNotPaused nonReentrant returns (uint256 assets) {
        require(supportedTokens[token], "Token not supported");
        require(shares > 0, "Shares must be greater than 0");
        require(totalShares[token] >= shares, "Insufficient total shares");
        
        // assets 계산
        assets = _convertToAssets(token, shares);
        require(assets > 0, "Invalid assets amount");
        
        // 프로토콜에서 출금
        uint256 actualWithdrawn = _withdrawFromProtocols(token, assets);
        require(actualWithdrawn > 0, "Withdrawal failed");
        
        // shares 소각
        totalShares[token] -= shares;
        totalAssets[token] -= actualWithdrawn;
        totalWithdrawn[token] += actualWithdrawn;
        
        // 사용자에게 전송
        IERC20(token).safeTransfer(msg.sender, actualWithdrawn);
        
        emit SharesBurned(msg.sender, token, shares, actualWithdrawn);
        
        return actualWithdrawn;
    }
    
    /**
     * @dev 기존 브릿지 방식 (하위 호환성)
     */
    function receiveFromBridge(address token, uint256 amount) external whenNotPaused {
        require(authorizedBridges[msg.sender], "Unauthorized bridge");
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be greater than 0");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        totalDeposited[token] += amount;

        emit TokenReceived(token, amount, msg.sender);

        // 자동으로 렌딩 프로토콜에 예치
        _depositToLendingProtocol(token, amount);
    }
    
    /**
     * @dev Assets를 shares로 변환
     */
    function _convertToShares(address token, uint256 assets) internal view returns (uint256) {
        uint256 totalSharesSupply = totalShares[token];
        uint256 totalAssetsSupply = totalAssets[token];
        
        if (totalSharesSupply == 0 || totalAssetsSupply == 0) {
            // 초기 비율 1:1
            return assets;
        }
        
        // 현재 가치 기반 변환
        (, uint256 currentProtocolBalance, ) = this.getTokenBalance(token);
        uint256 currentTotalValue = currentProtocolBalance;
        
        if (currentTotalValue == 0) {
            return assets;
        }
        
        return (assets * totalSharesSupply) / currentTotalValue;
    }
    
    /**
     * @dev Shares를 assets로 변환
     */
    function _convertToAssets(address token, uint256 shares) internal view returns (uint256) {
        uint256 totalSharesSupply = totalShares[token];
        
        if (totalSharesSupply == 0) {
            return 0;
        }
        
        (, uint256 currentProtocolBalance, ) = this.getTokenBalance(token);
        uint256 currentTotalValue = currentProtocolBalance;
        
        return (shares * currentTotalValue) / totalSharesSupply;
    }
    
    /**
     * @dev 사용자의 shares 잔액 조회
     */
    function balanceOf(address user, address token) external view returns (uint256) {
        // 실제 구현에서는 ERC20 또는 별도의 매핑을 사용
        // 여기서는 단순화를 위해 0 반환
        return 0;
    }
    
    /**
     * @dev 토큰의 총 shares 공급량
     */
    function totalSupply(address token) external view returns (uint256) {
        return totalShares[token];
    }
    
    /**
     * @dev 토큰의 shares 가치 (현재 자산 기준)
     */
    function shareValue(address token) external view returns (uint256) {
        uint256 totalSharesSupply = totalShares[token];
        if (totalSharesSupply == 0) {
            return 1e18; // 1:1 비율
        }
        
        (, uint256 currentProtocolBalance, ) = this.getTokenBalance(token);
        return (currentProtocolBalance * 1e18) / totalSharesSupply;
    }

    /**
     * @dev 토큰을 렌딩 프로토콜에 예치 (외부 호출 가능)
     * @param token 토큰 주소
     * @param amount 예치할 수량
     */
    function depositToLendingProtocol(address token, uint256 amount) external whenNotPaused {
        require(supportedTokens[token], "Unsupported token");
        require(amount > 0, "Amount must be greater than 0");
        require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient balance");

        _depositToLendingProtocol(token, amount);
    }

    /**
     * @dev 렌딩 프로토콜에 토큰 예치 (내부 함수) - 비율에 따른 자동 분배
     * @param token 토큰 주소
     * @param amount 예치할 수량
     */
    function _depositToLendingProtocol(address token, uint256 amount) internal {
        // 비율 기반 분배 로직
        uint256 aaveAllocation = protocolAllocations[token][uint8(ProtocolType.AAVE)];
        uint256 morphoAllocation = protocolAllocations[token][uint8(ProtocolType.MORPHO)];
        
        if (aaveAllocation > 0 && morphoAllocation > 0) {
            // 두 프로토콜에 분배
            uint256 aaveAmount = (amount * aaveAllocation) / 10000;
            uint256 morphoAmount = amount - aaveAmount; // 나머지 전부 Morpho에
            
            if (aaveAmount > 0) {
                _depositToAave(token, aaveAmount);
            }
            if (morphoAmount > 0) {
                _depositToMorpho(token, morphoAmount);
            }
        } else if (aaveAllocation == 10000) {
            // 100% AAVE
            _depositToAave(token, amount);
        } else if (morphoAllocation == 10000) {
            // 100% Morpho
            _depositToMorpho(token, amount);
        } else {
            // 기본 로직 (기존 코드)
            _depositWithFallback(token, amount);
        }
    }
    
    /**
     * @dev AAVE에 예치
     */
    function _depositToAave(address token, uint256 amount) internal {
        if (useRealAave && address(aavePool) != address(0)) {
            IERC20(token).forceApprove(address(aavePool), amount);
            aavePool.supply(token, amount, address(this), 0);
            principalSnapshots[token] += amount;
            emit TokenDeposited(token, amount, address(aavePool));
        } else {
            revert("AAVE not configured");
        }
    }
    
    /**
     * @dev Morpho에 예치
     */
    function _depositToMorpho(address token, uint256 amount) internal {
        if (useDirectMorphoVault && morphoVaults[token] != address(0)) {
            // 직접 Morpho vault 사용 (Steakhouse USDT vault 방식)
            address vault = morphoVaults[token];
            IERC20(token).forceApprove(vault, amount);
            
            try IERC4626(vault).deposit(amount, address(this)) returns (uint256 shares) {
                require(shares > 0, "Morpho vault deposit failed");
                principalSnapshots[token] += amount;
                emit TokenDeposited(token, amount, vault);
            } catch {
                revert("Morpho vault deposit failed");
            }
        } else if (useMorphoBlue && address(morphoBlue) != address(0)) {
            IMorphoBlue.MarketParams memory marketParams = morphoBlueMarkets[token];
            require(marketParams.loanToken != address(0), "Morpho Blue market not configured");
            
            IERC20(token).forceApprove(address(morphoBlue), amount);
            
            try morphoBlue.supply(
                marketParams,
                amount,
                0,
                address(this),
                ""
            ) returns (uint256 actualSupplied, uint256) {
                require(actualSupplied > 0, "Morpho Blue supply failed");
                principalSnapshots[token] += actualSupplied;
                emit TokenDeposited(token, actualSupplied, address(morphoBlue));
            } catch {
                revert("Morpho Blue market not available or supply failed");
            }
        } else if (useRealMorpho && address(morphoPool) != address(0)) {
            IERC20(token).forceApprove(address(morphoPool), amount);
            
            uint256 actualSupplied = morphoPool.supply(
                token,
                amount,
                address(this),
                morphoMaxIterations
            );
            
            require(actualSupplied > 0, "Morpho supply failed");
            principalSnapshots[token] += actualSupplied;
            emit TokenDeposited(token, actualSupplied, address(morphoPool));
        } else {
            revert("Morpho not configured");
        }
    }
    
    /**
     * @dev 기존 방식의 fallback 로직
     */
    function _depositWithFallback(address token, uint256 amount) internal {
        if (useDirectMorphoVault && morphoVaults[token] != address(0)) {
            address vault = morphoVaults[token];
            IERC20(token).forceApprove(vault, amount);
            
            try IERC4626(vault).deposit(amount, address(this)) returns (uint256 shares) {
                require(shares > 0, "Morpho vault deposit failed");
                principalSnapshots[token] += amount;
                emit TokenDeposited(token, amount, vault);
            } catch {
                revert("Morpho vault deposit failed");
            }
        } else if (useRealAave && address(aavePool) != address(0)) {
            IERC20(token).forceApprove(address(aavePool), amount);
            aavePool.supply(token, amount, address(this), 0);
            principalSnapshots[token] += amount;
            emit TokenDeposited(token, amount, address(aavePool));
        } else {
            ILendingProtocol[] memory protocols = lendingProtocols[token];
            require(protocols.length > 0, "No lending protocol set for token");

            ILendingProtocol protocol = protocols[0];
            IERC20(token).forceApprove(address(protocol), amount);
            
            bool success = protocol.deposit(token, amount);
            require(success, "Deposit to lending protocol failed");

            principalSnapshots[token] += amount;
            emit TokenDeposited(token, amount, address(protocol));
        }
    }

    /**
     * @dev 특정 렌딩 프로토콜에 토큰 예치 (owner 전용)
     * @param token 토큰 주소
     * @param protocol 렌딩 프로토콜 주소
     * @param amount 예치할 수량
     */
    function depositToSpecificProtocol(address token, address protocol, uint256 amount) external onlyOwner {
        require(protocolEnabled[token][protocol], "Protocol not enabled for token");
        require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient balance");

        // 토큰 승인
        IERC20(token).forceApprove(protocol, amount);
        
        // 렌딩 프로토콜에 예치
        bool success = ILendingProtocol(protocol).deposit(token, amount);
        require(success, "Deposit to lending protocol failed");

        // 원금 스냅샷 업데이트
        principalSnapshots[token] += amount;

        emit TokenDeposited(token, amount, protocol);
    }

    /**
     * @dev 비율에 따른 출금 로직
     */
    function _withdrawFromProtocols(address token, uint256 amount) internal returns (uint256 withdrawnAmount) {
        uint256 aaveAllocation = protocolAllocations[token][uint8(ProtocolType.AAVE)];
        uint256 morphoAllocation = protocolAllocations[token][uint8(ProtocolType.MORPHO)];
        
        if (aaveAllocation > 0 && morphoAllocation > 0) {
            // 두 프로토콜에서 비율에 따라 출금
            uint256 aaveAmount = (amount * aaveAllocation) / 10000;
            uint256 morphoAmount = amount - aaveAmount;
            
            uint256 aaveWithdrawn = 0;
            uint256 morphoWithdrawn = 0;
            
            if (aaveAmount > 0) {
                aaveWithdrawn = _withdrawFromAave(token, aaveAmount);
            }
            if (morphoAmount > 0) {
                morphoWithdrawn = _withdrawFromMorpho(token, morphoAmount);
            }
            
            withdrawnAmount = aaveWithdrawn + morphoWithdrawn;
        } else if (aaveAllocation == 10000) {
            // 100% AAVE에서 출금
            withdrawnAmount = _withdrawFromAave(token, amount);
        } else if (morphoAllocation == 10000) {
            // 100% Morpho에서 출금
            withdrawnAmount = _withdrawFromMorpho(token, amount);
        } else {
            // 기본 fallback
            withdrawnAmount = _withdrawWithFallback(token, amount);
        }
    }
    
    /**
     * @dev AAVE에서 출금
     */
    function _withdrawFromAave(address token, uint256 amount) internal returns (uint256) {
        if (useRealAave && address(aavePool) != address(0)) {
            return aavePool.withdraw(token, amount, address(this));
        }
        return 0;
    }
    
    /**
     * @dev Morpho에서 출금
     */
    function _withdrawFromMorpho(address token, uint256 amount) internal returns (uint256) {
        if (useDirectMorphoVault && morphoVaults[token] != address(0)) {
            address vault = morphoVaults[token];
            try IERC4626(vault).withdraw(amount, address(this), address(this)) returns (uint256 shares) {
                return amount;
            } catch {
                return 0;
            }
        } else if (useMorphoBlue && address(morphoBlue) != address(0)) {
            IMorphoBlue.MarketParams memory marketParams = morphoBlueMarkets[token];
            if (marketParams.loanToken != address(0)) {
                try morphoBlue.withdraw(
                    marketParams,
                    amount,
                    0,
                    address(this),
                    address(this)
                ) returns (uint256 withdrawnAmount, uint256) {
                    return withdrawnAmount;
                } catch {
                    return 0;
                }
            }
        } else if (useRealMorpho && address(morphoPool) != address(0)) {
            return morphoPool.withdraw(token, amount, address(this), morphoMaxIterations);
        }
        return 0;
    }
    
    /**
     * @dev 기존 방식의 fallback 출금
     */
    function _withdrawWithFallback(address token, uint256 amount) internal returns (uint256) {
        if (useDirectMorphoVault && morphoVaults[token] != address(0)) {
            address vault = morphoVaults[token];
            try IERC4626(vault).withdraw(amount, address(this), address(this)) returns (uint256 shares) {
                return amount;
            } catch {
                return 0;
            }
        } else if (useRealAave && address(aavePool) != address(0)) {
            return aavePool.withdraw(token, amount, address(this));
        }
        return 0;
    }
    
    /**
     * @dev 렌딩 프로토콜에서 출금 요청
     * @param token 토큰 주소
     * @param amount 출금할 수량
     * @return requestId 출금 요청 ID
     */
    function requestWithdraw(address token, uint256 amount) external whenNotPaused nonReentrant returns (uint256) {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be greater than 0");

        uint256 requestId = nextRequestId++;
        
        // 비율 기반 출금 시도
        uint256 actualWithdrawn = _withdrawFromProtocols(token, amount);
        require(actualWithdrawn > 0, "Withdrawal failed");
        
        // 사용자에게 전송
        IERC20(token).safeTransfer(msg.sender, actualWithdrawn);
        
        withdrawRequests[requestId] = WithdrawRequest({
            token: token,
            amount: actualWithdrawn,
            requestTime: block.timestamp,
            protocolRequestId: 0,
            claimed: true,
            requester: msg.sender
        });
        
        totalWithdrawn[token] += actualWithdrawn;
        userWithdrawRequests[msg.sender].push(requestId);
        
        emit WithdrawRequested(requestId, token, actualWithdrawn, msg.sender);
        emit WithdrawClaimed(requestId, token, actualWithdrawn, msg.sender);
        
        return requestId;
        
        /* 기존 코드 - 예비용
        if (useDirectMorphoVault && morphoVaults[token] != address(0)) {
        */
    }

    /**
     * @dev 출금 대기 기간 이후 토큰 클레임
     * @param requestId 출금 요청 ID
     */
    function claimWithdraw(uint256 requestId) external whenNotPaused nonReentrant {
        WithdrawRequest storage request = withdrawRequests[requestId];
        require(request.requester == msg.sender, "Not the requester");
        require(!request.claimed, "Already claimed");

        ILendingProtocol[] memory protocols = lendingProtocols[request.token];
        require(protocols.length > 0, "No lending protocol set for token");
        
        // WithdrawRequest에 저장된 protocolRequestId로 해당 프로토콜 찾기 필요
        // 단순화를 위해 첫 번째 프로토콜 사용
        ILendingProtocol protocol = protocols[0];

        // 렌딩 프로토콜에서 클레임 가능한지 확인
        (bool isReady, ) = protocol.getWithdrawStatus(request.protocolRequestId);
        require(isReady, "Withdraw not ready for claim");

        // 렌딩 프로토콜에서 클레임
        bool success = protocol.claim(request.token, request.protocolRequestId);
        require(success, "Claim from lending protocol failed");

        request.claimed = true;
        totalWithdrawn[request.token] += request.amount;

        // 사용자에게 토큰 전송
        IERC20(request.token).safeTransfer(msg.sender, request.amount);

        emit WithdrawClaimed(requestId, request.token, request.amount, msg.sender);
    }

    /**
     * @dev 특정 토큰의 현재 잔액 조회 (렌딩 프로토콜 포함)
     * @param token 토큰 주소
     * @return contractBalance 컨트랙트 보유 잔액
     * @return protocolBalance 렌딩 프로토콜 예치 잔액 (원금 + 이자)
     * @return totalBalance 전체 잔액
     */
    function getTokenBalance(address token) external view returns (
        uint256 contractBalance,
        uint256 protocolBalance,
        uint256 totalBalance
    ) {
        contractBalance = IERC20(token).balanceOf(address(this));
        
        if (useDirectMorphoVault && morphoVaults[token] != address(0)) {
            // 직접 Morpho vault 잔액 조회
            address vault = morphoVaults[token];
            try IERC4626(vault).balanceOf(address(this)) returns (uint256 shares) {
                if (shares > 0) {
                    try IERC4626(vault).convertToAssets(shares) returns (uint256 assets) {
                        protocolBalance = assets;
                    } catch {
                        protocolBalance = 0;
                    }
                }
            } catch {
                protocolBalance = 0;
            }
        } else if (useRealAave && aTokens[token] != address(0)) {
            // AAVE aToken 잔액 조회
            protocolBalance = IAToken(aTokens[token]).balanceOf(address(this));
        } else if (useMorphoBlue && address(morphoBlue) != address(0)) {
            // Morpho Blue 잔액 조회
            IMorphoBlue.MarketParams memory marketParams = morphoBlueMarkets[token];
            if (marketParams.loanToken != address(0)) {
                try morphoBlue.id(marketParams) returns (bytes32 marketId) {
                    try morphoBlue.position(marketId, address(this)) returns (IMorphoBlue.Position memory position) {
                        try morphoBlue.market(marketId) returns (IMorphoBlue.Market memory market) {
                            if (market.totalSupplyShares > 0) {
                                protocolBalance = (position.supplyShares * market.totalSupplyAssets) / market.totalSupplyShares;
                            }
                        } catch {
                            protocolBalance = 0;
                        }
                    } catch {
                        protocolBalance = 0;
                    }
                } catch {
                    // Morpho Blue 조회 실패 시 0 반환
                    protocolBalance = 0;
                }
            }
        } else if (useRealMorpho && address(morphoPool) != address(0)) {
            // Morpho 잔액 조회 (구버전)
            if (address(morphoLens) != address(0)) {
                // Morpho Lens를 통한 정확한 잔액 조회
                protocolBalance = morphoLens.getCurrentSupplyBalanceInOf(
                    address(morphoPool),
                    token,
                    address(this)
                );
            } else {
                // Morpho Pool에서 직접 조회
                protocolBalance = morphoPool.supplyBalanceInOf(token, address(this));
            }
        } else {
            // 기존 Mock 프로토콜들의 잔액 합계
            ILendingProtocol[] memory protocols = lendingProtocols[token];
            for (uint256 i = 0; i < protocols.length; i++) {
                protocolBalance += protocols[i].getBalance(token, address(this));
            }
        }
        
        totalBalance = contractBalance + protocolBalance;
    }

    /**
     * @dev 특정 프로토콜에서의 토큰 잔액 조회
     * @param token 토큰 주소
     * @param protocol 프로토콜 주소
     * @return balance 해당 프로토콜에서의 잔액
     */
    function getTokenBalanceInProtocol(address token, address protocol) external view returns (uint256 balance) {
        require(protocolEnabled[token][protocol], "Protocol not enabled for token");
        return ILendingProtocol(protocol).getBalance(token, address(this));
    }

    /**
     * @dev 토큰별 수익률 계산
     * @param token 토큰 주소
     * @return totalValue 현재 총 가치 (원금 + 이자)
     * @return principal 원금
     * @return yieldAmount 이자 수익
     * @return yieldRate 수익률 (basis points, 10000 = 100%)
     */
    function calculateYield(address token) external view returns (
        uint256 totalValue,
        uint256 principal,
        uint256 yieldAmount,
        uint256 yieldRate
    ) {
        principal = principalSnapshots[token];
        
        if (principal == 0) {
            return (0, 0, 0, 0);
        }

        (, uint256 protocolBalance, ) = this.getTokenBalance(token);
        totalValue = protocolBalance;
        
        if (totalValue >= principal) {
            yieldAmount = totalValue - principal;
            yieldRate = (yieldAmount * 10000) / principal; // basis points
        }
    }
    
    /**
     * @dev APY 계산 및 업데이트
     * @param token 토큰 주소
     * @return currentAPY 현재 연간 수익률 (basis points)
     */
    function calculateAndUpdateAPY(address token) external returns (uint256 currentAPY) {
        require(supportedTokens[token], "Token not supported");
        
        (uint256 totalValue, uint256 principal, uint256 yieldAmount, ) = this.calculateYield(token);
        
        if (principal == 0) {
            return 0;
        }
        
        uint256 lastUpdate = lastAPYUpdate[token];
        uint256 currentTime = block.timestamp;
        
        if (lastUpdate > 0 && currentTime > lastUpdate) {
            uint256 timeElapsed = currentTime - lastUpdate;
            
            // 연간 수익률 계산 (365일 기준)
            if (timeElapsed > 0 && yieldAmount > 0) {
                uint256 secondsInYear = 365 * 24 * 60 * 60;
                currentAPY = (yieldAmount * secondsInYear * 10000) / (principal * timeElapsed);
            }
        }
        
        // APY 히스토리 저장
        apyHistory[token].push(APYSnapshot({
            timestamp: currentTime,
            totalValue: totalValue,
            principal: principal,
            apy: currentAPY
        }));
        
        lastAPYUpdate[token] = currentTime;
        
        emit APYUpdated(token, currentAPY, currentTime);
        
        return currentAPY;
    }
    
    /**
     * @dev 토큰의 최근 APY 조회
     * @param token 토큰 주소
     * @return latestAPY 최근 APY
     * @return timestamp 마지막 업데이트 시간
     */
    function getLatestAPY(address token) external view returns (uint256 latestAPY, uint256 timestamp) {
        APYSnapshot[] memory history = apyHistory[token];
        if (history.length > 0) {
            APYSnapshot memory latest = history[history.length - 1];
            return (latest.apy, latest.timestamp);
        }
        return (0, 0);
    }
    
    /**
     * @dev 토큰의 APY 히스토리 조회
     * @param token 토큰 주소
     * @param limit 최대 반환 개수
     * @return 최근 APY 히스토리 배열
     */
    function getAPYHistory(address token, uint256 limit) external view returns (APYSnapshot[] memory) {
        APYSnapshot[] memory history = apyHistory[token];
        uint256 length = history.length;
        
        if (length == 0) {
            return new APYSnapshot[](0);
        }
        
        uint256 returnLength = length > limit ? limit : length;
        APYSnapshot[] memory result = new APYSnapshot[](returnLength);
        
        for (uint256 i = 0; i < returnLength; i++) {
            result[i] = history[length - returnLength + i];
        }
        
        return result;
    }
    
    /**
     * @dev 프로토콜별 예치 잔액 조회
     * @param token 토큰 주소
     * @return aaveBalance AAVE 예치 잔액
     * @return morphoBalance Morpho 예치 잔액
     * @return totalProtocolBalance 전체 프로토콜 예치 잔액
     */
    function getProtocolBalances(address token) external view returns (
        uint256 aaveBalance,
        uint256 morphoBalance,
        uint256 totalProtocolBalance
    ) {
        // AAVE 잔액
        if (useRealAave && aTokens[token] != address(0)) {
            aaveBalance = IAToken(aTokens[token]).balanceOf(address(this));
        }
        
        // Morpho 잔액
        if (useDirectMorphoVault && morphoVaults[token] != address(0)) {
            address vault = morphoVaults[token];
            try IERC4626(vault).balanceOf(address(this)) returns (uint256 shares) {
                if (shares > 0) {
                    try IERC4626(vault).convertToAssets(shares) returns (uint256 assets) {
                        morphoBalance = assets;
                    } catch {
                        morphoBalance = 0;
                    }
                }
            } catch {
                morphoBalance = 0;
            }
        } else if (useMorphoBlue && address(morphoBlue) != address(0)) {
            // Morpho Blue 잔액 조회 로직
            IMorphoBlue.MarketParams memory marketParams = morphoBlueMarkets[token];
            if (marketParams.loanToken != address(0)) {
                try morphoBlue.id(marketParams) returns (bytes32 marketId) {
                    try morphoBlue.position(marketId, address(this)) returns (IMorphoBlue.Position memory position) {
                        try morphoBlue.market(marketId) returns (IMorphoBlue.Market memory market) {
                            if (market.totalSupplyShares > 0) {
                                morphoBalance = (position.supplyShares * market.totalSupplyAssets) / market.totalSupplyShares;
                            }
                        } catch {}
                    } catch {}
                } catch {}
            }
        }
        
        totalProtocolBalance = aaveBalance + morphoBalance;
    }

    /**
     * @dev 사용자의 출금 요청 목록 조회
     * @param user 사용자 주소
     * @return 출금 요청 ID 배열
     */
    function getUserWithdrawRequests(address user) external view returns (uint256[] memory) {
        return userWithdrawRequests[user];
    }

    /**
     * @dev 출금 요청 상세 정보 조회
     * @param requestId 출금 요청 ID
     * @return request 출금 요청 정보
     * @return isReady 클레임 가능 여부
     * @return claimableTime 클레임 가능 시간
     */
    function getWithdrawRequestInfo(uint256 requestId) external view returns (
        WithdrawRequest memory request,
        bool isReady,
        uint256 claimableTime
    ) {
        request = withdrawRequests[requestId];
        
        if (request.token != address(0)) {
            ILendingProtocol[] memory protocols = lendingProtocols[request.token];
            if (protocols.length > 0) {
                // 첫 번째 프로토콜에서 상태 확인 (단순화)
                (isReady, claimableTime) = protocols[0].getWithdrawStatus(request.protocolRequestId);
            }
        }
    }

    /**
     * @dev 토큰별 예치/출금 통계 조회
     * @param token 토큰 주소
     * @return deposited 총 예치 수량
     * @return withdrawn 총 출금 수량
     * @return netDeposited 순 예치 수량
     * @return totalSharesSupply 총 shares 공급량
     * @return currentShareValue 현재 share 가치
     */
    function getTokenStats(address token) external view returns (
        uint256 deposited,
        uint256 withdrawn,
        uint256 netDeposited,
        uint256 totalSharesSupply,
        uint256 currentShareValue
    ) {
        deposited = totalDeposited[token];
        withdrawn = totalWithdrawn[token];
        netDeposited = deposited > withdrawn ? deposited - withdrawn : 0;
        totalSharesSupply = totalShares[token];
        currentShareValue = this.shareValue(token);
    }

    /**
     * @dev 컨트랙트 일시 정지
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev 컨트랙트 일시 정지 해제
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev 긴급 상황시 토큰 회수 (owner만 가능)
     * @param token 토큰 주소
     * @param amount 회수할 수량
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @dev Morpho 공급 이율 조회
     * @param token 토큰 주소
     * @return 연간 공급 이율 (ray 단위)
     */
    function getMorphoSupplyRate(address token) external view returns (uint256) {
        require(address(morphoPool) != address(0), "Morpho pool not set");
        return morphoPool.supplyRatePerYear(token);
    }

    /**
     * @dev Morpho 차입 이율 조회
     * @param token 토큰 주소
     * @return 연간 차입 이율 (ray 단위)
     */
    function getMorphoBorrowRate(address token) external view returns (uint256) {
        require(address(morphoPool) != address(0), "Morpho pool not set");
        return morphoPool.borrowRatePerYear(token);
    }

    /**
     * @dev AAVE와 Morpho 이율 비교
     * @param token 토큰 주소
     * @return aaveRate AAVE 공급 이율
     * @return morphoRate Morpho 공급 이율
     * @return betterProtocol 더 나은 프로토콜 (0: 동일, 1: AAVE, 2: Morpho)
     */
    function compareRates(address token) external view returns (
        uint256 aaveRate,
        uint256 morphoRate,
        uint8 betterProtocol
    ) {
        // AAVE 이율 조회 (간단화)
        aaveRate = _getAaveRate(token);
        
        // Morpho 이율 조회
        morphoRate = _getMorphoRate(token);

        // 비교 결과
        if (aaveRate == morphoRate) {
            betterProtocol = 0;
        } else if (aaveRate > morphoRate) {
            betterProtocol = 1;
        } else {
            betterProtocol = 2;
        }
    }

    /**
     * @dev AAVE 이율 조회 (내부 함수)
     */
    function _getAaveRate(address token) internal view returns (uint256) {
        if (address(aavePool) == address(0) || aTokens[token] == address(0)) {
            return 0;
        }
        
        try aavePool.getReserveData(token) returns (
            uint256, uint128, uint128 rate, uint128, uint128, uint128, uint40, uint16, address, address, address, address, uint128, uint128, uint128
        ) {
            return rate;
        } catch {
            return 0;
        }
    }

    /**
     * @dev Morpho 이율 조회 (내부 함수)
     */
    function _getMorphoRate(address token) internal view returns (uint256) {
        if (useMorphoBlue && address(morphoBlue) != address(0)) {
            // Morpho Blue 이율 조회 (간단화 - 실제로는 IRM을 통해 계산)
            IMorphoBlue.MarketParams memory marketParams = morphoBlueMarkets[token];
            if (marketParams.loanToken != address(0)) {
                // Morpho Blue는 시장별로 다른 이율을 가지므로 기본값 반환
                // 실제 구현에서는 IRM 컨트랙트를 호출해야 함
                return 3000000000000000000000000000; // 3% APR 예시
            }
            return 0;
        } else if (address(morphoPool) != address(0)) {
            try morphoPool.supplyRatePerYear(token) returns (uint256 rate) {
                return rate;
            } catch {
                return 0;
            }
        }
        return 0;
    }

    /**
     * @dev 수익률 스냅샷 업데이트 (수동 호출 가능)
     * @param token 토큰 주소
     */
    function updateYieldSnapshot(address token) external {
        (uint256 totalValue, uint256 principal, uint256 yieldAmount, uint256 yieldRate) = this.calculateYield(token);
        emit YieldCalculated(token, totalValue, principal, yieldAmount, yieldRate);
        
        // APY도 동시에 업데이트
        this.calculateAndUpdateAPY(token);
    }
    
    /**
     * @dev 토큰의 현재 예치 비율 획득
     * @param token 토큰 주소
     * @return aavePercentage AAVE 비율 (basis points)
     * @return morphoPercentage Morpho 비율 (basis points)
     */
    function getCurrentAllocationRatio(address token) external view returns (
        uint256 aavePercentage,
        uint256 morphoPercentage
    ) {
        (uint256 aaveBalance, uint256 morphoBalance, uint256 totalBalance) = this.getProtocolBalances(token);
        
        if (totalBalance == 0) {
            return (0, 0);
        }
        
        aavePercentage = (aaveBalance * 10000) / totalBalance;
        morphoPercentage = (morphoBalance * 10000) / totalBalance;
    }
    
    /**
     * @dev Rebalance 프로토콜 간 자산 (목표 비율로 조정)
     * @param token 토큰 주소
     */
    function rebalanceProtocols(address token) external onlyOwner {
        require(supportedTokens[token], "Token not supported");
        
        (uint256 aaveBalance, uint256 morphoBalance, uint256 totalBalance) = this.getProtocolBalances(token);
        
        if (totalBalance == 0) {
            return;
        }
        
        uint256 targetAaveBalance = (totalBalance * protocolAllocations[token][uint8(ProtocolType.AAVE)]) / 10000;
        uint256 targetMorphoBalance = totalBalance - targetAaveBalance;
        
        // AAVE에서 Morpho로 이동
        if (aaveBalance > targetAaveBalance) {
            uint256 moveAmount = aaveBalance - targetAaveBalance;
            _moveFromAaveToMorpho(token, moveAmount);
        }
        // Morpho에서 AAVE로 이동
        else if (morphoBalance > targetMorphoBalance) {
            uint256 moveAmount = morphoBalance - targetMorphoBalance;
            _moveFromMorphoToAave(token, moveAmount);
        }
    }
    
    /**
     * @dev AAVE에서 Morpho로 자산 이동
     */
    function _moveFromAaveToMorpho(address token, uint256 amount) internal {
        // AAVE에서 출금
        uint256 withdrawn = _withdrawFromAave(token, amount);
        if (withdrawn > 0) {
            // Morpho에 예치
            _depositToMorpho(token, withdrawn);
        }
    }
    
    /**
     * @dev Morpho에서 AAVE로 자산 이동
     */
    function _moveFromMorphoToAave(address token, uint256 amount) internal {
        // Morpho에서 출금
        uint256 withdrawn = _withdrawFromMorpho(token, amount);
        if (withdrawn > 0) {
            // AAVE에 예치
            _depositToAave(token, withdrawn);
        }
    }

    /**
     * @dev 전체 vault 통계 조회
     * @return totalValueLocked 전체 예치된 가치
     * @return totalYieldGenerated 전체 수익 발생량
     * @return averageAPY 평균 APY
     */
    function getVaultStats() external view returns (
        uint256 totalValueLocked,
        uint256 totalYieldGenerated,
        uint256 averageAPY
    ) {
        // 예시 데이터 - 실제 구현에서는 모든 지원 토큰 순회
        totalValueLocked = 0;
        totalYieldGenerated = 0;
        averageAPY = 0;
    }
    
    /**
     * @dev UUPS 업그레이드를 위한 인증 함수 (owner만 업그레이드 가능)
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
