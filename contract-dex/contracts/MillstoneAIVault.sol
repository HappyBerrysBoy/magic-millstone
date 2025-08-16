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
        emit TokenSupported(token, supported);
    }

    /**
     * @dev 브릿지로부터 토큰 받기
     * @param token 토큰 주소
     * @param amount 수량
     */
    function receiveFromBridge(address token, uint256 amount) external whenNotPaused {
        require(authorizedBridges[msg.sender], "Unauthorized bridge");
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be greater than 0");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        totalDeposited[token] += amount;

        emit TokenReceived(token, amount, msg.sender);

        // Automatically deposit to lending protocol
        _depositToLendingProtocol(token, amount);
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
     * @dev 렌딩 프로토콜에 토큰 예치 (내부 함수) - 다중 프로토콜 지원
     * @param token 토큰 주소
     * @param amount 예치할 수량
     */
    function _depositToLendingProtocol(address token, uint256 amount) internal {
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
        } else if (useRealAave && address(aavePool) != address(0)) {
            // 실제 AAVE Pool 사용
            IERC20(token).forceApprove(address(aavePool), amount);
            aavePool.supply(token, amount, address(this), 0);
            principalSnapshots[token] += amount;
            emit TokenDeposited(token, amount, address(aavePool));
        } else if (useMorphoBlue && address(morphoBlue) != address(0)) {
            // Morpho Blue 사용
            IMorphoBlue.MarketParams memory marketParams = morphoBlueMarkets[token];
            require(marketParams.loanToken != address(0), "Morpho Blue market not configured");
            
            IERC20(token).forceApprove(address(morphoBlue), amount);
            
            try morphoBlue.supply(
                marketParams,
                amount,
                0, // shares = 0, assets 기반으로 공급
                address(this),
                ""
            ) returns (uint256 actualSupplied, uint256) {
                require(actualSupplied > 0, "Morpho Blue supply failed");
                principalSnapshots[token] += actualSupplied;
                emit TokenDeposited(token, actualSupplied, address(morphoBlue));
            } catch {
                // Morpho Blue supply 실패 시 fallback 처리
                revert("Morpho Blue market not available or supply failed");
            }
        } else if (useRealMorpho && address(morphoPool) != address(0)) {
            // 실제 Morpho Pool 사용 (구버전)
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
            // 기존 Mock 프로토콜 사용
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
     * @dev 렌딩 프로토콜에서 출금 요청
     * @param token 토큰 주소
     * @param amount 출금할 수량
     * @return requestId 출금 요청 ID
     */
    function requestWithdraw(address token, uint256 amount) external whenNotPaused nonReentrant returns (uint256) {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be greater than 0");

        uint256 requestId = nextRequestId++;
        uint256 protocolRequestId = 0;

        if (useDirectMorphoVault && morphoVaults[token] != address(0)) {
            // 직접 Morpho vault에서 출금 (Steakhouse USDT vault 방식)
            address vault = morphoVaults[token];
            
            try IERC4626(vault).withdraw(amount, address(this), address(this)) returns (uint256 shares) {
                require(amount > 0, "Morpho vault withdraw failed");
                
                IERC20(token).safeTransfer(msg.sender, amount);
                
                withdrawRequests[requestId] = WithdrawRequest({
                    token: token,
                    amount: amount,
                    requestTime: block.timestamp,
                    protocolRequestId: 0,
                    claimed: true,
                    requester: msg.sender
                });

                totalWithdrawn[token] += amount;
                emit WithdrawClaimed(requestId, token, amount, msg.sender);
            } catch {
                revert("Morpho vault withdraw failed");
            }
        } else if (useRealAave && address(aavePool) != address(0)) {
            // AAVE에서는 즉시 출금 가능 (pending 기간 없음)
            uint256 withdrawnAmount = aavePool.withdraw(token, amount, address(this));
            require(withdrawnAmount > 0, "AAVE withdraw failed");
            
            IERC20(token).safeTransfer(msg.sender, withdrawnAmount);
            
            withdrawRequests[requestId] = WithdrawRequest({
                token: token,
                amount: withdrawnAmount,
                requestTime: block.timestamp,
                protocolRequestId: 0,
                claimed: true,
                requester: msg.sender
            });

            totalWithdrawn[token] += withdrawnAmount;
            emit WithdrawClaimed(requestId, token, withdrawnAmount, msg.sender);
        } else if (useMorphoBlue && address(morphoBlue) != address(0)) {
            // Morpho Blue에서 즉시 출금 가능
            IMorphoBlue.MarketParams memory marketParams = morphoBlueMarkets[token];
            require(marketParams.loanToken != address(0), "Morpho Blue market not configured");
            
            try morphoBlue.withdraw(
                marketParams,
                amount,
                0, // shares = 0, assets 기반으로 출금
                address(this),
                address(this)
            ) returns (uint256 withdrawnAmount, uint256) {
                require(withdrawnAmount > 0, "Morpho Blue withdraw failed");
                
                IERC20(token).safeTransfer(msg.sender, withdrawnAmount);
                
                withdrawRequests[requestId] = WithdrawRequest({
                    token: token,
                    amount: withdrawnAmount,
                    requestTime: block.timestamp,
                    protocolRequestId: 0,
                    claimed: true,
                    requester: msg.sender
                });

                totalWithdrawn[token] += withdrawnAmount;
                emit WithdrawClaimed(requestId, token, withdrawnAmount, msg.sender);
            } catch {
                revert("Morpho Blue market not available or withdraw failed");
            }
        } else if (useRealMorpho && address(morphoPool) != address(0)) {
            // Morpho에서도 즉시 출금 가능 (pending 기간 없음)
            uint256 withdrawnAmount = morphoPool.withdraw(
                token,
                amount,
                address(this),
                morphoMaxIterations
            );
            require(withdrawnAmount > 0, "Morpho withdraw failed");
            
            IERC20(token).safeTransfer(msg.sender, withdrawnAmount);
            
            withdrawRequests[requestId] = WithdrawRequest({
                token: token,
                amount: withdrawnAmount,
                requestTime: block.timestamp,
                protocolRequestId: 0,
                claimed: true,
                requester: msg.sender
            });

            totalWithdrawn[token] += withdrawnAmount;
            emit WithdrawClaimed(requestId, token, withdrawnAmount, msg.sender);
        } else {
            // 기존 Mock 프로토콜 사용 (pending 기간 있음)
            ILendingProtocol[] memory protocols = lendingProtocols[token];
            require(protocols.length > 0, "No lending protocol set for token");

            // 첫 번째 프로토콜에서 출금 요청 (향후 분산 로직 추가 가능)
            ILendingProtocol protocol = protocols[0];
            protocolRequestId = protocol.withdraw(token, amount);

            withdrawRequests[requestId] = WithdrawRequest({
                token: token,
                amount: amount,
                requestTime: block.timestamp,
                protocolRequestId: protocolRequestId,
                claimed: false,
                requester: msg.sender
            });
        }

        userWithdrawRequests[msg.sender].push(requestId);
        emit WithdrawRequested(requestId, token, amount, msg.sender);
        return requestId;
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
     */
    function getTokenStats(address token) external view returns (
        uint256 deposited,
        uint256 withdrawn
    ) {
        deposited = totalDeposited[token];
        withdrawn = totalWithdrawn[token];
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
    }

    /**
     * @dev UUPS 업그레이드를 위한 인증 함수 (owner만 업그레이드 가능)
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
