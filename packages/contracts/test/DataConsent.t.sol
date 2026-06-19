// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/DataConsent.sol";

contract DataConsentTest is Test {
    DataConsent public consent;
    address user1 = address(0x1);

    function setUp() public {
        consent = new DataConsent();
    }

    function testGrantConsent() public {
        vm.prank(user1);
        bytes32 id = consent.grantConsent("did:hospital:001", keccak256("symptoms+meds"), 0);
        assertTrue(consent.isConsentActive(id));
    }

    function testRevokeConsent() public {
        vm.prank(user1);
        bytes32 id = consent.grantConsent("did:hospital:001", keccak256("all"), 0);
        vm.prank(user1);
        consent.revokeConsent(id);
        assertFalse(consent.isConsentActive(id));
    }

    function testRevokeNotOwner() public {
        vm.prank(user1);
        bytes32 id = consent.grantConsent("did:hospital:001", keccak256("all"), 0);
        vm.prank(address(0x2));
        vm.expectRevert("Consent: not owner");
        consent.revokeConsent(id);
    }

    function testExpiredConsent() public {
        vm.prank(user1);
        bytes32 id = consent.grantConsent("did:hospital:001", keccak256("all"), block.timestamp + 100);
        assertTrue(consent.isConsentActive(id));
        vm.warp(block.timestamp + 200);
        assertFalse(consent.isConsentActive(id));
    }

    function testUserConsentCount() public {
        vm.startPrank(user1);
        consent.grantConsent("did:h1", keccak256("a"), 0);
        consent.grantConsent("did:h2", keccak256("b"), 0);
        consent.grantConsent("did:h3", keccak256("c"), 0);
        vm.stopPrank();
        assertEq(consent.getUserConsentCount(user1), 3);
    }
}
