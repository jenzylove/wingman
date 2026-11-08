// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IWingmanPool {
    function staked(address user) external view returns (uint256);
    function notifyReward(uint256 amount) external;
}

/// @title WingmanExit
/// @notice A user approves a token to this contract and arms an exit. When the
/// caller's crew starts selling, the keeper fires the exit: this contract pulls
/// at most the armed amount, sells it through an allowlisted router, and sends
/// the USDC to the arm owner. The keeper can never withdraw or redirect funds.
contract WingmanExit is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // Base mainnet references (the deploy script passes these in).
    address public constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address public constant BASE_VIBES = 0xefFC8815487084a97edfdfF968b56Ea123421Acb;
    address public constant KYBER_META_ROUTER_V2 = 0x6131B5fae19EA4f9D964eAc0408E4408b66337b5;
    address public constant UNISWAP_UNIVERSAL_ROUTER = 0x6fF5693b99212Da76ad316178A184AB56D299b43;

    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_SLIPPAGE_BPS = 3_000;
    uint256 public constant FEE_BPS = 50; // 0.5%
    uint256 public constant POOL_SHARE_PCT = 30; // 30% of the fee to stakers, 70% to treasury
    uint256 public constant FEE_EXEMPT_VIBES = 100_000e18;

    IERC20 public immutable usdc;
    IERC20 public immutable vibes;
    IWingmanPool public immutable pool;

    address public treasury;
    address public keeper;
    mapping(address => bool) public routerAllowed;

    struct Arm {
        address owner;
        address token;
        uint256 amount;
        uint256 minUsdcOut; // owner set price floor for the whole sale, 0 means none
        uint16 maxSlippageBps;
        bool active;
        uint64 armedAt;
    }

    uint256 public nextId = 1;
    mapping(uint256 => Arm) public arms;
    mapping(address => uint256[]) private _armIds;

    event Armed(
        uint256 indexed id,
        address indexed owner,
        address indexed token,
        uint256 amount,
        uint16 maxSlippageBps,
        uint256 minUsdcOut
    );
    event Cancelled(uint256 indexed id, address indexed owner);
    event Fired(
        uint256 indexed id,
        address indexed owner,
        address indexed token,
        uint256 sold,
        uint256 usdcOut,
        uint256 fee,
        address triggerWallet,
        bytes32 triggerTx
    );
    event KeeperSet(address keeper);
    event TreasurySet(address treasury);
    event RouterSet(address router, bool allowed);

    error NotKeeper();
    error NotArmOwner();
    error NotActive();
    error BadToken();
    error ZeroAmount();
    error ZeroAddress();
    error SlippageTooHigh();
    error AllowanceTooLow();
    error RouterNotAllowed();
    error NothingToSell();
    error BadQuote();
    error RouterCallFailed(bytes reason);
    error TokenBalanceDecreased();
    error UsdcBalanceDecreased();
    error InsufficientOutput(uint256 got, uint256 minOut);

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    constructor(
        IERC20 usdc_,
        IERC20 vibes_,
        IWingmanPool pool_,
        address treasury_,
        address keeper_,
        address owner_,
        address[] memory routers
    ) Ownable(owner_) {
        if (
            address(usdc_) == address(0) || address(vibes_) == address(0) || address(pool_) == address(0)
                || treasury_ == address(0) || keeper_ == address(0)
        ) revert ZeroAddress();
        usdc = usdc_;
        vibes = vibes_;
        pool = pool_;
        treasury = treasury_;
        keeper = keeper_;
        emit TreasurySet(treasury_);
        emit KeeperSet(keeper_);
        for (uint256 i; i < routers.length; ++i) {
            _setRouter(routers[i], true);
        }
    }

    // ------------------------------------------------------------- user side

    /// @notice Arm an exit with no price floor beyond keeper quote and slippage.
    function arm(address token, uint256 amount, uint16 maxSlippageBps) external nonReentrant returns (uint256) {
        return _arm(token, amount, maxSlippageBps, 0);
    }

    /// @notice Arm an exit with a hard USDC floor for the whole sale. The keeper
    /// can never fill below this, whatever quote it passes.
    function armWithFloor(address token, uint256 amount, uint16 maxSlippageBps, uint256 minUsdcOut)
        external
        nonReentrant
        returns (uint256)
    {
        return _arm(token, amount, maxSlippageBps, minUsdcOut);
    }

    function cancel(uint256 id) external nonReentrant {
        Arm storage a = arms[id];
        if (a.owner != msg.sender) revert NotArmOwner();
        if (!a.active) revert NotActive();
        a.active = false;
        emit Cancelled(id, msg.sender);
    }

    // ----------------------------------------------------------- keeper side

    /// @notice Sell an armed position. Proceeds can only go to the arm owner.
    /// @param quotedOut USDC the router quote promised for the armed amount.
    function fire(
        uint256 id,
        address router,
        bytes calldata data,
        uint256 quotedOut,
        bytes32 triggerTx,
        address triggerWallet
    ) external onlyKeeper nonReentrant returns (uint256 usdcToOwner) {
        Arm storage a = arms[id];
        if (!a.active) revert NotActive();
        a.active = false;
        if (!routerAllowed[router]) revert RouterNotAllowed();

        uint256 minOut = (quotedOut * (BPS - a.maxSlippageBps)) / BPS;
        if (minOut == 0) revert BadQuote();
        if (minOut < a.minUsdcOut) minOut = a.minUsdcOut;

        address owner_ = a.owner;
        address token = a.token;

        (uint256 tokenBefore, uint256 received) = _pull(owner_, token, a.amount);
        (uint256 sold, uint256 unspent, uint256 usdcOut) = _swap(token, router, data, tokenBefore, received);
        if (usdcOut < minOut) revert InsufficientOutput(usdcOut, minOut);

        if (unspent > 0) IERC20(token).safeTransfer(owner_, unspent);

        uint256 fee;
        (fee, usdcToOwner) = _payout(owner_, usdcOut);

        emit Fired(id, owner_, token, sold, usdcOut, fee, triggerWallet, triggerTx);
    }

    /// @dev Pull min(armed amount, owner balance, allowance). Returns the real amount received.
    function _pull(address owner_, address token, uint256 armed)
        private
        returns (uint256 tokenBefore, uint256 received)
    {
        IERC20 t = IERC20(token);
        uint256 pullAmt = armed;
        uint256 bal = t.balanceOf(owner_);
        if (bal < pullAmt) pullAmt = bal;
        uint256 allow = t.allowance(owner_, address(this));
        if (allow < pullAmt) pullAmt = allow;
        if (pullAmt == 0) revert NothingToSell();

        tokenBefore = t.balanceOf(address(this));
        t.safeTransferFrom(owner_, address(this), pullAmt);
        received = t.balanceOf(address(this)) - tokenBefore;
        if (received == 0) revert NothingToSell();
    }

    /// @dev Approve exactly `received` to the router, call it, reset the approval,
    /// then measure both sides by balance deltas.
    function _swap(address token, address router, bytes calldata data, uint256 tokenBefore, uint256 received)
        private
        returns (uint256 sold, uint256 unspent, uint256 usdcOut)
    {
        IERC20 t = IERC20(token);
        uint256 usdcBefore = usdc.balanceOf(address(this));

        t.forceApprove(router, received);
        (bool ok, bytes memory ret) = router.call(data);
        if (!ok) revert RouterCallFailed(ret);
        t.forceApprove(router, 0);

        // Token side: the router may spend at most what was pulled for this arm.
        uint256 tokenAfter = t.balanceOf(address(this));
        if (tokenAfter < tokenBefore) revert TokenBalanceDecreased();
        unspent = tokenAfter - tokenBefore;
        if (unspent > received) unspent = received;
        sold = received - unspent;

        // USDC side: only what actually arrived here counts.
        uint256 usdcAfter = usdc.balanceOf(address(this));
        if (usdcAfter < usdcBefore) revert UsdcBalanceDecreased();
        usdcOut = usdcAfter - usdcBefore;
    }

    /// @dev Take the fee (30% to stakers, 70% to treasury) unless exempt, send the rest to the owner.
    function _payout(address owner_, uint256 usdcOut) private returns (uint256 fee, uint256 toOwner) {
        if (!feeExempt(owner_)) {
            fee = (usdcOut * FEE_BPS) / BPS;
            uint256 poolCut = (fee * POOL_SHARE_PCT) / 100;
            uint256 treasuryCut = fee - poolCut;
            if (poolCut > 0) {
                usdc.forceApprove(address(pool), poolCut);
                pool.notifyReward(poolCut);
                usdc.forceApprove(address(pool), 0);
            }
            if (treasuryCut > 0) usdc.safeTransfer(treasury, treasuryCut);
        }
        toOwner = usdcOut - fee;
        usdc.safeTransfer(owner_, toOwner);
    }

    // ------------------------------------------------------------------ views

    /// @notice True when the owner holds plus stakes at least 100,000 VIBES.
    function feeExempt(address user) public view returns (bool) {
        return vibes.balanceOf(user) + pool.staked(user) >= FEE_EXEMPT_VIBES;
    }

    function armCount(address user) external view returns (uint256) {
        return _armIds[user].length;
    }

    function armIdsOf(address user, uint256 offset, uint256 limit) external view returns (uint256[] memory ids) {
        uint256[] storage all = _armIds[user];
        if (offset >= all.length) return new uint256[](0);
        uint256 end = offset + limit;
        if (end > all.length) end = all.length;
        ids = new uint256[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            ids[i - offset] = all[i];
        }
    }

    // ------------------------------------------------------------------ admin

    function setKeeper(address keeper_) external onlyOwner {
        if (keeper_ == address(0)) revert ZeroAddress();
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setRouter(address router, bool allowed) external onlyOwner {
        _setRouter(router, allowed);
    }

    // --------------------------------------------------------------- internal

    function _setRouter(address router, bool allowed) internal {
        // A token or the pool can never be a "router", so fire can never call transfer on them.
        if (router == address(0) || router == address(usdc) || router == address(vibes) || router == address(pool)) {
            revert BadToken();
        }
        if (router.code.length == 0) revert ZeroAddress();
        routerAllowed[router] = allowed;
        emit RouterSet(router, allowed);
    }

    function _arm(address token, uint256 amount, uint16 maxSlippageBps, uint256 minUsdcOut)
        internal
        returns (uint256 id)
    {
        if (token == address(0) || token == address(usdc) || token.code.length == 0) revert BadToken();
        if (amount == 0) revert ZeroAmount();
        if (maxSlippageBps > MAX_SLIPPAGE_BPS) revert SlippageTooHigh();
        if (IERC20(token).allowance(msg.sender, address(this)) < amount) revert AllowanceTooLow();

        id = nextId++;
        arms[id] = Arm({
            owner: msg.sender,
            token: token,
            amount: amount,
            minUsdcOut: minUsdcOut,
            maxSlippageBps: maxSlippageBps,
            active: true,
            armedAt: uint64(block.timestamp)
        });
        _armIds[msg.sender].push(id);
        emit Armed(id, msg.sender, token, amount, maxSlippageBps, minUsdcOut);
    }
}
