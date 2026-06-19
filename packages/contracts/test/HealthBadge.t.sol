// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/HealthBadge.sol";

contract HealthBadgeTest is Test {
    HealthBadge public badge;
    address admin = address(0xA);
    address minter = address(0xB);
    address user1 = address(0x1);
    address user2 = address(0x2);

    function setUp() public {
        vm.prank(admin);
        badge = new HealthBadge(admin);
        vm.prank(admin);
        badge.grantRole(badge.MINTER_ROLE(), minter);
    }

    function testMintBadge() public {
        vm.prank(minter);
        uint256 id = badge.mintBadge(user1, HealthBadge.BadgeType.FIRST_ENTRY, "ipfs://first");
        assertEq(badge.ownerOf(id), user1);
        assertTrue(badge.hasBadge(user1, HealthBadge.BadgeType.FIRST_ENTRY));
    }

    function testSoulbound() public {
        vm.prank(minter);
        uint256 id = badge.mintBadge(user1, HealthBadge.BadgeType.STREAK_7, "ipfs://streak7");
        vm.prank(user1);
        vm.expectRevert("Badge: soulbound, non-transferable");
        badge.transferFrom(user1, user2, id);
    }

    function testDuplicateBadge() public {
        vm.prank(minter);
        badge.mintBadge(user1, HealthBadge.BadgeType.STREAK_7, "ipfs://s7");
        vm.prank(minter);
        vm.expectRevert("Badge: already owned");
        badge.mintBadge(user1, HealthBadge.BadgeType.STREAK_7, "ipfs://s7dup");
    }

    function testMultipleBadgeTypes() public {
        vm.startPrank(minter);
        badge.mintBadge(user1, HealthBadge.BadgeType.FIRST_ENTRY, "ipfs://1");
        badge.mintBadge(user1, HealthBadge.BadgeType.STREAK_7, "ipfs://2");
        badge.mintBadge(user1, HealthBadge.BadgeType.STREAK_30, "ipfs://3");
        vm.stopPrank();

        assertTrue(badge.hasBadge(user1, HealthBadge.BadgeType.FIRST_ENTRY));
        assertTrue(badge.hasBadge(user1, HealthBadge.BadgeType.STREAK_7));
        assertTrue(badge.hasBadge(user1, HealthBadge.BadgeType.STREAK_30));
        assertFalse(badge.hasBadge(user1, HealthBadge.BadgeType.HEALTH_ORACLE));
    }
}
