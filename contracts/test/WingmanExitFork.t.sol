// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {WingmanExit, IWingmanPool} from "../src/WingmanExit.sol";
import {WingmanPool} from "../src/WingmanPool.sol";

/// @notice Real swap through the KyberSwap router on a Base mainnet fork, with calldata
/// built live by the KyberSwap API for the WingmanExit address.
/// Skipped unless BASE_RPC is set. Run with:
///   FOUNDRY_PROFILE=fork BASE_RPC=https://base-rpc.publicnode.com forge test --match-contract Fork -vv
contract WingmanExitForkTest is Test {
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant VIBES = 0xefFC8815487084a97edfdfF968b56Ea123421Acb;
    address constant KYBER = 0x6131B5fae19EA4f9D964eAc0408E4408b66337b5;
    address constant UNIVERSAL_ROUTER = 0x6fF5693b99212Da76ad316178A184AB56D299b43;

    function test_realKyberSwapOnBaseFork() public {
        string memory rpc = vm.envOr("BASE_RPC", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);

        address owner = makeAddr("owner");
        address keeper = makeAddr("keeper");
        address treasury = makeAddr("treasury");
        address alice = makeAddr("alice");

        WingmanPool pool = new WingmanPool(IERC20(VIBES), IERC20(USDC), treasury, owner);
        address[] memory routers = new address[](2);
        routers[0] = KYBER;
        routers[1] = UNIVERSAL_ROUTER;
        WingmanExit exit = new WingmanExit(
            IERC20(USDC), IERC20(VIBES), IWingmanPool(address(pool)), treasury, keeper, owner, routers
        );

        uint256 amount = 0.01 ether;
        deal(WETH, alice, amount);
        vm.startPrank(alice);
        IERC20(WETH).approve(address(exit), amount);
        uint256 id = exit.arm(WETH, amount, 500);
        vm.stopPrank();

        string[] memory cmd = new string[](7);
        cmd[0] = "node";
        cmd[1] = "script/kyber-route.mjs";
        cmd[2] = vm.toString(WETH);
        cmd[3] = vm.toString(USDC);
        cmd[4] = vm.toString(amount);
        cmd[5] = vm.toString(address(exit));
        cmd[6] = "300";
        (address router, bytes memory data, uint256 quotedOut) = abi.decode(vm.ffi(cmd), (address, bytes, uint256));
        assertEq(router, KYBER, "api returned a different router");
        console2.log("quoted USDC out", quotedOut);

        vm.prank(keeper);
        uint256 toOwner = exit.fire(id, router, data, quotedOut, keccak256("fork"), address(0xBEEF));

        console2.log("USDC to owner", toOwner);
        console2.log("treasury fee", IERC20(USDC).balanceOf(treasury));
        assertEq(IERC20(WETH).balanceOf(alice), 0);
        assertEq(IERC20(USDC).balanceOf(alice), toOwner);
        assertGt(toOwner, (quotedOut * 9_500) / 10_000 * 995 / 1000 - 1);
        assertEq(IERC20(USDC).balanceOf(address(exit)), 0);
        assertEq(IERC20(WETH).balanceOf(address(exit)), 0);
        assertEq(IERC20(WETH).allowance(address(exit), KYBER), 0);
    }
}
