// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title DataConsent — On-chain consent management
/// @notice Records data access permissions on-chain for audit trail
/// @dev Hospital integration ready: grantee can be hospital DID
contract DataConsent is Ownable {

    struct Consent {
        address user;
        string granteeDid;      // Hospital DID or researcher address
        bytes32 scopeHash;       // Hash of consent scope
        uint256 grantedAt;
        uint256 revokedAt;       // 0 = active
        uint256 expiresAt;       // 0 = no expiry
    }

    mapping(bytes32 => Consent) public consents;          // consentId => Consent
    mapping(address => bytes32[]) public userConsents;    // user => consentIds

    event ConsentGranted(
        bytes32 indexed consentId, address indexed user,
        string granteeDid, bytes32 scopeHash, uint256 expiresAt
    );
    event ConsentRevoked(bytes32 indexed consentId, address indexed user, uint256 revokedAt);

    /// @notice Grant data access consent
    function grantConsent(
        string calldata granteeDid,
        bytes32 scopeHash,
        uint256 expiresAt
    ) external returns (bytes32 consentId) {
        consentId = keccak256(abi.encodePacked(msg.sender, granteeDid, scopeHash, block.timestamp));

        consents[consentId] = Consent({
            user: msg.sender,
            granteeDid: granteeDid,
            scopeHash: scopeHash,
            grantedAt: block.timestamp,
            revokedAt: 0,
            expiresAt: expiresAt
        });

        userConsents[msg.sender].push(consentId);
        emit ConsentGranted(consentId, msg.sender, granteeDid, scopeHash, expiresAt);
    }

    /// @notice Revoke consent
    function revokeConsent(bytes32 consentId) external {
        require(consents[consentId].user == msg.sender, "Consent: not owner");
        require(consents[consentId].revokedAt == 0, "Consent: already revoked");

        consents[consentId].revokedAt = block.timestamp;
        emit ConsentRevoked(consentId, msg.sender, block.timestamp);
    }

    /// @notice Check if consent is active
    function isConsentActive(bytes32 consentId) external view returns (bool) {
        Consent memory c = consents[consentId];
        if (c.revokedAt != 0) return false;
        if (c.expiresAt != 0 && block.timestamp > c.expiresAt) return false;
        return c.grantedAt != 0;
    }

    /// @notice Get user's consent count
    function getUserConsentCount(address user) external view returns (uint256) {
        return userConsents[user].length;
    }
}
