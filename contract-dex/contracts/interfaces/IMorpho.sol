// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IMorpho
 * @notice Morpho 프로토콜과 연동하기 위한 인터페이스
 * @dev Morpho Blue/Morpho AaveV3 optimizer의 핵심 함수들을 정의
 */
interface IMorpho {
    /**
     * @notice 토큰을 Morpho에 공급
     * @param underlying 기본 토큰 주소
     * @param amount 공급할 수량
     * @param onBehalfOf 공급 대상 주소
     * @param maxIterations 최대 반복 횟수 (가스 최적화)
     * @return 실제 공급된 수량
     */
    function supply(
        address underlying,
        uint256 amount,
        address onBehalfOf,
        uint256 maxIterations
    ) external returns (uint256);

    /**
     * @notice Morpho에서 토큰 출금
     * @param underlying 기본 토큰 주소
     * @param amount 출금할 수량 (0이면 전체 출금)
     * @param receiver 토큰을 받을 주소
     * @param maxIterations 최대 반복 횟수 (가스 최적화)
     * @return 실제 출금된 수량
     */
    function withdraw(
        address underlying,
        uint256 amount,
        address receiver,
        uint256 maxIterations
    ) external returns (uint256);

    /**
     * @notice 사용자의 공급 잔액 조회
     * @param underlying 기본 토큰 주소
     * @param user 사용자 주소
     * @return 공급된 토큰 잔액 (이자 포함)
     */
    function supplyBalanceInOf(address underlying, address user) external view returns (uint256);

    /**
     * @notice 사용자의 차입 잔액 조회
     * @param underlying 기본 토큰 주소
     * @param user 사용자 주소
     * @return 차입된 토큰 잔액 (이자 포함)
     */
    function borrowBalanceInOf(address underlying, address user) external view returns (uint256);

    /**
     * @notice 현재 공급 이율 조회
     * @param underlying 기본 토큰 주소
     * @return 연간 공급 이율 (ray 단위, 1e27 = 100%)
     */
    function supplyRatePerYear(address underlying) external view returns (uint256);

    /**
     * @notice 현재 차입 이율 조회
     * @param underlying 기본 토큰 주소
     * @return 연간 차입 이율 (ray 단위, 1e27 = 100%)
     */
    function borrowRatePerYear(address underlying) external view returns (uint256);
}

/**
 * @title IMorphoToken
 * @notice Morpho의 토큰 인터페이스 (mToken 등)
 */
interface IMorphoToken {
    /**
     * @notice 사용자의 토큰 잔액 조회
     * @param user 사용자 주소
     * @return 토큰 잔액
     */
    function balanceOf(address user) external view returns (uint256);

    /**
     * @notice 기본 자산 주소 조회
     * @return 기본 자산의 토큰 주소
     */
    function underlying() external view returns (address);

    /**
     * @notice 총 공급량 조회
     * @return 총 공급량
     */
    function totalSupply() external view returns (uint256);
}

/**
 * @title IMorphoLens
 * @notice Morpho Lens 컨트랙트 인터페이스 (읽기 전용 헬퍼)
 */
interface IMorphoLens {
    /**
     * @notice 사용자의 현재 공급 잔액 조회 (정확한 계산)
     * @param morpho Morpho 컨트랙트 주소
     * @param underlying 기본 토큰 주소
     * @param user 사용자 주소
     * @return 현재 공급 잔액
     */
    function getCurrentSupplyBalanceInOf(
        address morpho,
        address underlying,
        address user
    ) external view returns (uint256);

    /**
     * @notice 사용자의 현재 차입 잔액 조회 (정확한 계산)
     * @param morpho Morpho 컨트랙트 주소
     * @param underlying 기본 토큰 주소
     * @param user 사용자 주소
     * @return 현재 차입 잔액
     */
    function getCurrentBorrowBalanceInOf(
        address morpho,
        address underlying,
        address user
    ) external view returns (uint256);
}
