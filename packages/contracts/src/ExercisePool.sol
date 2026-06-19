// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title ExercisePool — STEPN-style daily exercise staking pool
/// @notice Users stake tokens into a daily pool. Complete 30min exercise to share rewards.
///         Users who fail to complete lose their stake to completers.
/// @dev Exercise pool — stake tokens each day and share rewards by completing 30 minutes of exercise.
///      Users who fail to complete lose their staked tokens, which are shared among the completers.
contract ExercisePool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── State Variables ──

    IERC20 public stakeToken; // USDT or H2E token (stake token)

    uint256 public constant STAKE_AMOUNT = 100 * 1e18;        // 100 tokens per entry (entry fee)
    uint256 public constant EXERCISE_DURATION = 30 minutes;   // Required exercise time
    uint256 public constant POOL_DURATION = 24 hours;         // Pool duration
    uint256 public constant MIN_PARTICIPANTS = 2;              // Minimum participants to start

    struct Pool {
        uint256 poolId;
        uint256 startTime;
        uint256 endTime;
        uint256 totalStaked;
        uint256 participantCount;
        uint256 completedCount;
        bool settled;
        address[] participantList;
    }

    struct Participant {
        bool staked;
        bool completed;
        uint256 stakedAt;
        uint256 completedAt;
        bool claimed;
    }

    // Pool ID => Pool data
    uint256 public currentPoolId;
    mapping(uint256 => Pool) private _pools;
    mapping(uint256 => mapping(address => Participant)) public participants;

    // Platform fee: 5% of loser stakes
    uint256 public platformFeePercent = 5;
    address public feeCollector;
    uint256 public totalFeesCollected;

    // Oracle/verifier for exercise completion
    address public verifier;

    // Pool reward tracking
    mapping(uint256 => uint256) public poolRewardPerCompleter;

    // Emergency pause
    bool public paused;

    // ── Events ──

    event PoolCreated(uint256 indexed poolId, uint256 startTime, uint256 endTime);
    event Staked(uint256 indexed poolId, address indexed user, uint256 amount);
    event ExerciseCompleted(uint256 indexed poolId, address indexed user, uint256 completedAt);
    event RewardClaimed(uint256 indexed poolId, address indexed user, uint256 reward);
    event PoolSettled(uint256 indexed poolId, uint256 totalReward, uint256 completedCount, uint256 platformFee);
    event VerifierUpdated(address indexed oldVerifier, address indexed newVerifier);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event EmergencyWithdraw(uint256 indexed poolId, address indexed user, uint256 amount);
    event Paused(address account);
    event Unpaused(address account);

    // ── Modifiers ──

    modifier whenNotPaused() {
        require(!paused, "ExercisePool: paused");
        _;
    }

    modifier onlyVerifier() {
        require(msg.sender == verifier, "ExercisePool: not verifier");
        _;
    }

    // ── Constructor ──

    /// @param _stakeToken Address of the ERC20 token used for staking
    /// @param _verifier Address of the exercise verifier (backend oracle)
    /// @param _feeCollector Address to receive platform fees
    /// @param _admin Address of the contract admin
    constructor(
        address _stakeToken,
        address _verifier,
        address _feeCollector,
        address _admin
    ) Ownable() {
        require(_stakeToken != address(0), "ExercisePool: zero token address");
        require(_verifier != address(0), "ExercisePool: zero verifier address");
        require(_feeCollector != address(0), "ExercisePool: zero fee collector");
        require(_admin != address(0), "ExercisePool: zero admin address");

        stakeToken = IERC20(_stakeToken);
        verifier = _verifier;
        feeCollector = _feeCollector;
        transferOwnership(_admin);
    }

    // ── Core Functions ──

    /// @notice Create a new daily exercise pool
    /// @dev Can only create when no active pool exists or current pool has ended
    function createPool() external onlyOwner whenNotPaused returns (uint256) {
        // Ensure current pool is settled or doesn't exist
        if (currentPoolId > 0) {
            Pool storage current = _pools[currentPoolId];
            require(
                current.settled || block.timestamp > current.endTime,
                "ExercisePool: active pool exists"
            );
        }

        currentPoolId++;
        Pool storage newPool = _pools[currentPoolId];
        newPool.poolId = currentPoolId;
        newPool.startTime = block.timestamp;
        newPool.endTime = block.timestamp + POOL_DURATION;

        emit PoolCreated(currentPoolId, newPool.startTime, newPool.endTime);
        return currentPoolId;
    }

    /// @notice Stake tokens to join today's exercise pool
    /// @dev User must approve STAKE_AMOUNT before calling
    function stake() external nonReentrant whenNotPaused {
        require(currentPoolId > 0, "ExercisePool: no active pool");
        Pool storage pool = _pools[currentPoolId];
        require(block.timestamp < pool.endTime, "ExercisePool: pool ended");
        require(!pool.settled, "ExercisePool: pool settled");

        // Allow staking only in first 12 hours of pool
        require(
            block.timestamp < pool.startTime + 12 hours,
            "ExercisePool: staking window closed"
        );

        Participant storage p = participants[currentPoolId][msg.sender];
        require(!p.staked, "ExercisePool: already staked");

        // Transfer stake tokens from user
        stakeToken.safeTransferFrom(msg.sender, address(this), STAKE_AMOUNT);

        p.staked = true;
        p.stakedAt = block.timestamp;
        pool.totalStaked += STAKE_AMOUNT;
        pool.participantCount++;
        pool.participantList.push(msg.sender);

        emit Staked(currentPoolId, msg.sender, STAKE_AMOUNT);
    }

    /// @notice Verify exercise completion for a user (called by verifier/oracle)
    /// @param _poolId Pool ID
    /// @param _user Address of the user who completed exercise
    function verifyExercise(uint256 _poolId, address _user) external onlyVerifier whenNotPaused {
        require(_poolId > 0 && _poolId <= currentPoolId, "ExercisePool: invalid pool");
        Pool storage pool = _pools[_poolId];
        require(!pool.settled, "ExercisePool: pool settled");
        require(block.timestamp <= pool.endTime, "ExercisePool: pool ended");

        Participant storage p = participants[_poolId][_user];
        require(p.staked, "ExercisePool: user not staked");
        require(!p.completed, "ExercisePool: already completed");

        p.completed = true;
        p.completedAt = block.timestamp;
        pool.completedCount++;

        emit ExerciseCompleted(_poolId, _user, block.timestamp);
    }

    /// @notice Batch verify exercise completion for multiple users
    /// @param _poolId Pool ID
    /// @param _users Array of user addresses
    function batchVerifyExercise(uint256 _poolId, address[] calldata _users) external onlyVerifier whenNotPaused {
        require(_poolId > 0 && _poolId <= currentPoolId, "ExercisePool: invalid pool");
        Pool storage pool = _pools[_poolId];
        require(!pool.settled, "ExercisePool: pool settled");
        require(block.timestamp <= pool.endTime, "ExercisePool: pool ended");

        for (uint256 i = 0; i < _users.length; i++) {
            Participant storage p = participants[_poolId][_users[i]];
            if (p.staked && !p.completed) {
                p.completed = true;
                p.completedAt = block.timestamp;
                pool.completedCount++;
                emit ExerciseCompleted(_poolId, _users[i], block.timestamp);
            }
        }
    }

    /// @notice Settle pool after 24h — distribute rewards to completers
    /// @param _poolId Pool ID to settle
    function settlePool(uint256 _poolId) external nonReentrant whenNotPaused {
        require(_poolId > 0 && _poolId <= currentPoolId, "ExercisePool: invalid pool");
        Pool storage pool = _pools[_poolId];
        require(!pool.settled, "ExercisePool: already settled");
        require(block.timestamp > pool.endTime, "ExercisePool: pool not ended");

        pool.settled = true;

        uint256 totalStaked = pool.totalStaked;
        uint256 completedCount = pool.completedCount;
        uint256 participantCount = pool.participantCount;

        if (participantCount == 0) {
            // No participants — nothing to do
            emit PoolSettled(_poolId, 0, 0, 0);
            return;
        }

        if (completedCount == 0) {
            // Nobody completed — all stakes go to platform
            stakeToken.safeTransfer(feeCollector, totalStaked);
            totalFeesCollected += totalStaked;
            emit PoolSettled(_poolId, 0, 0, totalStaked);
            return;
        }

        if (completedCount == participantCount) {
            // Everyone completed — everyone gets their stake back (no losers)
            poolRewardPerCompleter[_poolId] = STAKE_AMOUNT;
            emit PoolSettled(_poolId, totalStaked, completedCount, 0);
            return;
        }

        // Mixed results: completers share the loser stakes minus platform fee
        uint256 failedStakes = (participantCount - completedCount) * STAKE_AMOUNT;
        uint256 platformFee = (failedStakes * platformFeePercent) / 100;
        uint256 rewardPool = failedStakes - platformFee;

        // Each completer gets: their original stake + share of reward pool
        uint256 rewardPerCompleter = STAKE_AMOUNT + (rewardPool / completedCount);
        poolRewardPerCompleter[_poolId] = rewardPerCompleter;

        // Transfer platform fee
        if (platformFee > 0) {
            stakeToken.safeTransfer(feeCollector, platformFee);
            totalFeesCollected += platformFee;
        }

        // Handle dust from integer division
        uint256 dust = rewardPool - ((rewardPool / completedCount) * completedCount);
        if (dust > 0) {
            stakeToken.safeTransfer(feeCollector, dust);
            totalFeesCollected += dust;
        }

        emit PoolSettled(_poolId, rewardPool, completedCount, platformFee);
    }

    /// @notice Claim reward after pool settlement
    /// @param _poolId Pool ID
    function claimReward(uint256 _poolId) external nonReentrant whenNotPaused {
        Pool storage pool = _pools[_poolId];
        require(pool.settled, "ExercisePool: pool not settled");

        Participant storage p = participants[_poolId][msg.sender];
        require(p.staked, "ExercisePool: not participant");
        require(p.completed, "ExercisePool: exercise not completed");
        require(!p.claimed, "ExercisePool: already claimed");

        p.claimed = true;

        uint256 reward = poolRewardPerCompleter[_poolId];
        require(reward > 0, "ExercisePool: no reward");

        stakeToken.safeTransfer(msg.sender, reward);

        emit RewardClaimed(_poolId, msg.sender, reward);
    }

    // ── View Functions ──

    /// @notice Get current pool info
    function getCurrentPool() external view returns (
        uint256 poolId,
        uint256 startTime,
        uint256 endTime,
        uint256 totalStaked,
        uint256 participantCount,
        uint256 completedCount,
        bool settled,
        bool isActive
    ) {
        if (currentPoolId == 0) {
            return (0, 0, 0, 0, 0, 0, false, false);
        }
        Pool storage pool = _pools[currentPoolId];
        return (
            pool.poolId,
            pool.startTime,
            pool.endTime,
            pool.totalStaked,
            pool.participantCount,
            pool.completedCount,
            pool.settled,
            block.timestamp >= pool.startTime && block.timestamp <= pool.endTime && !pool.settled
        );
    }

    /// @notice Get pool info by ID
    function getPool(uint256 _poolId) external view returns (
        uint256 poolId,
        uint256 startTime,
        uint256 endTime,
        uint256 totalStaked,
        uint256 participantCount,
        uint256 completedCount,
        bool settled
    ) {
        require(_poolId > 0 && _poolId <= currentPoolId, "ExercisePool: invalid pool");
        Pool storage pool = _pools[_poolId];
        return (
            pool.poolId,
            pool.startTime,
            pool.endTime,
            pool.totalStaked,
            pool.participantCount,
            pool.completedCount,
            pool.settled
        );
    }

    /// @notice Get user's participation status in a pool
    function getUserStatus(uint256 _poolId, address _user) external view returns (
        bool staked,
        bool completed,
        uint256 stakedAt,
        uint256 completedAt,
        bool claimed,
        uint256 potentialReward
    ) {
        Participant storage p = participants[_poolId][_user];
        Pool storage pool = _pools[_poolId];

        uint256 reward = 0;
        if (p.staked && p.completed) {
            if (pool.settled) {
                reward = p.claimed ? 0 : poolRewardPerCompleter[_poolId];
            } else {
                // Estimate: if pool were settled now
                reward = _estimateReward(_poolId);
            }
        }

        return (p.staked, p.completed, p.stakedAt, p.completedAt, p.claimed, reward);
    }

    /// @notice Get list of participants in a pool
    function getParticipantList(uint256 _poolId) external view returns (address[] memory) {
        require(_poolId > 0 && _poolId <= currentPoolId, "ExercisePool: invalid pool");
        return _pools[_poolId].participantList;
    }

    /// @notice Check if staking window is open
    function isStakingOpen() external view returns (bool) {
        if (currentPoolId == 0) return false;
        Pool storage pool = _pools[currentPoolId];
        return block.timestamp < pool.startTime + 12 hours
            && block.timestamp < pool.endTime
            && !pool.settled;
    }

    /// @notice Calculate estimated reward per completer
    function _estimateReward(uint256 _poolId) internal view returns (uint256) {
        Pool storage pool = _pools[_poolId];
        if (pool.completedCount == 0) return 0;
        if (pool.completedCount == pool.participantCount) return STAKE_AMOUNT;

        uint256 failedStakes = (pool.participantCount - pool.completedCount) * STAKE_AMOUNT;
        uint256 platformFee = (failedStakes * platformFeePercent) / 100;
        uint256 rewardPool = failedStakes - platformFee;
        return STAKE_AMOUNT + (rewardPool / pool.completedCount);
    }

    // ── Admin Functions ──

    /// @notice Update verifier address
    function setVerifier(address _verifier) external onlyOwner {
        require(_verifier != address(0), "ExercisePool: zero address");
        emit VerifierUpdated(verifier, _verifier);
        verifier = _verifier;
    }

    /// @notice Update fee collector address
    function setFeeCollector(address _feeCollector) external onlyOwner {
        require(_feeCollector != address(0), "ExercisePool: zero address");
        emit FeeCollectorUpdated(feeCollector, _feeCollector);
        feeCollector = _feeCollector;
    }

    /// @notice Update platform fee percentage (max 20%)
    function setPlatformFeePercent(uint256 _feePercent) external onlyOwner {
        require(_feePercent <= 20, "ExercisePool: fee too high");
        emit PlatformFeeUpdated(platformFeePercent, _feePercent);
        platformFeePercent = _feePercent;
    }

    /// @notice Pause/unpause the contract
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    /// @notice Emergency withdraw for users when contract is paused
    function emergencyWithdraw(uint256 _poolId) external nonReentrant {
        require(paused, "ExercisePool: not paused");
        Pool storage pool = _pools[_poolId];
        require(!pool.settled, "ExercisePool: pool settled");

        Participant storage p = participants[_poolId][msg.sender];
        require(p.staked, "ExercisePool: not participant");
        require(!p.claimed, "ExercisePool: already claimed");

        p.claimed = true;
        pool.totalStaked -= STAKE_AMOUNT;

        stakeToken.safeTransfer(msg.sender, STAKE_AMOUNT);
        emit EmergencyWithdraw(_poolId, msg.sender, STAKE_AMOUNT);
    }

    /// @notice Recover accidentally sent tokens (not the stake token for active pools)
    function recoverToken(address _token, uint256 _amount) external onlyOwner {
        if (_token == address(stakeToken)) {
            // Only allow recovering excess tokens beyond what's needed for active pools
            uint256 requiredBalance = 0;
            for (uint256 i = 1; i <= currentPoolId; i++) {
                if (!_pools[i].settled) {
                    requiredBalance += _pools[i].totalStaked;
                }
            }
            uint256 currentBalance = stakeToken.balanceOf(address(this));
            require(
                currentBalance - _amount >= requiredBalance,
                "ExercisePool: insufficient balance for pools"
            );
        }
        IERC20(_token).safeTransfer(owner(), _amount);
    }
}
