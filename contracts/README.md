# 형태 1 Paymaster 컨트랙트

광고 시청 시 가스비 대납용 EIP-4337 Paymaster (`AdSponsorPaymaster`).

## 요구사항

- **Node.js 20 이상** (Hardhat 2.28이 끌어오는 `@nomicfoundation/edr`가 Node ≥20을 요구함). **18.12 같은 오래된 18.x**에서는 `EBADENGINE` 경고와 함께 동작이 불안정할 수 있음.
- Hardhat **3.x**는 이 레포 설정과 맞지 않음(Node 22.10+, ESM 필수).
- 환경 변수 (배포 시): `PRIVATE_KEY`, `SEPOLIA_RPC_URL` 등

### `npm ERR! ENOSPC` — 디스크 부족

`no space left on device`는 **맥 디스크가 가득 찬 상태**에서 `npm install`이 중간에 깨진 것입니다. 휴지통 비우기, Xcode/iOS 시뮬레이터·Docker 이미지·큰 `node_modules` 정리 등으로 여유 공간을 확보한 뒤:

```bash
cd contracts
rm -rf node_modules
npm cache clean --force   # 선택
npm install
```

### Hardhat 오류: “Hardhat only supports ESM projects” / Node 22.10 요구

로컬에 **Hardhat 3**가 깔린 경우입니다. 이 패키지는 **Hardhat 2.28.4**로 고정되어 있습니다.

```bash
cd contracts
rm -rf node_modules
npm install
npx hardhat --version   # 2.28.x 여야 함
```

그 후 다시 `npm run deploy:sponsored-transfer:giwa-sepolia` 등을 실행하세요.

### `Cannot find module 'fp-ts/lib/Either'` 또는 `validate(...).chain is not a function`

- **Either missing:** `node_modules/fp-ts` 아래에 `lib` 폴더가 없으면 설치가 깨진 것입니다(디스크 부족 등). `rm -rf node_modules && npm install` 로 다시 설치하세요.
- **chain is not a function:** `fp-ts` **2.x**가 올라가면 Hardhat이 쓰는 `io-ts@1`과 맞지 않아 발생합니다. 이 레포는 **`fp-ts@1.19.3`**으로 고정합니다.

```bash
cd contracts
rm -rf node_modules
npm install
npx hardhat --version
```

## 설치 및 컴파일

배포 전 **저장소 기준 `web/contracts`** 디렉터리에서 환경 변수를 둡니다.

```bash
cd web/contracts
cp .env.example .env
# 또는 Next와 동일하게 이 폴더에 .env.local 만 만들어도 됨 (hardhat.config에서 로드)
```

`.env` / `.env.local`에 **`PRIVATE_KEY`** 가 있으면 우선 사용합니다. 없으면 **`web/frontend/.env.local`** 도 읽습니다. GIWA 배포 스크립트 실행 시에는 **`ADWALLET_SPONSOR_PK_GIWA_SEPOLIA`** 만 프론트에 있어도(`NETWORK_NAME=GIWA_SEPOLIA`) 배포 서명용 키로 자동 매핑됩니다.

```bash
cd web/contracts
npm install
npm run compile
```

## 배포 (Sepolia)

```bash
export PRIVATE_KEY=0x...
npm run deploy:sepolia
```

## 정책 설정 (owner)

- `setMaxCostPerUserOp(uint256)`: 호출당 최대 가스비 (wei)
- `setDailyGasLimit(uint256)`: 일일 가스비 한도 (0 = 미적용)
- `setWhitelistEnabled(bool)`: true 시 화이트리스트만 대납
- `setWhitelist(address, bool)` / `setWhitelistBatch`: 허용 주소 설정
- `deposit()`: EntryPoint에 ETH 예치 (가스 대납용)
- `pause()` / `unpause()`: 비상 정지

EntryPoint v0.6 주소: `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`
