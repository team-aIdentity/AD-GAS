// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IPaymaster.sol";
import "./UserOperation.sol";

/**
 * A simple paymaster that allows a single signer (the "paymaster signer") to authorize it to pay for a user operation.
 * The paymaster signer is distinct from the paymaster's owner, which can withdraw funds and change the signer.
 */
contract VerifyingPaymaster is IPaymaster {
    address public owner;
    address public entryPoint;
    address public paymasterSigner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    constructor(address _entryPoint, address _initialSigner) {
        entryPoint = _entryPoint;
        owner = msg.sender;
        paymasterSigner = _initialSigner;
    }

    function setSigner(address _newSigner) public onlyOwner {
        paymasterSigner = _newSigner;
    }

    function getHash(UserOperation calldata userOp, uint256 validUntil, uint256 validAfter) public view returns (bytes32) {
        return keccak256(abi.encode(
            userOp,
            validUntil,
            validAfter,
            block.chainid,
            address(this)
        ));
    }

    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external override returns (bytes memory context, uint256 validationData) {
        (uint256 validUntil, uint256 validAfter, bytes memory signature) = abi.decode(userOp.paymasterAndData[20:], (uint256, uint256, bytes));
        
        bytes32 hash = getHash(userOp, validUntil, validAfter);
        address recoveredSigner = recoverSigner(hash, signature);
        
        require(recoveredSigner == paymasterSigner, "Invalid signature");
        require(block.timestamp <= validUntil, "Transaction expired");
        require(block.timestamp >= validAfter, "Transaction not yet valid");

        // For this simple paymaster, the context is empty.
        context = "";

        // A combination of validUntil and validAfter timestamps.
        validationData = (validUntil << 128) | validAfter;

        return (context, validationData);
    }

    function recoverSigner(bytes32 _hash, bytes memory _signature) internal pure returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;
        if (_signature.length != 65) {
            return address(0);
        }
        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }
        return ecrecover(_hash, v, r, s);
    }

    function postOp(
        PostOpMode,
        bytes calldata,
        uint256
    ) external pure override {
        // No-op
    }

    function deposit() public payable {
        IEntryPointMinimal(entryPoint).depositTo{value: msg.value}(address(this));
    }

    function withdrawTo(address payable _addr, uint256 _amount) public onlyOwner {
        _addr.transfer(_amount);
    }

    function unlockStake() public {
        // Implement stake unlocking logic if needed, depends on EntryPoint version
    }

    function lockStake(uint256 _amount) public {
        // Implement stake locking logic if needed, depends on EntryPoint version
    }
}
