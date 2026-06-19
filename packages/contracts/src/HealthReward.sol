// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

interface IH2EToken {
    function mint(address to, uint256 amount) external;
}

/// @title HealthReward — Daily check-in reward with streak multiplier
/// @notice Backend signs reward claims, user submits on-chain
contract HealthReward is Ownable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    IH2EToken public immutable h2eToken;
    address public backendSigner;

    // State
    mapping(address => uint256) public lastClaimTime;
    mapping(address => uint16) public streakDays;
    mapping(address => uint256) public totalClaimed;
    mapping(bytes32 => bool) public usedNonces;

    // Config
    uint256 public constant CLAIM_COOLDOWN = 20 hours; // Allow timezone flexibility
    uint256 public constant BASE_DAILY = 10 ether;     // 10 H2E
    uint256 public constant DETAIL_BONUS = 5 ether;    // +5 H2E for detailed entries
    uint256 public constant STREAK_7D_BONUS = 50 ether;
    uint256 public constant STREAK_30D_BONUS = 300 ether;

    // Daily emission cap (anti-abuse)
    uint256 public dailyEmissionCap = 500_000 ether;   // 500K H2E/day max
    uint256 public currentDayEmission;
    uint256 public lastEmissionReset;

    bytes32 private constant CLAIM_TYPEHASH = keccak256(
        "RewardClaim(address user,uint256 amount,uint256 detailScore,bytes32 nonce,uint256 deadline)"
    );

    event RewardClaimed(address indexed user, uint256 amount, uint16 streak, uint256 multiplier);
    event StreakReset(address indexed user, uint16 previousStreak);
    event HealthShieldUsed(address indexed user);

    constructor(
        address _token,
        address _signer,
        address _admin
    ) EIP712("HealthReward", "1") Ownable() {
        h2eToken = IH2EToken(_token);
        backendSigner = _signer;
        lastEmissionReset = block.timestamp;
        transferOwnership(_admin);
    }

    /// @notice Claim daily reward with backend signature
    function claimDaily(
        uint256 amount,
        uint256 detailScore,
        bytes32 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        require(block.timestamp <= deadline, "Reward: expired");
        require(!usedNonces[nonce], "Reward: nonce used");
        require(
            block.timestamp >= lastClaimTime[msg.sender] + CLAIM_COOLDOWN,
            "Reward: cooldown active"
        );

        // Reset daily emission counter
        if (block.timestamp >= lastEmissionReset + 1 days) {
            currentDayEmission = 0;
            lastEmissionReset = block.timestamp;
        }
        require(currentDayEmission + amount <= dailyEmissionCap, "Reward: daily cap reached");

        // Verify backend signature
        bytes32 structHash = keccak256(abi.encode(
            CLAIM_TYPEHASH, msg.sender, amount, detailScore, nonce, deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == backendSigner, "Reward: invalid signature");

        usedNonces[nonce] = true;

        // Update streak
        if (block.timestamp <= lastClaimTime[msg.sender] + 48 hours) {
            streakDays[msg.sender]++;
        } else if (lastClaimTime[msg.sender] > 0) {
            emit StreakReset(msg.sender, streakDays[msg.sender]);
            streakDays[msg.sender] = 1;
        } else {
            streakDays[msg.sender] = 1;
        }

        lastClaimTime[msg.sender] = block.timestamp;

        // Calculate total with multiplier
        uint256 multiplier = getMultiplier(streakDays[msg.sender]);
        uint256 totalReward = (amount * multiplier) / 100;

        // Add streak bonuses
        if (streakDays[msg.sender] == 7) totalReward += STREAK_7D_BONUS;
        if (streakDays[msg.sender] == 30) totalReward += STREAK_30D_BONUS;

        totalClaimed[msg.sender] += totalReward;
        currentDayEmission += totalReward;

        // Mint H2E
        h2eToken.mint(msg.sender, totalReward);
        emit RewardClaimed(msg.sender, totalReward, streakDays[msg.sender], multiplier);
    }

    /// @notice Get streak multiplier (basis points)
    function getMultiplier(uint16 streak) public pure returns (uint256) {
        if (streak >= 90) return 500;  // 5.0x
        if (streak >= 30) return 300;  // 3.0x
        if (streak >= 14) return 200;  // 2.0x
        if (streak >= 7)  return 150;  // 1.5x
        if (streak >= 3)  return 120;  // 1.2x
        return 100;                     // 1.0x
    }

    /// @notice Admin: update backend signer
    function setBackendSigner(address _signer) external onlyOwner {
        backendSigner = _signer;
    }

    /// @notice Admin: update daily emission cap
    function setDailyEmissionCap(uint256 _cap) external onlyOwner {
        dailyEmissionCap = _cap;
    }
}
