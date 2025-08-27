// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title EIP1967Proxy
 * @dev EIP1967 표준을 따르는 간단한 프록시 컨트랙트
 */
contract EIP1967Proxy is ERC1967Proxy {
    constructor(address implementation, bytes memory data) ERC1967Proxy(implementation, data) {}
}
