// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {WingmanPool} from "../src/WingmanPool.sol";
import {MockERC20} from "./mocks/Mocks.sol";

contract WingmanPoolTest is Test {
    MockERC20 usdc;
    MockERC20 vibes;
    WingmanPool pool;

    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address payer = makeAddr("payer");

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        vibes = new MockERC20("Vibes", "VIBES", 18);
        pool = new WingmanPool(IERC20(address(vibes)), IERC20(address(usdc)), treasury, owner);
        vibes.mint(alice, 1_000_000e18);
        vibes.mint(bob, 1_000_000e18);
        usdc.mint(payer, 1_000_000e6);
        vm.prank(alice);
        vibes.approve(address(pool), type(uint256).max);
        vm.prank(bob);
        vibes.approve(address(pool), type(uint256).max);
        vm.prank(payer);
        usdc.approve(address(pool), type(uint256).max);
    }

    function _notify(uint256 amount) internal {
        vm.prank(payer);
        pool.notifyReward(amount);
    }

    function test_zeroStakersRewardGoesToTreasury() public {
        _notify(10e6);
        assertEq(usdc.balanceOf(treasury), 10e6);
        assertEq(usdc.balanceOf(address(pool)), 0);
        assertEq(pool.rewardPerTokenStored(), 0);
    }

    function test_twoStakersMultipleRewards() public {
        vm.prank(alice);
        pool.stake(100e18);
        _notify(10e6); // alice gets all 10

        vm.prank(bob);
        pool.stake(300e18);
        _notify(40e6); // alice 10, bob 30

        assertEq(pool.earned(alice), 20e6);
        assertEq(pool.earned(bob), 30e6);

        vm.prank(alice);
        pool.unstake(100e18); // alice leaves, keeps her 20
        _notify(9e6); // bob gets all 9

        assertEq(pool.earned(alice), 20e6);
        assertEq(pool.earned(bob), 39e6);

        vm.prank(alice);
        assertEq(pool.claim(), 20e6);
        vm.prank(bob);
        assertEq(pool.claim(), 39e6);
        assertEq(usdc.balanceOf(alice), 20e6);
        assertEq(usdc.balanceOf(bob), 39e6);
        assertEq(pool.earned(alice), 0);
        assertEq(vibes.balanceOf(alice), 1_000_000e18);

        // Claim again is a no op.
        vm.prank(bob);
        assertEq(pool.claim(), 0);
    }

    function test_stakeAfterRewardDoesNotEarnPastRewards() public {
        vm.prank(alice);
        pool.stake(1e18);
        _notify(5e6);
        vm.prank(bob);
        pool.stake(1_000_000e18);
        assertEq(pool.earned(bob), 0);
        assertEq(pool.earned(alice), 5e6);
    }

    function test_unstakeAnytimeAndBounds() public {
        vm.startPrank(alice);
        pool.stake(50e18);
        assertEq(pool.staked(alice), 50e18);
        assertEq(pool.totalStaked(), 50e18);
        vm.expectRevert(WingmanPool.InsufficientStake.selector);
        pool.unstake(51e18);
        vm.expectRevert(WingmanPool.ZeroAmount.selector);
        pool.stake(0);
        pool.unstake(50e18);
        vm.stopPrank();
        assertEq(pool.totalStaked(), 0);
    }

    function test_solvencyFuzz(uint96 a, uint96 b, uint64 r1, uint64 r2) public {
        vm.assume(a > 0 && b > 0);
        vm.assume(uint256(a) <= 1_000_000e18 && uint256(b) <= 1_000_000e18);
        r1 = uint64(bound(r1, 1, 100_000e6));
        r2 = uint64(bound(r2, 1, 100_000e6));
        vm.prank(alice);
        pool.stake(a);
        _notify(r1);
        vm.prank(bob);
        pool.stake(b);
        _notify(r2);
        vm.prank(alice);
        pool.claim();
        vm.prank(bob);
        pool.claim();
        // Rounding only ever leaves dust in the pool, never owes more than it holds.
        assertLe(usdc.balanceOf(alice) + usdc.balanceOf(bob), uint256(r1) + r2);
    }

    function test_setTreasuryOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        pool.setTreasury(alice);
        vm.prank(owner);
        pool.setTreasury(alice);
        assertEq(pool.treasury(), alice);
    }
}
