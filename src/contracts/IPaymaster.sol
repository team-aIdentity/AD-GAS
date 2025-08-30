// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UserOperation} from "./UserOperation.sol";

interface IPaymaster {
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);

    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external;
}

// Minimal entrypoint interface needed for postOp mode decoding
interface IEntryPointMinimal {
    function depositTo(address account) external payable;
}

enum PostOpMode {
    opSucceeded,
    opReverted,
    postOpReverted
}

// A "marker" library for userOp validation and execution functions
library ExecutionManager {
    // The version of this library.
    // The major version is the first byte, minor second byte, and patch third byte.
    string public constant VERSION = "1.0.0";
}
