// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/ILendingProtocol.sol";

/**
 * @title MockLendingProtocol
 * @dev 테스트용 렌딩 프로토콜 모킹 구현체
 */
contract MockLendingProtocol is ILendingProtocol, Ownable {
    using SafeERC20 for IERC20;

    // 예치 잔액 추적 (원금)
    mapping(address => mapping(address => uint256)) public deposits;
    
    // 출금 요청 추적
    struct WithdrawRequest {
        address token;
        address user;
        uint256 amount;
        uint256 requestTime;
        bool claimed;
    }
    
    mapping(uint256 => WithdrawRequest) public withdrawRequests;
    uint256 public nextRequestId = 1;
    
    // 설정값들
    uint256 public withdrawDelay = 7 days; // 7일 출금 대기 기간
    uint256 public annualYieldRate = 500; // 5% (basis points)
    
    // 이벤트들
    event DepositMade(address indexed token, address indexed user, uint256 amount);
    event WithdrawRequested(uint256 indexed requestId, address indexed token, address indexed user, uint256 amount);
    event WithdrawClaimed(uint256 indexed requestId, address indexed token, address indexed user, uint256 amount);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev 출금 대기 기간 설정
     * @param _delay 대기 기간 (초)
     */
    function setWithdrawDelay(uint256 _delay) external onlyOwner {
        withdrawDelay = _delay;
    }

    /**
     * @dev 연간 수익률 설정
     * @param _rate 연간 수익률 (basis points)
     */
    function setAnnualYieldRate(uint256 _rate) external onlyOwner {
        annualYieldRate = _rate;
    }

    /**
     * @inheritdoc ILendingProtocol
     */
    function deposit(address token, uint256 amount) external override returns (bool) {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be greater than 0");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        deposits[token][msg.sender] += amount;

        emit DepositMade(token, msg.sender, amount);
        return true;
    }

    /**
     * @inheritdoc ILendingProtocol
     */
    function withdraw(address token, uint256 amount) external override returns (uint256) {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 currentBalance = this.getBalance(token, msg.sender);
        require(currentBalance >= amount, "Insufficient balance");

        uint256 requestId = nextRequestId++;
        withdrawRequests[requestId] = WithdrawRequest({
            token: token,
            user: msg.sender,
            amount: amount,
            requestTime: block.timestamp,
            claimed: false
        });

        emit WithdrawRequested(requestId, token, msg.sender, amount);
        return requestId;
    }

    /**
     * @inheritdoc ILendingProtocol
     */
    function claim(address token, uint256 requestId) external override returns (bool) {
        WithdrawRequest storage request = withdrawRequests[requestId];
        require(request.user == msg.sender, "Not the requester");
        require(!request.claimed, "Already claimed");
        require(request.token == token, "Token mismatch");
        require(block.timestamp >= request.requestTime + withdrawDelay, "Withdraw delay not met");

        request.claimed = true;
        
        // 예치 잔액에서 차감 (원금만)
        uint256 principal = deposits[token][msg.sender];
        uint256 deductAmount = request.amount;
        
        // 만약 출금 요청량이 현재 잔액보다 크다면, 이자분을 포함해서 차감
        uint256 currentBalance = this.getBalance(token, msg.sender);
        if (request.amount <= currentBalance) {
            // 원금부터 차감
            if (deductAmount <= principal) {
                deposits[token][msg.sender] = principal - deductAmount;
            } else {
                deposits[token][msg.sender] = 0;
            }
        }

        IERC20(token).safeTransfer(msg.sender, request.amount);

        emit WithdrawClaimed(requestId, token, msg.sender, request.amount);
        return true;
    }

    /**
     * @inheritdoc ILendingProtocol
     */
    function getBalance(address token, address account) external view override returns (uint256) {
        uint256 principal = deposits[token][account];
        if (principal == 0) {
            return 0;
        }

        // 간단한 복리 계산 (연간 수익률 기준)
        // 실제로는 더 복잡한 계산이 필요하지만, 테스트용으로 단순화
        uint256 timeElapsed = block.timestamp - _getFirstDepositTime(token, account);
        uint256 annualSeconds = 365 days;
        
        if (timeElapsed >= annualSeconds) {
            // 1년 이상 경과시 복리 적용
            uint256 yearsPassed = timeElapsed / annualSeconds;
            uint256 multiplier = 10000 + annualYieldRate; // basis points
            
            uint256 compoundedAmount = principal;
            for (uint256 i = 0; i < yearsPassed; i++) {
                compoundedAmount = (compoundedAmount * multiplier) / 10000;
            }
            
            // 나머지 기간에 대한 단리 적용
            uint256 remainingTime = timeElapsed % annualSeconds;
            uint256 additionalYield = (compoundedAmount * annualYieldRate * remainingTime) / (10000 * annualSeconds);
            
            return compoundedAmount + additionalYield;
        } else {
            // 1년 미만시 단리 적용
            uint256 yield = (principal * annualYieldRate * timeElapsed) / (10000 * annualSeconds);
            return principal + yield;
        }
    }

    /**
     * @inheritdoc ILendingProtocol
     */
    function getWithdrawStatus(uint256 requestId) external view override returns (bool isReady, uint256 claimableTime) {
        WithdrawRequest memory request = withdrawRequests[requestId];
        claimableTime = request.requestTime + withdrawDelay;
        isReady = !request.claimed && block.timestamp >= claimableTime;
    }

    /**
     * @dev 첫 예치 시간을 가져오는 내부 함수 (단순화를 위해 현재 시간 사용)
     * 실제 구현에서는 첫 예치 시간을 별도로 추적해야 함
     */
    function _getFirstDepositTime(address token, address account) internal view returns (uint256) {
        // 단순화를 위해 현재 시간에서 임의의 시간을 빼서 반환
        // 실제로는 첫 예치 시간을 별도 매핑으로 저장해야 함
        if (deposits[token][account] > 0) {
            return block.timestamp - 30 days; // 30일 전에 예치했다고 가정
        }
        return block.timestamp;
    }

    /**
     * @dev 긴급 상황시 토큰 회수 (owner만 가능)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @dev 특정 사용자의 원금 조회
     */
    function getPrincipal(address token, address account) external view returns (uint256) {
        return deposits[token][account];
    }
}
