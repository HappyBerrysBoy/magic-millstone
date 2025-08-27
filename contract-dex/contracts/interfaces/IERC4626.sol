// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IERC4626
 * @dev ERC-4626 Tokenized Vault Standard 인터페이스
 * Steakhouse USDT vault와 같은 Morpho vault와 상호작용하기 위함
 */
interface IERC4626 is IERC20 {
    /**
     * @dev 이벤트들
     */
    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed sender,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    /**
     * @notice 기본 자산 토큰 주소 반환
     * @return 기본 자산 토큰의 주소
     */
    function asset() external view returns (address);

    /**
     * @notice assets를 shares로 변환
     * @param assets 자산 수량
     * @return shares 주식 수량
     */
    function convertToShares(uint256 assets) external view returns (uint256 shares);

    /**
     * @notice shares를 assets로 변환
     * @param shares 주식 수량
     * @return assets 자산 수량
     */
    function convertToAssets(uint256 shares) external view returns (uint256 assets);

    /**
     * @notice 최대 예치 가능한 자산 수량
     * @param receiver 수신자 주소
     * @return maxAssets 최대 자산 수량
     */
    function maxDeposit(address receiver) external view returns (uint256 maxAssets);

    /**
     * @notice 예치 시 받을 수 있는 주식 수량 미리보기
     * @param assets 예치할 자산 수량
     * @return shares 받을 주식 수량
     */
    function previewDeposit(uint256 assets) external view returns (uint256 shares);

    /**
     * @notice 자산을 예치하고 주식을 받음
     * @param assets 예치할 자산 수량
     * @param receiver 주식을 받을 주소
     * @return shares 실제 받은 주식 수량
     */
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);

    /**
     * @notice 최대 민트 가능한 주식 수량
     * @param receiver 수신자 주소
     * @return maxShares 최대 주식 수량
     */
    function maxMint(address receiver) external view returns (uint256 maxShares);

    /**
     * @notice 민트 시 필요한 자산 수량 미리보기
     * @param shares 민트할 주식 수량
     * @return assets 필요한 자산 수량
     */
    function previewMint(uint256 shares) external view returns (uint256 assets);

    /**
     * @notice 정확한 주식 수량을 민트
     * @param shares 민트할 주식 수량
     * @param receiver 주식을 받을 주소
     * @return assets 실제 사용된 자산 수량
     */
    function mint(uint256 shares, address receiver) external returns (uint256 assets);

    /**
     * @notice 최대 출금 가능한 자산 수량
     * @param owner 소유자 주소
     * @return maxAssets 최대 자산 수량
     */
    function maxWithdraw(address owner) external view returns (uint256 maxAssets);

    /**
     * @notice 출금 시 소각될 주식 수량 미리보기
     * @param assets 출금할 자산 수량
     * @return shares 소각될 주식 수량
     */
    function previewWithdraw(uint256 assets) external view returns (uint256 shares);

    /**
     * @notice 정확한 자산 수량을 출금
     * @param assets 출금할 자산 수량
     * @param receiver 자산을 받을 주소
     * @param owner 주식 소유자 주소
     * @return shares 실제 소각된 주식 수량
     */
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);

    /**
     * @notice 최대 리딤 가능한 주식 수량
     * @param owner 소유자 주소
     * @return maxShares 최대 주식 수량
     */
    function maxRedeem(address owner) external view returns (uint256 maxShares);

    /**
     * @notice 리딤 시 받을 수 있는 자산 수량 미리보기
     * @param shares 리딤할 주식 수량
     * @return assets 받을 자산 수량
     */
    function previewRedeem(uint256 shares) external view returns (uint256 assets);

    /**
     * @notice 주식을 리딤하여 자산 받기
     * @param shares 리딤할 주식 수량
     * @param receiver 자산을 받을 주소
     * @param owner 주식 소유자 주소
     * @return assets 실제 받은 자산 수량
     */
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);

    /**
     * @notice vault의 총 관리 자산
     * @return totalAssets 총 자산 수량
     */
    function totalAssets() external view returns (uint256 totalAssets);
}