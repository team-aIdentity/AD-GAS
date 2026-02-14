// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * 형태 1: 광고 시청 시 가스비 대납 Paymaster (EIP-4337)
 * - validatePaymasterUserOp: 가스 한도·화이트리스트·일시정지 검증 후 대납 허용
 * - postOp: 실제 소비 가스비 정산
 */
contract AdSponsorPaymaster is Ownable, ReentrancyGuard, Pausable {
    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }

    enum PostOpMode {
        opSucceeded,
        opReverted,
        postOpReverted
    }

    IEntryPoint public immutable entryPoint;

    /// @notice 호출당 최대 가스비 (wei). 초과 시 대납 거부
    uint256 public maxCostPerUserOp = 0.1 ether;

    /// @notice 일일 가스비 한도 (wei). 0이면 미적용
    uint256 public dailyGasLimit;
    uint256 public dailyGasUsed;
    uint256 public lastResetDay;

    /// @notice 화이트리스트: true면 해당 sender만 대납
    bool public whitelistEnabled;
    mapping(address => bool) public whitelist;

    event MaxCostPerUserOpUpdated(uint256 oldVal, uint256 newVal);
    event DailyGasLimitUpdated(uint256 oldVal, uint256 newVal);
    event WhitelistEnabledUpdated(bool enabled);
    event WhitelistUpdated(address indexed account, bool allowed);
    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    constructor(address _entryPoint) Ownable(msg.sender) {
        entryPoint = IEntryPoint(_entryPoint);
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice EntryPoint에 예치 (가스 대납에 사용)
    function deposit() external payable onlyOwner {
        entryPoint.depositTo{value: msg.value}(address(this));
        emit Deposited(msg.sender, msg.value);
    }

    function withdrawTo(address payable to, uint256 amount) external onlyOwner nonReentrant {
        entryPoint.withdrawTo(to, amount);
        emit Withdrawn(to, amount);
    }

    function addStake(uint32 unstakeDelaySec) external payable onlyOwner {
        entryPoint.addStake{value: msg.value}(unstakeDelaySec);
    }

    function unlockStake() external onlyOwner {
        entryPoint.unlockStake();
    }

    function withdrawStake(address payable to) external onlyOwner {
        entryPoint.withdrawStake(to);
    }

    // ---------- 형태 1 정책 ----------

    function setMaxCostPerUserOp(uint256 _maxCostPerUserOp) external onlyOwner {
        uint256 old = maxCostPerUserOp;
        maxCostPerUserOp = _maxCostPerUserOp;
        emit MaxCostPerUserOpUpdated(old, _maxCostPerUserOp);
    }

    function setDailyGasLimit(uint256 _dailyGasLimit) external onlyOwner {
        uint256 old = dailyGasLimit;
        dailyGasLimit = _dailyGasLimit;
        emit DailyGasLimitUpdated(old, _dailyGasLimit);
    }

    function setWhitelistEnabled(bool _enabled) external onlyOwner {
        whitelistEnabled = _enabled;
        emit WhitelistEnabledUpdated(_enabled);
    }

    function setWhitelist(address account, bool allowed) external onlyOwner {
        whitelist[account] = allowed;
        emit WhitelistUpdated(account, allowed);
    }

    function setWhitelistBatch(address[] calldata accounts, bool allowed) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            whitelist[accounts[i]] = allowed;
            emit WhitelistUpdated(accounts[i], allowed);
        }
    }

    /// @notice EIP-4337: Paymaster 검증. 0 반환 = 성공
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 /*userOpHash*/,
        uint256 maxCost
    ) external view returns (bytes memory context, uint256 validationData) {
        require(!paused(), "AdSponsorPaymaster: paused");

        if (whitelistEnabled && !whitelist[userOp.sender]) {
            return ("", _packValidationData(true, 0, 0)); // reject
        }
        if (maxCost > maxCostPerUserOp) {
            return ("", _packValidationData(true, 0, 0));
        }
        if (dailyGasLimit != 0) {
            uint256 day = block.timestamp / 1 days;
            if (day > lastResetDay) {
                // 새 날짜면 리셋은 postOp/외부에서. 여기선 한도만 검사
            }
            if (dailyGasUsed + maxCost > dailyGasLimit) {
                return ("", _packValidationData(true, 0, 0));
            }
        }
        context = abi.encode(userOp.sender, maxCost);
        validationData = 0; // valid
    }

    /// @notice EIP-4337: 실행 후 정산. 일일 사용량 갱신
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external nonReentrant {
        require(msg.sender == address(entryPoint), "AdSponsorPaymaster: only EntryPoint");
        (address sender, uint256 maxCost) = abi.decode(context, (address, uint256));
        if (mode != PostOpMode.opReverted) {
            uint256 day = block.timestamp / 1 days;
            if (day > lastResetDay) {
                lastResetDay = day;
                dailyGasUsed = 0;
            }
            dailyGasUsed += actualGasCost;
        }
    }

    function _packValidationData(
        bool sigFailed,
        uint48 validAfter,
        uint48 validUntil
    ) internal pure returns (uint256) {
        return uint256(sigFailed ? 1 : 0) | (uint256(validAfter) << 160) | (uint256(validUntil) << (160 + 48));
    }

    function getDeposit() external view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}

interface IEntryPoint {
    function depositTo(address account) external payable;
    function withdrawTo(address payable to, uint256 amount) external;
    function addStake(uint32 unstakeDelaySec) external payable;
    function unlockStake() external;
    function withdrawStake(address payable to) external;
    function balanceOf(address account) external view returns (uint256);
}
