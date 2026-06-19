// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title H2EVesting — Team & Ecosystem token vesting
/// @notice 1yr cliff + 3yr linear unlock
contract H2EVesting is Ownable {
    IERC20 public immutable token;

    struct VestingSchedule {
        uint256 totalAmount;
        uint256 cliffEnd;       // timestamp
        uint256 vestingEnd;     // timestamp
        uint256 claimed;
        bool revoked;
    }

    mapping(address => VestingSchedule) public schedules;

    event VestingCreated(address indexed beneficiary, uint256 amount, uint256 cliffEnd, uint256 vestingEnd);
    event TokensClaimed(address indexed beneficiary, uint256 amount);
    event VestingRevoked(address indexed beneficiary);

    constructor(address _token, address _admin) Ownable() {
        token = IERC20(_token);
        transferOwnership(_admin);
    }

    /// @notice Create vesting schedule
    function createVesting(
        address beneficiary,
        uint256 amount,
        uint256 cliffDuration,    // e.g. 365 days
        uint256 vestingDuration   // e.g. 1095 days (3 years)
    ) external onlyOwner {
        require(schedules[beneficiary].totalAmount == 0, "Vesting: already exists");
        require(token.transferFrom(msg.sender, address(this), amount), "Vesting: transfer failed");

        schedules[beneficiary] = VestingSchedule({
            totalAmount: amount,
            cliffEnd: block.timestamp + cliffDuration,
            vestingEnd: block.timestamp + cliffDuration + vestingDuration,
            claimed: 0,
            revoked: false
        });

        emit VestingCreated(beneficiary, amount, block.timestamp + cliffDuration, block.timestamp + cliffDuration + vestingDuration);
    }

    /// @notice Claim vested tokens
    function claim() external {
        VestingSchedule storage s = schedules[msg.sender];
        require(s.totalAmount > 0, "Vesting: no schedule");
        require(!s.revoked, "Vesting: revoked");
        require(block.timestamp >= s.cliffEnd, "Vesting: cliff not reached");

        uint256 vested = _vestedAmount(s);
        uint256 claimable = vested - s.claimed;
        require(claimable > 0, "Vesting: nothing to claim");

        s.claimed += claimable;
        require(token.transfer(msg.sender, claimable), "Vesting: transfer failed");

        emit TokensClaimed(msg.sender, claimable);
    }

    function _vestedAmount(VestingSchedule memory s) private view returns (uint256) {
        if (block.timestamp >= s.vestingEnd) return s.totalAmount;
        uint256 elapsed = block.timestamp - s.cliffEnd;
        uint256 vestingPeriod = s.vestingEnd - s.cliffEnd;
        return (s.totalAmount * elapsed) / vestingPeriod;
    }

    /// @notice Revoke unvested tokens (admin only)
    function revoke(address beneficiary) external onlyOwner {
        VestingSchedule storage s = schedules[beneficiary];
        require(!s.revoked, "Vesting: already revoked");
        uint256 vested = _vestedAmount(s);
        uint256 unvested = s.totalAmount - vested;
        s.revoked = true;
        if (unvested > 0) token.transfer(owner(), unvested);
        emit VestingRevoked(beneficiary);
    }

    /// @notice View claimable amount
    function claimable(address beneficiary) external view returns (uint256) {
        VestingSchedule memory s = schedules[beneficiary];
        if (s.totalAmount == 0 || s.revoked || block.timestamp < s.cliffEnd) return 0;
        return _vestedAmount(s) - s.claimed;
    }
}
