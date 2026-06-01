# AdMob 값 — 어디에 넣는지 (AD-GAS)

같은 퍼블리셔 번호라도 **형식별로 들어가는 파일이 완전히 다릅니다.** 한 번만 맞춰 두면 됩니다.

## 표: 무엇을 어디에

| 종류 | 형식 예 | 넣는 곳 |
|------|---------|---------|
| **Android 애플리케이션 ID** | `ca-app-pub-xxxxxxxx~yyyyyyyyyy` (**물결 `~`**) | `mobile/android/app/src/main/res/values/strings.xml`<br/>→ **반드시** `<string name="admob_app_id">값</string>`<br/>(`name`에 ID 문자열 넣기 금지) |
| **Android 메인페스트 연결** | (직접 ID 안 적음) | `mobile/android/app/src/main/AndroidManifest.xml`<br/>→ `com.google.android.gms.ads.APPLICATION_ID` = `@string/admob_app_id` (레포에 이미 연결됨) |
| **iOS 애플리케이션 ID** | `ca-app-pub-…​~…​` (**iOS 앱 등록 시 콘솔에 나오는 값**) | `mobile/ios/App/App/Info.plist`<br/>→ 키 `GADApplicationIdentifier`<br/>**Android 앱 ID를 여기 넣으면 안 됨.** AdMob에서 iOS 앱을 따로 만들고 그 앱의 ID를 넣음. |
| **리워드 광고 단위 ID** | `ca-app-pub-xxxxxxxx/zzzzzzzzzz` (**슬래시 `/`**) | **배포된 Next 빌드** 환경 변수 (Vercel 등) **+** 로컬 `web/frontend/.env.local`<br/>→ `NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID` (공통 또는 기본값)<br/>→ (선택) `NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID_ANDROID`<br/>→ (선택) `NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID_IOS` |
| **테스트 광고 모드** | `true` / `false` | 같은 곳 → `NEXT_PUBLIC_ADMOB_USE_TEST_ADS` |
| **Capacitor 네이티브 동기화** | — | AdMob/Splash 등 바꾼 뒤: `cd mobile && npx cap sync` (또는 `android`만) |

## 코드에서 쓰는 방식 (참고)

- **앱 ID(`~`)**는 JS `NEXT_PUBLIC_*`로 넣지 않습니다. Android는 `strings.xml`, iOS는 `Info.plist`에서 Mobile Ads SDK가 읽습니다.
- **리워드 단위(`/`)**만 `process.env.NEXT_PUBLIC_ADMOB_*`로 번들에 들어갑니다. 앱이 `server.url`로 원격 사이트를 뜨우므로 **Vercel에도** 동일하게 넣어야 실기기에서 동작합니다.
- 앱 안에서 `AdMob.initialize`는 `web/frontend/src/components/adgasfe/GaslessApp.tsx`에서 호출합니다. 앱 ID는 위 네이티브 설정을 따릅니다.

## 자주 틀리는 것

- `strings.xml`에서 `name="ca-app-pub-…​~…​"` 처럼 **이름 자리에 ID 넣기** → 잘못됨. **`name`은 항상 `admob_app_id`**.
- 앱 ID와 단위 ID 뒤바꾸기 → 앱 ID는 `~`, 단위는 `/`.

관련: [ADS_APP_FIRST_KO.md](./ADS_APP_FIRST_KO.md), `mobile/README.md`.
