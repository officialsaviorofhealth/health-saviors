// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/H2EToken.sol";

contract H2ETokenTest is Test {
    H2EToken public token;
    address admin = address(0xA);
    address minter = address(0xB);
    address user1 = address(0x1);
    address user2 = address(0x2);

    function setUp() public {
        vm.prank(admin);
        token = new H2EToken(admin);
        vm.prank(admin);
        token.grantRole(token.MINTER_ROLE(), minter);
    }

    function testMetadata() public view {
        assertEq(token.name(), "Health2Earn");
        assertEq(token.symbol(), "H2E");
        assertEq(token.MAX_SUPPLY(), 1_000_000_000 * 1e18);
    }

    function testMint() public {
        vm.prank(minter);
        token.mint(user1, 100 ether);
        assertEq(token.balanceOf(user1), 100 ether);
        assertEq(token.totalMinted(), 100 ether);
    }

    function testMintRevertUnauthorized() public {
        vm.prank(user1);
        vm.expectRevert();
        token.mint(user1, 100 ether);
    }

    function testMintRevertMaxSupply() public {
        vm.prank(minter);
        vm.expectRevert("H2E: exceeds max supply");
        token.mint(user1, 1_000_000_001 * 1e18);
    }

    function testBurnWithReason() public {
        vm.prank(minter);
        token.mint(user1, 100 ether);
        vm.prank(user1);
        token.burnWithReason(50 ether, "health_shield");
        assertEq(token.balanceOf(user1), 50 ether);
        assertEq(token.totalBurned(), 50 ether);
    }

    function testPause() public {
        vm.prank(admin);
        token.pause();
        vm.prank(minter);
        vm.expectRevert("Pausable: paused");
        token.mint(user1, 100 ether);
    }

    function testUnpause() public {
        vm.prank(admin);
        token.pause();
        vm.prank(admin);
        token.unpause();
        vm.prank(minter);
        token.mint(user1, 100 ether);
        assertEq(token.balanceOf(user1), 100 ether);
    }

    function testTransfer() public {
        vm.prank(minter);
        token.mint(user1, 100 ether);
        vm.prank(user1);
        token.transfer(user2, 30 ether);
        assertEq(token.balanceOf(user1), 70 ether);
        assertEq(token.balanceOf(user2), 30 ether);
    }

    // Fuzz test: mint amount never exceeds max supply
    function testFuzzMintCapped(uint256 amount) public {
        amount = bound(amount, 1, token.MAX_SUPPLY());
        vm.prank(minter);
        token.mint(user1, amount);
        assertLe(token.totalSupply(), token.MAX_SUPPLY());
    }
}
