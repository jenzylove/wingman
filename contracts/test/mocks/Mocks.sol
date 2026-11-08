// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private immutable _dec;

    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) {
        _dec = d;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Burns 1% of every transfer (fee on transfer token).
contract MockFeeToken is MockERC20 {
    constructor() MockERC20("Fee Token", "FEE", 18) {}

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 burnAmt = value / 100;
            super._update(from, address(0), burnAmt);
            super._update(from, to, value - burnAmt);
        } else {
            super._update(from, to, value);
        }
    }
}

/// @notice Swaps any token to USDC at `rate` (USDC units per 1e18 token units).
contract MockRouter {
    IERC20 public immutable usdc;
    uint256 public rate;

    constructor(IERC20 usdc_, uint256 rate_) {
        usdc = usdc_;
        rate = rate_;
    }

    function setRate(uint256 r) external {
        rate = r;
    }

    /// @notice Pull `amountIn` of tokenIn from the caller, pay USDC to `recipient`.
    function swap(address tokenIn, uint256 amountIn, address recipient) public virtual returns (uint256 out) {
        uint256 before = IERC20(tokenIn).balanceOf(address(this));
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        uint256 got = IERC20(tokenIn).balanceOf(address(this)) - before;
        out = (got * rate) / 1e18;
        usdc.transfer(recipient, out);
    }

    /// @notice Tries to pull USDC from the caller (used to prove it cannot).
    function pullUsdc(address from, address to, uint256 amount) external {
        usdc.transferFrom(from, to, amount);
    }

    /// @notice Pays nothing at all.
    function noop() external {}
}

interface IFire {
    function fire(uint256, address, bytes calldata, uint256, bytes32, address) external returns (uint256);
}

/// @notice A router that tries to call back into WingmanExit during the swap.
contract ReentrantRouter is MockRouter {
    address public target;
    uint256 public reenterId;
    bool public attempted;

    constructor(IERC20 usdc_, uint256 rate_) MockRouter(usdc_, rate_) {}

    function setTarget(address t, uint256 id) external {
        target = t;
        reenterId = id;
    }

    function swap(address tokenIn, uint256 amountIn, address recipient) public override returns (uint256 out) {
        attempted = true;
        bytes memory data = abi.encodeWithSelector(MockRouter.swap.selector, tokenIn, amountIn, recipient);
        IFire(target).fire(reenterId, address(this), data, 1e6, bytes32(0), address(0));
        return super.swap(tokenIn, amountIn, recipient);
    }
}
