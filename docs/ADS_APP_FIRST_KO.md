# 광고·수익: 앱 우선 (Android)

AdSense / Ad Manager 승인이 지연되는 동안 **Android 앱(AdMob 리워드)** 을 우선 채워 두고, **웹 GPT 리워드**는 선택 사항으로 둡니다.

## 현재 레포 동작

| 실행 환경 | 리워드 영상 소스 |
|-----------|------------------|
| **Chrome 등 브라우저** | `NEXT_PUBLIC_GOOGLE_REWARDED_AD_SLOT` (Ad Manager GPT) · 미설정 시 데모 카운트다운 |
| **Capacitor Android 앱**(WebView) | AdMob 리워드 · `NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID` 등 (원격 로드되는 Next 번들 기준으로 판별) |

`WebOnlyAdSenseScript` 등 **디스플레이 AdSense**는 네이티브 앱에서는 로드하지 않습니다.

## Android 앱 우선 할 일

1. [AdMob](https://admob.google.com/) — Android 앱 등록 후 **리워드** 광고 단위 생성  
2. `mobile/android/.../values/strings.xml` 의 **`admob_app_id`** 를 콘솔 앱 ID로 교체(샘플 ID는 테스트용)  
3. **배포된 Next**(예: Vercel) 환경 변수에  
   - `NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID`  
   - Android만 따로 줄 경우 `NEXT_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID_ANDROID`  
   - 테스트: `NEXT_PUBLIC_ADMOB_USE_TEST_ADS=true`  
4. `cd mobile && npx cap sync android` 후 Android Studio로 빌드

## 웹(GPT)·Ad Manager은 나중에

- **`NEXT_PUBLIC_GOOGLE_REWARDED_AD_SLOT`** — 승인·계정 활성 후 설정해도 됨  
- 별도 작업 불필요: 비어 있어도 앱은 AdMob 경로만 사용

**값 종류별·파일별 정리표:** [ADMOB_WHERE_KO.md](./ADMOB_WHERE_KO.md) · 세부 동작은 `mobile/README.md`.
