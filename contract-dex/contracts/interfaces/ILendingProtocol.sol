// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ILendingProtocol
 * @dev 렌딩 프로토콜과의 상호작용을 위한 인터페이스
 */
interface ILendingProtocol {
    /**
     * @dev 토큰을 렌딩 프로토콜에 예치
     * @param token 예치할 토큰 주소
     * @param amount 예치할 수량
     * @return 예치 성공 여부
     */
    function deposit(address token, uint256 amount) external returns (bool);

    /**
     * @dev 렌딩 프로토콜에서 토큰 출금 요청
     * @param token 출금할 토큰 주소
     * @param amount 출금할 수량
     * @return 출금 요청 ID
     */
    function withdraw(address token, uint256 amount) external returns (uint256);

    /**
     * @dev 출금 대기 기간 이후 실제 토큰 claim
     * @param token 클레임할 토큰 주소
     * @param requestId 출금 요청 ID
     * @return 클레임 성공 여부
     */
    function claim(address token, uint256 requestId) external returns (bool);

    /**
     * @dev 특정 토큰의 현재 예치된 잔액 조회 (원금 + 이자)
     * @param token 조회할 토큰 주소
     * @param account 계정 주소
     * @return 현재 잔액 (원금 + 이자)
     */
    function getBalance(address token, address account) external view returns (uint256);

    /**
     * @dev 출금 요청의 상태 및 클레임 가능 시간 조회
     * @param requestId 출금 요청 ID
     * @return isReady 클레임 가능 여부
     * @return claimableTime 클레임 가능 시간
     */
    function getWithdrawStatus(uint256 requestId) external view returns (bool isReady, uint256 claimableTime);
}
