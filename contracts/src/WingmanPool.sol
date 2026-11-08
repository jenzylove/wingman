// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title WingmanPool
/// @notice Stake VIBES, earn a share of Wingman exit fees paid in USDC.
/// Rewards arrive only through notifyReward. There is no time based emission.
contract WingmanPool is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    uint256 private constant PRECISION = 1e18;

    IERC20 public immutable vibes;
    IERC20 public immutable usdc;
    address public treasury;

    uint256 public totalStaked;
    /// @notice Accumulated USDC per staked VIBES, scaled by 1e18.
    uint256 public rewardPerTokenStored;
    /// @notice Total USDC ever distributed to stakers.
    uint256 public totalRewarded;

    mapping(address => uint256) private _staked;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);
    event RewardNotified(address indexed from, uint256 amount, uint256 rewardPerToken);
    event RewardToTreasury(address indexed from, uint256 amount);
    event TreasurySet(address treasury);

    error ZeroAmount();
    error ZeroAddress();
    error InsufficientStake();

    constructor(IERC20 vibes_, IERC20 usdc_, address treasury_, address owner_) Ownable(owner_) {
        if (address(vibes_) == address(0) || address(usdc_) == address(0) || treasury_ == address(0)) {
            revert ZeroAddress();
        }
        vibes = vibes_;
        usdc = usdc_;
        treasury = treasury_;
    }

    // ------------------------------------------------------------------ views

    function staked(address user) external view returns (uint256) {
        return _staked[user];
    }

    function earned(address user) public view returns (uint256) {
        return rewards[user] + (_staked[user] * (rewardPerTokenStored - userRewardPerTokenPaid[user])) / PRECISION;
    }

    // ---------------------------------------------------------------- actions

    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _update(msg.sender);
        uint256 before = vibes.balanceOf(address(this));
        vibes.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = vibes.balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();
        _staked[msg.sender] += received;
        totalStaked += received;
        emit Staked(msg.sender, received);
    }

    function unstake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (_staked[msg.sender] < amount) revert InsufficientStake();
        _update(msg.sender);
        _staked[msg.sender] -= amount;
        totalStaked -= amount;
        vibes.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claim() external nonReentrant returns (uint256 amount) {
        _update(msg.sender);
        amount = rewards[msg.sender];
        if (amount > 0) {
            rewards[msg.sender] = 0;
            usdc.safeTransfer(msg.sender, amount);
            emit Claimed(msg.sender, amount);
        }
    }

    /// @notice Pull `amount` USDC from the caller and share it across stakers.
    /// With no stakers the USDC goes to the treasury instead.
    function notifyReward(uint256 amount) external nonReentrant {
        if (amount == 0) return;
        if (totalStaked == 0) {
            usdc.safeTransferFrom(msg.sender, treasury, amount);
            emit RewardToTreasury(msg.sender, amount);
            return;
        }
        uint256 before = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = usdc.balanceOf(address(this)) - before;
        rewardPerTokenStored += (received * PRECISION) / totalStaked;
        totalRewarded += received;
        emit RewardNotified(msg.sender, received, rewardPerTokenStored);
    }

    // ------------------------------------------------------------------ admin

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    // --------------------------------------------------------------- internal

    function _update(address user) internal {
        rewards[user] = earned(user);
        userRewardPerTokenPaid[user] = rewardPerTokenStored;
    }
}
