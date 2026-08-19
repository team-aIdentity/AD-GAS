# AD-GAS 하이브리드 가스리스 POC

AD-GAS는 사용자 계정이나 개인키를 보관하지 않고, 기존 EOA 지갑의 ERC-20 전송 가스만 광고 수익으로 대납한다.

## 토큰별 전송 경로

1. **EIP-3009**
   - 사용자가 `TransferWithAuthorization` EIP-712 메시지에 한 번 서명한다.
   - 릴레이어가 토큰의 `transferWithAuthorization`을 직접 실행한다.
   - 토큰 컨트랙트가 `bytes32` authorization nonce를 온체인에서 소비하므로 별도 사용자 DB가 필요 없다.
   - 최초 전송부터 네이티브 가스가 필요 없다.

2. **EIP-2612**
   - 사용자가 Permit 서명과 AD-GAS 전송 의사 서명을 승인한다.
   - 릴레이어가 `executeSponsoredTransferWithPermit`을 실행한다.
   - AD-GAS 컨트랙트의 사용자별 nonce가 재사용을 방지한다.
   - 최초 전송부터 네이티브 가스가 필요 없다.

3. **일반 ERC-20**
   - 사용자가 최초 1회 AD-GAS 컨트랙트에 `approve`한다. 이 트랜잭션의 네이티브 가스는 사용자가 부담한다.
   - 이후 사용자는 AD-GAS 전송 의사만 서명하고 릴레이어가 `executeSponsoredTransfer`를 실행한다.
   - AD-GAS 컨트랙트의 사용자별 nonce가 재사용을 방지한다.

## 현재 capability 설정

- Base USDC: EIP-3009 우선
- Avalanche USDC: EIP-3009 우선
- Base AERO/SBMB/LDT: EIP-2612
- GIWA FAUCET: EIP-2612 (`FaucetToken`, Permit 도메인 버전 `1` 고정)
- 그 외 등록 토큰: 최초 approve 후 allowance 경로
- GIWA 환경변수 USDC: `NEXT_PUBLIC_GIWA_SEPOLIA_USDC_AUTH_MODE`로 실제 토큰 구현에 맞게 명시

지원 방식은 심볼만 보고 추정하지 않는다. 새 토큰을 등록할 때 실제 컨트랙트의 `authorizationState` 또는 `nonces`/`DOMAIN_SEPARATOR`를 RPC에서 확인한 후 capability를 설정한다.

## 최소 서버 상태

- 사용자 계정/개인키 DB: 없음
- 재사용 방지: 토큰 EIP-3009 nonce 또는 AD-GAS 컨트랙트 nonce
- 릴레이어 서버: 사용자 서명 사전검증, 시뮬레이션, 트랜잭션 제출
- 일일 제한: 현재 POC는 인스턴스 메모리 기반이며 운영 단계에서는 서명된 광고 티켓 또는 공유 KV로 교체한다.

## POC 보안 경계

현재 릴레이 API는 사용자 서명과 온체인 nonce를 검증하지만, 광고 완료 사실을 암호학적으로 증명하는 서버 발급 티켓은 아직 요구하지 않는다. 따라서 POC 외부 공개 전에 AdMob SSV 또는 광고 서버가 발급한 짧은 만료 시간의 1회용 티켓을 릴레이 요청에 결합해야 한다. 이 티켓에는 지갑 주소, 체인, 토큰, 수량, 수신자, 만료 시간과 고유 nonce를 포함하고 서버에서 검증·소비한다.
