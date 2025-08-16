// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract mmUSDT is 
    Initializable, 
    ERC20Upgradeable, 
    AccessControlUpgradeable, 
    PausableUpgradeable, 
    UUPSUpgradeable 
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint8 private _decimals;

    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);

    function initialize(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        address admin
    ) public initializer {
        __ERC20_init(name, symbol);
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _decimals = decimals_;
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused 
    {
        _mint(to, amount);
        emit Mint(to, amount);
    }

    function burn(address from, uint256 amount) 
        external 
        onlyRole(BURNER_ROLE) 
        whenNotPaused 
    {
        _burn(from, amount);
        emit Burn(from, amount);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override whenNotPaused {
        super._update(from, to, value);
    }

    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyRole(UPGRADER_ROLE) 
    {}

    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        virtual 
        override(AccessControlUpgradeable) 
        returns (bool) 
    {
        return interfaceId == 0x65787371 || // KIP-7 interface ID
               super.supportsInterface(interfaceId);
    }

    uint256[49] private __gap;
}