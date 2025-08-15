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
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    enum WithdrawStatus { PENDING, READY, CLAIMED }

    struct WithdrawRequest {
        uint256 amount;
        uint256 requestTime;
        uint256 readyTime;
        WithdrawStatus status;
        address requester;
    }

    uint256 private _tokenIdCounter;
    mapping(uint256 => WithdrawRequest) public withdrawRequests;

    event WithdrawNFTMinted(
        uint256 indexed tokenId,
        address indexed to,
        uint256 amount,
        uint256 requestTime
    );

    event WithdrawStatusUpdated(
        uint256 indexed tokenId,
        WithdrawStatus oldStatus,
        WithdrawStatus newStatus,
        uint256 readyTime
    );

    event WithdrawNFTBurned(
        uint256 indexed tokenId,
        address indexed from
    );

    function initialize(
        string memory name,
        string memory symbol,
        address admin
    ) public initializer {
        __ERC721_init(name, symbol);
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        
        _tokenIdCounter = 1;
    }

    function mint(
        address to,
        uint256 amount
    ) external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256) {
        uint256 tokenId = _tokenIdCounter++;
        
        withdrawRequests[tokenId] = WithdrawRequest({
            amount: amount,
            requestTime: block.timestamp,
            readyTime: 0,
            status: WithdrawStatus.PENDING,
            requester: to
        });

        _safeMint(to, tokenId);
        
        emit WithdrawNFTMinted(tokenId, to, amount, block.timestamp);
        
        return tokenId;
    }

    function burn(uint256 tokenId) external onlyRole(BURNER_ROLE) whenNotPaused {
        address owner = ownerOf(tokenId);
        _burn(tokenId);
        delete withdrawRequests[tokenId];
        
        emit WithdrawNFTBurned(tokenId, owner);
    }

    function markWithdrawReady(uint256[] calldata tokenIds) 
        external 
        onlyRole(MANAGER_ROLE) 
        whenNotPaused 
    {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            require(_exists(tokenId), "WithdrawNFT: Token does not exist");
            
            WithdrawRequest storage request = withdrawRequests[tokenId];
            require(request.status == WithdrawStatus.PENDING, "WithdrawNFT: Invalid status");
            
            WithdrawStatus oldStatus = request.status;
            request.status = WithdrawStatus.READY;
            request.readyTime = block.timestamp;
            
            emit WithdrawStatusUpdated(tokenId, oldStatus, WithdrawStatus.READY, block.timestamp);
        }
    }

    function markWithdrawClaimed(uint256 tokenId) 
        external 
        onlyRole(MANAGER_ROLE) 
        whenNotPaused 
    {
        require(_exists(tokenId), "WithdrawNFT: Token does not exist");
        
        WithdrawRequest storage request = withdrawRequests[tokenId];
        require(request.status == WithdrawStatus.READY, "WithdrawNFT: Invalid status");
        
        WithdrawStatus oldStatus = request.status;
        request.status = WithdrawStatus.CLAIMED;
        
        emit WithdrawStatusUpdated(tokenId, oldStatus, WithdrawStatus.CLAIMED, request.readyTime);
    }

    function getWithdrawRequest(uint256 tokenId) 
        external 
        view 
        returns (WithdrawRequest memory) 
    {
        require(_exists(tokenId), "WithdrawNFT: Token does not exist");
        return withdrawRequests[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "WithdrawNFT: Token does not exist");
        
        WithdrawRequest memory request = withdrawRequests[tokenId];
        
        string memory statusString;
        if (request.status == WithdrawStatus.PENDING) {
            statusString = "PENDING";
        } else if (request.status == WithdrawStatus.READY) {
            statusString = "READY";
        } else {
            statusString = "CLAIMED";
        }

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "Withdraw Request #',
                        tokenId.toString(),
                        '", "description": "USDT Withdraw Request", "status": "',
                        statusString,
                        '", "amount": "',
                        (request.amount / 10**6).toString(),
                        '.', 
                        ((request.amount % 10**6) / 10**4).toString(),
                        '", "requestTime": "',
                        request.requestTime.toString(),
                        '", "readyTime": "',
                        request.readyTime.toString(),
                        '"}'
                    )
                )
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", json));
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

    uint256[47] private __gap;
}