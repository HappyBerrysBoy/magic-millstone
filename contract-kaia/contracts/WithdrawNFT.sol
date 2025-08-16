// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract WithdrawNFT is 
    Initializable,
    ERC721Upgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 private _tokenIdCounter;
    
    // Simple mapping: tokenId → amount (VaultContract manages all other logic)
    mapping(uint256 => uint256) public withdrawalAmounts;
    
    // Reference to VaultContract to fetch status for display
    address public vaultContract;

    event WithdrawNFTMinted(
        uint256 indexed tokenId,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    event WithdrawNFTBurned(
        uint256 indexed tokenId,
        address indexed from
    );

    function initialize(
        string memory name,
        string memory symbol,
        address admin,
        address _vaultContract
    ) public initializer {
        __ERC721_init(name, symbol);
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        
        vaultContract = _vaultContract;
        _tokenIdCounter = 1;
    }

    function mint(
        address to,
        uint256 amount
    ) external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256) {
        uint256 tokenId = _tokenIdCounter++;
        
        // Store only the amount - VaultContract handles all business logic
        withdrawalAmounts[tokenId] = amount;

        _safeMint(to, tokenId);
        
        emit WithdrawNFTMinted(tokenId, to, amount, block.timestamp);
        
        return tokenId;
    }

    function burn(uint256 tokenId) external onlyRole(BURNER_ROLE) whenNotPaused {
        address owner = ownerOf(tokenId);
        _burn(tokenId);
        delete withdrawalAmounts[tokenId];
        
        emit WithdrawNFTBurned(tokenId, owner);
    }

    function getWithdrawalAmount(uint256 tokenId) external view returns (uint256) {
        require(_exists(tokenId), "WithdrawNFT: Token does not exist");
        return withdrawalAmounts[tokenId];
    }

    function getCurrentTokenId() external view returns (uint256) {
        return _tokenIdCounter;
    }

    function updateVaultContract(address _newVaultContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newVaultContract != address(0), "WithdrawNFT: Invalid vault address");
        vaultContract = _newVaultContract;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "WithdrawNFT: Token does not exist");
        
        uint256 amount = withdrawalAmounts[tokenId];
        
        // Get status from VaultContract for display
        string memory status = "UNKNOWN";
        uint256 requestTime = 0;
        uint256 readyTime = 0;
        
        try this.getWithdrawRequestFromVault(tokenId) returns (
            uint256, uint256 _requestTime, uint256 _readyTime, uint8 _status, address
        ) {
            status = ["PENDING", "READY"][_status];
            requestTime = _requestTime;
            readyTime = _readyTime;
        } catch {
            status = "PENDING"; // fallback
        }

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "Withdrawal Request #',
                        tokenId.toString(),
                        '", "description": "USDT Withdrawal Request", "status": "',
                        status,
                        '", "amount": "',
                        (amount / 10**6).toString(),
                        '.',
                        ((amount % 10**6) / 10**4).toString(),
                        '", "requestTime": "',
                        requestTime.toString(),
                        '", "readyTime": "',
                        readyTime.toString(),
                        '", "image": "data:image/svg+xml;base64,',
                        _generateSVG(tokenId, amount, status),
                        '"}'
                    )
                )
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    // Helper function to get withdraw request from vault (external call)
    function getWithdrawRequestFromVault(uint256 tokenId) external view returns (
        uint256 amount,
        uint256 requestTime,
        uint256 readyTime,
        uint8 status,
        address requester
    ) {
        // Make external call to VaultContract to get status
        (bool success, bytes memory data) = vaultContract.staticcall(
            abi.encodeWithSignature("getWithdrawRequest(uint256)", tokenId)
        );
        
        if (success) {
            (amount, requestTime, readyTime, status, requester) = abi.decode(
                data, (uint256, uint256, uint256, uint8, address)
            );
        } else {
            // Fallback values
            amount = withdrawalAmounts[tokenId];
            requestTime = 0;
            readyTime = 0;
            status = 0; // PENDING
            requester = address(0);
        }
    }

    function _generateSVG(uint256 tokenId, uint256 amount, string memory status) internal pure returns (string memory) {
        // Determine status color
        string memory statusColor = "#ffaa00"; // PENDING - orange
        if (keccak256(bytes(status)) == keccak256(bytes("READY"))) {
            statusColor = "#00ff00"; // READY - green
        } else if (keccak256(bytes(status)) == keccak256(bytes("CLAIMED"))) {
            statusColor = "#888888"; // CLAIMED - gray
        }

        string memory svg = string(
            abi.encodePacked(
                '<svg width="300" height="220" xmlns="http://www.w3.org/2000/svg">',
                '<rect width="300" height="220" fill="#1e1e1e"/>',
                '<text x="150" y="40" font-family="Arial" font-size="16" fill="white" text-anchor="middle">Withdrawal Request</text>',
                '<text x="150" y="65" font-family="Arial" font-size="12" fill="#888" text-anchor="middle">NFT #',
                tokenId.toString(),
                '</text>',
                '<text x="150" y="100" font-family="Arial" font-size="20" fill="white" text-anchor="middle">',
                (amount / 10**6).toString(),
                '.',
                ((amount % 10**6) / 10**4).toString(),
                ' USDT</text>',
                '<text x="150" y="135" font-family="Arial" font-size="14" fill="',
                statusColor,
                '" text-anchor="middle">Status: ',
                status,
                '</text>',
                '<text x="150" y="190" font-family="Arial" font-size="10" fill="#555" text-anchor="middle">Magic Millstone Protocol</text>',
                '</svg>'
            )
        );
        
        return Base64.encode(bytes(svg));
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        whenNotPaused
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return interfaceId == 0x80ac58cd || // KIP-17 interface ID  
               super.supportsInterface(interfaceId);
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    uint256[48] private __gap;
}