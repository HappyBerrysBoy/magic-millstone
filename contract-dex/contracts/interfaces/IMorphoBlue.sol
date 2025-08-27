// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IMorphoBlue
 * @dev Morpho Blue 프로토콜 인터페이스
 */
interface IMorphoBlue {
    /**
     * @dev 마켓 파라미터 구조체
     */
    struct MarketParams {
        address loanToken;       // 대출 토큰 주소
        address collateralToken; // 담보 토큰 주소  
        address oracle;          // 오라클 주소
        address irm;            // 이자율 모델 주소
        uint256 lltv;           // 청산 LTV
    }

    /**
     * @dev 마켓 상태 구조체
     */
    struct Market {
        uint128 totalSupplyAssets;
        uint128 totalSupplyShares;
        uint128 totalBorrowAssets;
        uint128 totalBorrowShares;
        uint128 lastUpdate;
        uint128 fee;
    }

    /**
     * @dev 포지션 구조체
     */
    struct Position {
        uint256 supplyShares;
        uint128 borrowShares;
        uint128 collateral;
    }

    /**
     * @notice 토큰 공급
     * @param marketParams 마켓 파라미터
     * @param assets 공급할 자산 수량
     * @param shares 공급할 주식 수량 (assets 또는 shares 중 하나는 0이어야 함)
     * @param onBehalf 대신 공급받을 주소
     * @param data 콜백 데이터
     * @return assetsSupplied 실제 공급된 자산 수량
     * @return sharesSupplied 실제 발행된 주식 수량
     */
    function supply(
        MarketParams memory marketParams,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        bytes memory data
    ) external returns (uint256 assetsSupplied, uint256 sharesSupplied);

    /**
     * @notice 토큰 출금
     * @param marketParams 마켓 파라미터
     * @param assets 출금할 자산 수량
     * @param shares 출금할 주식 수량 (assets 또는 shares 중 하나는 0이어야 함)
     * @param onBehalf 대신 출금할 주소
     * @param receiver 토큰을 받을 주소
     * @return assetsWithdrawn 실제 출금된 자산 수량
     * @return sharesWithdrawn 실제 소각된 주식 수량
     */
    function withdraw(
        MarketParams memory marketParams,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        address receiver
    ) external returns (uint256 assetsWithdrawn, uint256 sharesWithdrawn);

    /**
     * @notice 담보 공급
     * @param marketParams 마켓 파라미터
     * @param assets 담보 수량
     * @param onBehalf 대신 담보를 공급받을 주소
     * @param data 콜백 데이터
     */
    function supplyCollateral(
        MarketParams memory marketParams,
        uint256 assets,
        address onBehalf,
        bytes memory data
    ) external;

    /**
     * @notice 차입
     * @param marketParams 마켓 파라미터
     * @param assets 차입할 자산 수량
     * @param shares 차입할 주식 수량 (assets 또는 shares 중 하나는 0이어야 함)
     * @param onBehalf 대신 차입할 주소
     * @param receiver 토큰을 받을 주소
     * @return assetsBorrowed 실제 차입된 자산 수량
     * @return sharesBorrowed 실제 발행된 부채 주식 수량
     */
    function borrow(
        MarketParams memory marketParams,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        address receiver
    ) external returns (uint256 assetsBorrowed, uint256 sharesBorrowed);

    /**
     * @notice 차입 상환
     * @param marketParams 마켓 파라미터
     * @param assets 상환할 자산 수량
     * @param shares 상환할 주식 수량 (assets 또는 shares 중 하나는 0이어야 함)
     * @param onBehalf 대신 상환할 주소
     * @param data 콜백 데이터
     * @return assetsRepaid 실제 상환된 자산 수량
     * @return sharesRepaid 실제 소각된 부채 주식 수량
     */
    function repay(
        MarketParams memory marketParams,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        bytes memory data
    ) external returns (uint256 assetsRepaid, uint256 sharesRepaid);

    /**
     * @notice 마켓 ID 계산
     * @param marketParams 마켓 파라미터
     * @return 마켓 ID
     */
    function id(MarketParams memory marketParams) external pure returns (bytes32);

    /**
     * @notice 마켓 정보 조회
     * @param id 마켓 ID
     * @return 마켓 정보
     */
    function market(bytes32 id) external view returns (Market memory);

    /**
     * @notice 포지션 정보 조회
     * @param id 마켓 ID
     * @param user 사용자 주소
     * @return 포지션 정보
     */
    function position(bytes32 id, address user) external view returns (Position memory);

    /**
     * @notice 이자 누적
     * @param marketParams 마켓 파라미터
     */
    function accrueInterest(MarketParams memory marketParams) external;

    /**
     * @notice 마켓 승인 여부 확인
     * @param id 마켓 ID
     * @return 승인 여부
     */
    function isMarketCreated(bytes32 id) external view returns (bool);

    // 이벤트들
    event Supply(
        bytes32 indexed id,
        address indexed supplier,
        address indexed onBehalf,
        uint256 assets,
        uint256 shares
    );

    event Withdraw(
        bytes32 indexed id,
        address indexed supplier,
        address indexed onBehalf,
        address receiver,
        uint256 assets,
        uint256 shares
    );

    event Borrow(
        bytes32 indexed id,
        address indexed borrower,
        address indexed onBehalf,
        address receiver,
        uint256 assets,
        uint256 shares
    );

    event Repay(
        bytes32 indexed id,
        address indexed repayer,
        address indexed onBehalf,
        uint256 assets,
        uint256 shares
    );

    event SupplyCollateral(
        bytes32 indexed id,
        address indexed supplier,
        address indexed onBehalf,
        uint256 assets
    );

    event WithdrawCollateral(
        bytes32 indexed id,
        address indexed supplier,
        address indexed onBehalf,
        address receiver,
        uint256 assets
    );
}