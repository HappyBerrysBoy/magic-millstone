// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IAavePool
 * @notice AAVE Pool 인터페이스 - 실제 AAVE 서비스와 연동하기 위한 인터페이스
 */
interface IAavePool {
    /**
     * @notice 토큰을 AAVE Pool에 공급합니다
     * @param asset 공급할 자산의 주소
     * @param amount 공급할 금액
     * @param onBehalfOf 누구를 대신해서 공급하는지 (보통 msg.sender)
     * @param referralCode 추천 코드 (보통 0)
     */
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    /**
     * @notice AAVE Pool에서 토큰을 출금합니다
     * @param asset 출금할 자산의 주소
     * @param amount 출금할 금액 (type(uint256).max면 전체 출금)
     * @param to 출금받을 주소
     * @return 실제 출금된 금액
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);

    /**
     * @notice 사용자의 계정 정보를 조회합니다
     * @param user 조회할 사용자 주소
     * @return totalCollateralBase 총 담보 (기본 화폐 단위)
     * @return totalDebtBase 총 부채 (기본 화폐 단위)
     * @return availableBorrowsBase 대출 가능 금액 (기본 화폐 단위)
     * @return currentLiquidationThreshold 현재 청산 임계값
     * @return ltv 담보비율
     * @return healthFactor 건강도
     */
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );

    /**
     * @notice aToken 주소를 반환합니다
     * @param asset 기본 자산 주소
     * @return configuration 설정 정보
     * @return liquidityIndex 유동성 인덱스
     * @return currentLiquidityRate 현재 유동성 비율
     * @return variableBorrowIndex 변동 대출 인덱스
     * @return currentVariableBorrowRate 현재 변동 대출 비율
     * @return currentStableBorrowRate 현재 고정 대출 비율
     * @return lastUpdateTimestamp 마지막 업데이트 시간
     * @return id 리저브 ID
     * @return aTokenAddress aToken 주소
     * @return stableDebtTokenAddress 고정 부채 토큰 주소
     * @return variableDebtTokenAddress 변동 부채 토큰 주소
     * @return interestRateStrategyAddress 이자율 전략 주소
     * @return accruedToTreasury 재무부 누적분
     * @return unbacked 무담보 금액
     * @return isolationModeTotalDebt 격리 모드 총 부채
     */
    function getReserveData(address asset)
        external
        view
        returns (
            uint256 configuration,
            uint128 liquidityIndex,
            uint128 currentLiquidityRate,
            uint128 variableBorrowIndex,
            uint128 currentVariableBorrowRate,
            uint128 currentStableBorrowRate,
            uint40 lastUpdateTimestamp,
            uint16 id,
            address aTokenAddress,
            address stableDebtTokenAddress,
            address variableDebtTokenAddress,
            address interestRateStrategyAddress,
            uint128 accruedToTreasury,
            uint128 unbacked,
            uint128 isolationModeTotalDebt
        );
}

/**
 * @title IAToken
 * @notice AAVE aToken 인터페이스 - aToken 잔액 조회용
 */
interface IAToken {
    /**
     * @notice aToken 잔액을 조회합니다
     * @param user 사용자 주소
     * @return 잔액
     */
    function balanceOf(address user) external view returns (uint256);

    /**
     * @notice aToken의 기본 자산 주소를 반환합니다
     * @return 기본 자산 주소
     */
    function UNDERLYING_ASSET_ADDRESS() external view returns (address);
}
