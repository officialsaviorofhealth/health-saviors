// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/H2EToken.sol";
import "../src/HealthReward.sol";

contract HealthRewardTest is Test {
    H2EToken public token;
    HealthReward public reward;

    address admin = address(0xA);
    uint256 signerPk = 0xBEEF;
    address signer;
    address user1 = address(0x1);

    function setUp() public {
        signer = vm.addr(signerPk);
        vm.startPrank(admin);
        token = new H2EToken(admin);
        reward = new HealthReward(address(token), signer, admin);
        token.grantRole(token.MINTER_ROLE(), address(reward));
        vm.stopPrank();
    }

    function _signClaim(
        address user, uint256 amount, uint256 detailScore,
        bytes32 nonce, uint256 deadline
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            keccak256("RewardClaim(address user,uint256 amount,uint256 detailScore,bytes32 nonce,uint256 deadline)"),
            user, amount, detailScore, nonce, deadline
        ));
        bytes32 domainSeparator = reward.DOMAIN_SEPARATOR();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function testClaimDaily() public {
        uint256 amount = 10 ether;
        bytes32 nonce = keccak256("nonce1");
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signClaim(user1, amount, 5, nonce, deadline);

        vm.prank(user1);
        reward.claimDaily(amount, 5, nonce, deadline, sig);

        assertGt(token.balanceOf(user1), 0);
        assertEq(reward.streakDays(user1), 1);
    }

    function testClaimCooldown() public {
        bytes32 n1 = keccak256("n1");
        bytes32 n2 = keccak256("n2");
        uint256 deadline = block.timestamp + 2 days;

        vm.prank(user1);
        reward.claimDaily(10 ether, 5, n1, deadline, _signClaim(user1, 10 ether, 5, n1, deadline));

        vm.prank(user1);
        vm.expectRevert("Reward: cooldown active");
        reward.claimDaily(10 ether, 5, n2, deadline, _signClaim(user1, 10 ether, 5, n2, deadline));
    }

    function testStreakMultiplier() public {
        assertEq(reward.getMultiplier(0), 100);
        assertEq(reward.getMultiplier(3), 120);
        assertEq(reward.getMultiplier(7), 150);
        assertEq(reward.getMultiplier(14), 200);
        assertEq(reward.getMultiplier(30), 300);
        assertEq(reward.getMultiplier(90), 500);
    }

    function testStreakBuilds() public {
        for (uint256 i = 0; i < 5; i++) {
            bytes32 nonce = keccak256(abi.encodePacked("nonce", i));
            uint256 deadline = block.timestamp + 1 hours;
            bytes memory sig = _signClaim(user1, 10 ether, 5, nonce, deadline);
            vm.prank(user1);
            reward.claimDaily(10 ether, 5, nonce, deadline, sig);
            vm.warp(block.timestamp + 24 hours);
        }
        assertEq(reward.streakDays(user1), 5);
    }

    function testStreakResets() public {
        bytes32 n1 = keccak256("n1");
        uint256 dl = block.timestamp + 1 hours;
        vm.prank(user1);
        reward.claimDaily(10 ether, 5, n1, dl, _signClaim(user1, 10 ether, 5, n1, dl));

        vm.warp(block.timestamp + 72 hours); // 3 days gap

        bytes32 n2 = keccak256("n2");
        dl = block.timestamp + 1 hours;
        vm.prank(user1);
        reward.claimDaily(10 ether, 5, n2, dl, _signClaim(user1, 10 ether, 5, n2, dl));

        assertEq(reward.streakDays(user1), 1); // Reset to 1
    }

    function testExpiredSignature() public {
        bytes32 nonce = keccak256("expired");
        uint256 deadline = block.timestamp - 1; // Past
        bytes memory sig = _signClaim(user1, 10 ether, 5, nonce, deadline);
        vm.prank(user1);
        vm.expectRevert("Reward: expired");
        reward.claimDaily(10 ether, 5, nonce, deadline, sig);
    }

    function testNonceReplay() public {
        bytes32 nonce = keccak256("replay");
        uint256 dl = block.timestamp + 1 hours;
        bytes memory sig = _signClaim(user1, 10 ether, 5, nonce, dl);
        vm.prank(user1);
        reward.claimDaily(10 ether, 5, nonce, dl, sig);

        vm.warp(block.timestamp + 24 hours);
        vm.prank(user1);
        vm.expectRevert("Reward: nonce used");
        reward.claimDaily(10 ether, 5, nonce, dl, sig);
    }

    function testDailyEmissionCap() public {
        vm.prank(admin);
        reward.setDailyEmissionCap(100 ether); // Low cap for test

        bytes32 n1 = keccak256("cap1");
        uint256 dl = block.timestamp + 1 hours;
        vm.prank(user1);
        reward.claimDaily(90 ether, 5, n1, dl, _signClaim(user1, 90 ether, 5, n1, dl));

        vm.warp(block.timestamp + 21 hours);
        bytes32 n2 = keccak256("cap2");
        dl = block.timestamp + 1 hours;
        vm.prank(user1);
        vm.expectRevert("Reward: daily cap reached");
        reward.claimDaily(90 ether, 5, n2, dl, _signClaim(user1, 90 ether, 5, n2, dl));
    }
}
