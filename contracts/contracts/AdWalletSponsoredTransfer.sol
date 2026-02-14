// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AdWalletSponsoredTransfer
 * @notice 사용자 지갑에서 코인을 출금하고, 스폰서(AD WALLET)가 가스비만 대납하는 메타트랜잭션 컨트랙트
 * 
 * 동작 방식:
 * 1. 사용자가 트랜잭션에 서명 (EIP-712)
 * 2. 스폰서가 서명을 검증하고 컨트랙트 호출 (가스비 지불)
 * 3. 컨트랙트가 사용자 지갑에서 코인을 빼서 받는 사람에게 전송
 */
contract AdWalletSponsoredTransfer is EIP712 {
    using SafeERC20 for IERC20;

    bytes32 private constant TRANSFER_TYPEHASH =
        keccak256(
            "Transfer(address from,address to,uint256 amount,address token,uint256 chainId,uint256 nonce)"
        );

    // 사용자별 nonce (재사용 방지)
    mapping(address => uint256) public nonces;

    // 관리자 주소 (예치 권한)
    address public admin;

    // 네이티브 토큰 전송을 위한 공유 예치 풀 (관리자가 예치한 자금)
    uint256 public nativeDepositPool;

    // 이벤트
    event NativeDeposited(address indexed admin, uint256 amount);
    event SponsoredTransfer(
        address indexed from,
        address indexed to,
        uint256 amount,
        address token,
        uint256 nonce
    );

    constructor(address _admin) EIP712("AdWalletSponsoredTransfer", "1") {
        require(_admin != address(0), "Admin address cannot be zero");
        admin = _admin;
    }

    /**
     * @notice 관리자가 네이티브 토큰을 컨트랙트에 예치 (공유 풀)
     * @dev 관리자만 호출 가능
     */
    function depositNative() external payable {
        require(msg.sender == admin, "Only admin can deposit");
        require(msg.value > 0, "Amount must be greater than 0");
        nativeDepositPool += msg.value;
        emit NativeDeposited(msg.sender, msg.value);
    }

    /**
     * @notice 스폰서가 호출: 서명 검증 후 사용자 지갑에서 코인을 빼서 전송
     * @param from 사용자 지갑 주소
     * @param to 받는 주소
     * @param amount 전송할 수량 (wei 단위)
     * @param token 토큰 주소 (0x0이면 네이티브)
     * @param chainId 체인 ID
     * @param nonce 사용자 nonce
     * @param signature 사용자 서명
     */
    function executeSponsoredTransfer(
        address from,
        address to,
        uint256 amount,
        address token,
        uint256 chainId,
        uint256 nonce,
        bytes calldata signature
    ) external {
        // nonce 검증 (재사용 방지)
        require(nonces[from] == nonce, "Invalid nonce");

        // 서명 검증
        bytes32 structHash = keccak256(
            abi.encode(TRANSFER_TYPEHASH, from, to, amount, token, chainId, nonce)
        );
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, signature);
        require(signer == from, "Invalid signature");

        // nonce 증가
        nonces[from]++;

        if (token == address(0)) {
            // 네이티브 토큰 전송: 공유 풀에서 차감
            require(nativeDepositPool >= amount, "Insufficient native deposit pool");
            require(address(this).balance >= amount, "Contract balance insufficient");
            
            // 풀에서 차감
            nativeDepositPool -= amount;
            
            // 실제 전송 (실패 시 revert)
            (bool success, ) = payable(to).call{value: amount}("");
            if (!success) {
                // 실패 시 롤백
                nativeDepositPool += amount;
                revert("Native transfer failed");
            }
        } else {
            // ERC20 토큰 전송: 사용자 지갑에서 차감
            uint256 allowance = IERC20(token).allowance(from, address(this));
            require(allowance >= amount, "Insufficient allowance");
            IERC20(token).safeTransferFrom(from, to, amount);
        }

        emit SponsoredTransfer(from, to, amount, token, nonce);
    }

    /**
     * @notice 관리자가 예치한 네이티브 토큰을 출금 (환불)
     */
    function withdrawNative(uint256 amount) external {
        require(msg.sender == admin, "Only admin can withdraw");
        require(nativeDepositPool >= amount, "Insufficient balance");
        nativeDepositPool -= amount;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @notice 공유 예치 풀 잔액 조회
     */
    function getNativeDepositPool() external view returns (uint256) {
        return nativeDepositPool;
    }
}
