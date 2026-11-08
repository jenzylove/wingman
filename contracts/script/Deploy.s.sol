// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {WingmanExit, IWingmanPool} from "../src/WingmanExit.sol";
import {WingmanPool} from "../src/WingmanPool.sol";

/// Deploys WingmanPool then WingmanExit on Base mainnet.
/// The signer comes from a Foundry keystore account, never a raw key:
///   cast wallet import wingman-deployer --interactive
///   KEEPER=0x... TREASURY=0x... forge script script/Deploy.s.sol \
///     --rpc-url https://mainnet.base.org --account wingman-deployer --broadcast
/// Optional: OWNER=0x... (defaults to the deployer).
contract Deploy is Script {
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant VIBES = 0xefFC8815487084a97edfdfF968b56Ea123421Acb;
    address constant KYBER_META_ROUTER_V2 = 0x6131B5fae19EA4f9D964eAc0408E4408b66337b5;
    address constant UNISWAP_UNIVERSAL_ROUTER = 0x6fF5693b99212Da76ad316178A184AB56D299b43;

    function run() external returns (WingmanPool pool, WingmanExit exit) {
        require(block.chainid == 8453, "not Base mainnet");
        address keeper = vm.envAddress("KEEPER");
        address treasury = vm.envAddress("TREASURY");

        vm.startBroadcast();
        address owner = vm.envOr("OWNER", msg.sender);

        pool = new WingmanPool(IERC20(VIBES), IERC20(USDC), treasury, owner);

        address[] memory routers = new address[](2);
        routers[0] = KYBER_META_ROUTER_V2;
        routers[1] = UNISWAP_UNIVERSAL_ROUTER;
        exit = new WingmanExit(IERC20(USDC), IERC20(VIBES), IWingmanPool(address(pool)), treasury, keeper, owner, routers);
        vm.stopBroadcast();

        console2.log("WingmanPool", address(pool));
        console2.log("WingmanExit", address(exit));
        console2.log("owner", owner);
        console2.log("keeper", keeper);
        console2.log("treasury", treasury);
    }
}
