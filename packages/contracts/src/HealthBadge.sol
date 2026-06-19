// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/// @title HealthBadge — Soulbound Achievement Badges (SBT)
/// @notice Non-transferable on-chain achievement tokens
contract HealthBadge is ERC721, ERC721URIStorage, AccessControl {
    using Counters for Counters.Counter;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    Counters.Counter private _tokenIdCounter;

    // Badge types
    enum BadgeType {
        STREAK_7,       // 7-day streak
        STREAK_30,      // 30-day streak
        STREAK_90,      // 90-day streak
        FIRST_ENTRY,    // First health entry
        QUIZ_MASTER,    // 50 quizzes completed
        DATA_CONTRIBUTOR, // Research data contributor
        HEALTH_ORACLE   // Level 5 reached
    }

    mapping(uint256 => BadgeType) public tokenBadgeType;
    mapping(address => mapping(BadgeType => bool)) public hasBadge;

    event BadgeMinted(address indexed to, uint256 tokenId, BadgeType badgeType);

    constructor(address admin) ERC721("HealthBadge", "HBADGE") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Mint SBT badge
    function mintBadge(
        address to,
        BadgeType badgeType,
        string calldata uri
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(!hasBadge[to][badgeType], "Badge: already owned");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        tokenBadgeType[tokenId] = badgeType;
        hasBadge[to][badgeType] = true;

        emit BadgeMinted(to, tokenId, badgeType);
        return tokenId;
    }

    /// @notice SOULBOUND: Block all transfers (non-transferable)
    function _beforeTokenTransfer(
        address from, address to, uint256 tokenId, uint256 batchSize
    ) internal override {
        require(from == address(0) || to == address(0), "Badge: soulbound, non-transferable");
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    // Required overrides
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) { super._burn(tokenId); }
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
