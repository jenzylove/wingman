// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {WingmanExit, IWingmanPool} from "../src/WingmanExit.sol";
import {WingmanPool} from "../src/WingmanPool.sol";
import {MockERC20, MockFeeToken, MockRouter, ReentrantRouter} from "./mocks/Mocks.sol";

contract WingmanExitTest is Test {
    MockERC20 usdc;
    MockERC20 vibes;
    MockERC20 meme;
    WingmanPool pool;
    WingmanExit exit;
    MockRouter router;

    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address attacker = makeAddr("attacker");
    address crew = makeAddr("crew");
    bytes32 constant TX = keccak256("trigger");

    uint256 constant RATE = 2e6; // 1 MEME = 2 USDC

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        vibes = new MockERC20("Vibes", "VIBES", 18);
        meme = new MockERC20("Meme", "MEME", 18);
        pool = new WingmanPool(IERC20(address(vibes)), IERC20(address(usdc)), treasury, owner);
        router = new MockRouter(IERC20(address(usdc)), RATE);
        usdc.mint(address(router), 1_000_000e6);

        address[] memory routers = new address[](1);
        routers[0] = address(router);
        exit = new WingmanExit(
            IERC20(address(usdc)), IERC20(address(vibes)), IWingmanPool(address(pool)), treasury, keeper, owner, routers
        );

        meme.mint(alice, 1_000e18);
    }

    // ---------------------------------------------------------------- helpers

    function _arm(address user, MockERC20 token, uint256 amount, uint16 slip) internal returns (uint256 id) {
        vm.startPrank(user);
        token.approve(address(exit), amount);
        id = exit.arm(address(token), amount, slip);
        vm.stopPrank();
    }

    function _swapData(address token, uint256 amountIn, address recipient) internal pure returns (bytes memory) {
        return abi.encodeCall(MockRouter.swap, (token, amountIn, recipient));
    }

    function _fire(uint256 id, address token, uint256 amountIn, uint256 quoted) internal returns (uint256) {
        vm.prank(keeper);
        return exit.fire(id, address(router), _swapData(token, amountIn, address(exit)), quoted, TX, crew);
    }

    // ------------------------------------------------------------- arm/cancel

    function test_armStoresAndEmits() public {
        vm.startPrank(alice);
        meme.approve(address(exit), 100e18);
        vm.expectEmit(true, true, true, true);
        emit WingmanExit.Armed(1, alice, address(meme), 100e18, 500, 0);
        uint256 id = exit.arm(address(meme), 100e18, 500);
        vm.stopPrank();

        (address o, address t, uint256 amt, uint256 floor, uint16 slip, bool active, uint64 at) = exit.arms(id);
        assertEq(o, alice);
        assertEq(t, address(meme));
        assertEq(amt, 100e18);
        assertEq(floor, 0);
        assertEq(slip, 500);
        assertTrue(active);
        assertEq(at, block.timestamp);
        assertEq(exit.armCount(alice), 1);
        assertEq(exit.armIdsOf(alice, 0, 10)[0], id);
    }

    function test_armRequiresAllowance() public {
        vm.startPrank(alice);
        meme.approve(address(exit), 10e18);
        vm.expectRevert(WingmanExit.AllowanceTooLow.selector);
        exit.arm(address(meme), 100e18, 500);
        vm.stopPrank();
    }

    function test_armRejectsHighSlippage() public {
        vm.startPrank(alice);
        meme.approve(address(exit), 100e18);
        vm.expectRevert(WingmanExit.SlippageTooHigh.selector);
        exit.arm(address(meme), 100e18, 3001);
        vm.stopPrank();
    }

    function test_armRejectsUsdcAndZero() public {
        vm.startPrank(alice);
        vm.expectRevert(WingmanExit.BadToken.selector);
        exit.arm(address(usdc), 1, 100);
        vm.expectRevert(WingmanExit.BadToken.selector);
        exit.arm(address(0), 1, 100);
        vm.expectRevert(WingmanExit.ZeroAmount.selector);
        exit.arm(address(meme), 0, 100);
        vm.stopPrank();
    }

    function test_cancelOnlyOwner() public {
        uint256 id = _arm(alice, meme, 100e18, 500);
        vm.prank(bob);
        vm.expectRevert(WingmanExit.NotArmOwner.selector);
        exit.cancel(id);

        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit WingmanExit.Cancelled(id, alice);
        exit.cancel(id);
        (,,,,, bool active,) = exit.arms(id);
        assertFalse(active);

        vm.prank(alice);
        vm.expectRevert(WingmanExit.NotActive.selector);
        exit.cancel(id);

        // A cancelled arm cannot fire.
        vm.prank(keeper);
        vm.expectRevert(WingmanExit.NotActive.selector);
        exit.fire(id, address(router), _swapData(address(meme), 100e18, address(exit)), 200e6, TX, crew);
    }

    // ------------------------------------------------------------------ fire

    function test_onlyKeeperCanFire() public {
        uint256 id = _arm(alice, meme, 100e18, 500);
        bytes memory data = _swapData(address(meme), 100e18, address(exit));
        vm.prank(attacker);
        vm.expectRevert(WingmanExit.NotKeeper.selector);
        exit.fire(id, address(router), data, 200e6, TX, crew);
        vm.prank(owner);
        vm.expectRevert(WingmanExit.NotKeeper.selector);
        exit.fire(id, address(router), data, 200e6, TX, crew);
    }

    function test_fireHappyPathFeeSplitAndProceedsToOwner() public {
        // One staker so the pool share stays in the pool.
        vibes.mint(bob, 1_000e18);
        vm.startPrank(bob);
        vibes.approve(address(pool), 1_000e18);
        pool.stake(1_000e18);
        vm.stopPrank();

        uint256 id = _arm(alice, meme, 100e18, 500);
        vm.expectEmit(true, true, true, true);
        emit WingmanExit.Fired(id, alice, address(meme), 100e18, 200e6, 1e6, crew, TX);
        uint256 toOwner = _fire(id, address(meme), 100e18, 200e6);

        // 200 USDC out, 0.5% fee = 1 USDC, 0.3 to pool, 0.7 to treasury.
        assertEq(toOwner, 199e6);
        assertEq(usdc.balanceOf(alice), 199e6);
        assertEq(usdc.balanceOf(address(pool)), 300_000);
        assertEq(usdc.balanceOf(treasury), 700_000);
        assertEq(usdc.balanceOf(address(exit)), 0);
        assertEq(meme.balanceOf(address(exit)), 0);
        assertEq(meme.balanceOf(alice), 900e18);
        assertEq(meme.allowance(address(exit), address(router)), 0);
        assertEq(pool.earned(bob), 300_000);

        (,,,,, bool active,) = exit.arms(id);
        assertFalse(active);

        // Cannot fire twice.
        vm.prank(keeper);
        vm.expectRevert(WingmanExit.NotActive.selector);
        exit.fire(id, address(router), _swapData(address(meme), 100e18, address(exit)), 200e6, TX, crew);
    }

    function test_minOutEnforcedWhenRouterUnderpays() public {
        uint256 id = _arm(alice, meme, 100e18, 500); // 5% slippage
        router.setRate(1.8e6); // pays 180 USDC, quote said 200, min is 190
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(WingmanExit.InsufficientOutput.selector, 180e6, 190e6));
        exit.fire(id, address(router), _swapData(address(meme), 100e18, address(exit)), 200e6, TX, crew);

        // Reverted, so the arm is still live and the user kept everything.
        (,,,,, bool active,) = exit.arms(id);
        assertTrue(active);
        assertEq(meme.balanceOf(alice), 1_000e18);
    }

    function test_withinSlippagePasses() public {
        uint256 id = _arm(alice, meme, 100e18, 500);
        router.setRate(1.9e6); // exactly min
        _fire(id, address(meme), 100e18, 200e6);
        assertEq(usdc.balanceOf(alice), 190e6 - 950_000);
    }

    function test_zeroQuoteRejected() public {
        uint256 id = _arm(alice, meme, 100e18, 500);
        vm.prank(keeper);
        vm.expectRevert(WingmanExit.BadQuote.selector);
        exit.fire(id, address(router), _swapData(address(meme), 100e18, address(exit)), 1, TX, crew);
    }

    function test_ownerFloorBeatsLowKeeperQuote() public {
        vm.startPrank(alice);
        meme.approve(address(exit), 100e18);
        uint256 id = exit.armWithFloor(address(meme), 100e18, 500, 150e6);
        vm.stopPrank();
        router.setRate(1e6); // pays 100 USDC
        // Keeper passes a lowball quote of 100 USDC, the owner floor of 150 still holds.
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(WingmanExit.InsufficientOutput.selector, 100e6, 150e6));
        exit.fire(id, address(router), _swapData(address(meme), 100e18, address(exit)), 100e6, TX, crew);
    }

    function test_proceedsCannotBeRedirected() public {
        uint256 id = _arm(alice, meme, 100e18, 500);
        // Keeper builds calldata that sends the USDC to the attacker.
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(WingmanExit.InsufficientOutput.selector, 0, 190e6));
        exit.fire(id, address(router), _swapData(address(meme), 100e18, attacker), 200e6, TX, crew);
        assertEq(usdc.balanceOf(attacker), 0);
        assertEq(meme.balanceOf(alice), 1_000e18);
    }

    function test_unspentReturnedToOwner() public {
        uint256 id = _arm(alice, meme, 100e18, 500);
        // Router only takes 60 of the 100 pulled.
        _fire(id, address(meme), 60e18, 120e6);
        assertEq(meme.balanceOf(alice), 940e18);
        assertEq(meme.balanceOf(address(exit)), 0);
        assertEq(usdc.balanceOf(alice), 120e6 - 600_000);
    }

    function test_pullsOnlyMinOfAmountBalanceAllowance() public {
        // Armed 500, but Alice moved most tokens away: only her balance is pulled.
        uint256 id = _arm(alice, meme, 500e18, 500);
        vm.prank(alice);
        meme.transfer(bob, 900e18); // alice now has 100
        vm.prank(keeper);
        vm.recordLogs();
        exit.fire(id, address(router), _swapData(address(meme), 100e18, address(exit)), 200e6, TX, crew);
        assertEq(meme.balanceOf(alice), 0);
        assertEq(meme.balanceOf(bob), 900e18);

        // Allowance lowered after arming: only the allowance is pulled.
        meme.mint(bob, 0);
        uint256 id2 = _arm(bob, meme, 500e18, 500);
        vm.prank(bob);
        meme.approve(address(exit), 50e18);
        vm.prank(keeper);
        exit.fire(id2, address(router), _swapData(address(meme), 50e18, address(exit)), 100e6, TX, crew);
        assertEq(meme.balanceOf(bob), 850e18);
    }

    function test_neverPullsMoreThanArmed() public {
        // Alice approves far more than she arms; router asks for all of it.
        vm.startPrank(alice);
        meme.approve(address(exit), type(uint256).max);
        uint256 id = exit.arm(address(meme), 100e18, 500);
        vm.stopPrank();
        vm.prank(keeper);
        vm.expectRevert(); // router transferFrom fails: exit approved only 100
        exit.fire(id, address(router), _swapData(address(meme), 1_000e18, address(exit)), 2_000e6, TX, crew);
        assertEq(meme.balanceOf(alice), 1_000e18);
    }

    function test_routerNotAllowlistedReverts() public {
        uint256 id = _arm(alice, meme, 100e18, 500);
        MockRouter other = new MockRouter(IERC20(address(usdc)), RATE);
        vm.prank(keeper);
        vm.expectRevert(WingmanExit.RouterNotAllowed.selector);
        exit.fire(id, address(other), _swapData(address(meme), 100e18, address(exit)), 200e6, TX, crew);
    }

    function test_keeperCannotCallTokenDirectly() public {
        uint256 id = _arm(alice, meme, 100e18, 500);
        // Pointing "router" at the token or USDC is not possible.
        bytes memory steal = abi.encodeCall(IERC20.transferFrom, (alice, attacker, 100e18));
        vm.prank(keeper);
        vm.expectRevert(WingmanExit.RouterNotAllowed.selector);
        exit.fire(id, address(meme), steal, 200e6, TX, crew);

        vm.startPrank(owner);
        vm.expectRevert(WingmanExit.BadToken.selector);
        exit.setRouter(address(usdc), true);
        vm.expectRevert(WingmanExit.BadToken.selector);
        exit.setRouter(address(pool), true);
        vm.stopPrank();
    }

    function test_keeperCannotDrainStrayUsdc() public {
        // Someone left 500 USDC in the contract by mistake.
        usdc.mint(address(exit), 500e6);
        uint256 id = _arm(alice, meme, 100e18, 500);

        // Calldata that tries to move the contract's USDC elsewhere fails:
        // the exit never approves USDC to a router.
        bytes memory drain = abi.encodeCall(MockRouter.pullUsdc, (address(exit), attacker, 500e6));
        vm.prank(keeper);
        vm.expectRevert();
        exit.fire(id, address(router), drain, 200e6, TX, crew);

        // Calldata that does nothing (so stray USDC could be counted as output) also fails,
        // because output is a balance delta, not a balance.
        bytes memory noop = abi.encodeCall(MockRouter.noop, ());
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(WingmanExit.InsufficientOutput.selector, 0, 190e6));
        exit.fire(id, address(router), noop, 200e6, TX, crew);

        assertEq(usdc.balanceOf(address(exit)), 500e6);
        assertEq(usdc.balanceOf(attacker), 0);
        assertEq(meme.balanceOf(alice), 1_000e18);
    }

    function test_feeExemptByHolding() public {
        vibes.mint(alice, 100_000e18);
        assertTrue(exit.feeExempt(alice));
        uint256 id = _arm(alice, meme, 100e18, 500);
        _fire(id, address(meme), 100e18, 200e6);
        assertEq(usdc.balanceOf(alice), 200e6);
        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_feeExemptByStaking() public {
        vibes.mint(alice, 100_000e18);
        vm.startPrank(alice);
        vibes.approve(address(pool), 100_000e18);
        pool.stake(100_000e18);
        vm.stopPrank();
        assertEq(vibes.balanceOf(alice), 0);
        assertTrue(exit.feeExempt(alice));
        uint256 id = _arm(alice, meme, 100e18, 500);
        _fire(id, address(meme), 100e18, 200e6);
        assertEq(usdc.balanceOf(alice), 200e6);
    }

    function test_notExemptJustBelowThreshold() public {
        vibes.mint(alice, 100_000e18 - 1);
        assertFalse(exit.feeExempt(alice));
    }

    function test_noStakersPoolShareGoesToTreasury() public {
        uint256 id = _arm(alice, meme, 100e18, 500);
        _fire(id, address(meme), 100e18, 200e6);
        assertEq(usdc.balanceOf(treasury), 1e6);
        assertEq(usdc.balanceOf(address(pool)), 0);
    }

    function test_feeOnTransferToken() public {
        MockFeeToken fot = new MockFeeToken();
        fot.mint(alice, 1_000e18);
        vm.startPrank(alice);
        fot.approve(address(exit), 100e18);
        uint256 id = exit.arm(address(fot), 100e18, 1000);
        vm.stopPrank();

        // Exit receives 99 (1% burned), router receives 98.01, pays 196.02 USDC.
        uint256 receivedByExit = 99e18;
        vm.prank(keeper);
        exit.fire(id, address(router), _swapData(address(fot), receivedByExit, address(exit)), 200e6, TX, crew);

        uint256 out = (98.01e18 * RATE) / 1e18;
        uint256 fee = (out * 50) / 10_000;
        assertEq(usdc.balanceOf(alice), out - fee);
        assertEq(fot.balanceOf(address(exit)), 0);
        assertEq(fot.balanceOf(alice), 900e18);
    }

    function test_reentrancyBlocked() public {
        ReentrantRouter rr = new ReentrantRouter(IERC20(address(usdc)), RATE);
        usdc.mint(address(rr), 1_000e6);
        vm.startPrank(owner);
        exit.setRouter(address(rr), true);
        exit.setKeeper(address(rr)); // worst case: the router is also the keeper
        vm.stopPrank();

        uint256 id1 = _arm(alice, meme, 100e18, 500);
        uint256 id2 = _arm(alice, meme, 100e18, 500);
        meme.mint(alice, 0);
        vm.prank(alice);
        meme.approve(address(exit), 200e18);
        rr.setTarget(address(exit), id2);

        bytes memory data = abi.encodeCall(MockRouter.swap, (address(meme), 100e18, address(exit)));
        bytes memory inner = abi.encodeWithSelector(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        vm.prank(address(rr));
        vm.expectRevert(abi.encodeWithSelector(WingmanExit.RouterCallFailed.selector, inner));
        exit.fire(id1, address(rr), data, 200e6, TX, crew);
        assertEq(meme.balanceOf(alice), 1_000e18);
    }

    // ------------------------------------------------------------------ admin

    function test_adminOnlyOwner() public {
        vm.startPrank(attacker);
        vm.expectRevert();
        exit.setKeeper(attacker);
        vm.expectRevert();
        exit.setRouter(address(router), false);
        vm.expectRevert();
        exit.setTreasury(attacker);
        vm.stopPrank();

        vm.prank(owner);
        exit.setKeeper(bob);
        assertEq(exit.keeper(), bob);
        vm.prank(owner);
        exit.setRouter(address(router), false);
        assertFalse(exit.routerAllowed(address(router)));
    }
}
