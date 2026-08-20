# AD-GAS 광고 보상 검증 운영 설정

## 적용 구조

AD-GAS는 사용자 계정, 이메일, 소셜 로그인 정보, 지갑 개인키를 DB에 저장하지 않습니다.
광고 가스비 대납에 필요한 다음 임시 정보만 Redis TTL로 보관합니다.

- SHA-256으로 해시한 전송 의도(`from`, `to`, 체인, 토큰, 최소단위 금액)
- 무작위 1회용 challenge의 상태(`pending` 또는 `verified`)
- 생성·만료·검증 시각
- 중복 보상 방지용 AdMob `transaction_id`의 SHA-256 해시
- 지갑 주소를 SHA-256 처리한 일일 대납 횟수 키

전송 주소와 금액 원문은 KV에 저장하지 않습니다. 광고 challenge는 기본 10분 후 자동 삭제되고,
릴레이가 실행될 때 일일 한도 증가와 함께 원자적으로 1회 소비됩니다. 실제 토큰 전송의 재사용 방지는
기존 컨트랙트 nonce 또는 EIP-3009 authorization nonce가 담당합니다.

## Vercel 환경 변수

운영(Production)에 아래 값을 설정합니다.

```dotenv
AD_REWARD_SECURITY_MODE=required
AD_REWARD_CHALLENGE_TTL_SECONDS=600
ADMOB_SSV_AD_UNIT_ID=3951197726
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
```

Upstash가 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`을 제공하는 경우 그 이름을 그대로
사용해도 됩니다. 두 토큰은 서버 전용이며 `NEXT_PUBLIC_` 접두사를 붙이면 안 됩니다.

환경 변수 미설정 상태의 Production에서는 스폰서 가스 지출을 보호하기 위해 무료 전송을 차단합니다.

## AdMob SSV 설정

AdMob의 운영 보상형 광고 단위 `ca-app-pub-1201899929581374/3951197726`에서 서버측 인증(SSV)을
활성화하고 다음 callback URL을 입력합니다.

```text
https://ad-gas.vercel.app/api/ad/ssv
```

`NEXT_PUBLIC_RELAYER_API_BASE`를 다른 운영 도메인으로 변경했다면 동일한 서버의
`/api/ad/ssv` URL을 사용합니다. AdMob SSV 테스트 도구의 정상 서명 callback은 `custom_data`가
없더라도 HTTP 200으로 확인하되 실제 challenge는 승인하지 않습니다. URL 테스트 후 실제 운영 광고로
challenge가 `verified`까지 변경되는지 종단 간 확인하고 배포합니다.

Google 공식 테스트 광고는 SSV callback을 보내지 않습니다. 따라서 다음을 분리합니다.

- 실제 출시 AAB/API: `NEXT_PUBLIC_ADMOB_USE_TEST_ADS=false`, `AD_REWARD_SECURITY_MODE=required`
- 테스트 광고 APK/별도 Preview API: `NEXT_PUBLIC_ADMOB_USE_TEST_ADS=true`, `AD_REWARD_SECURITY_MODE=disabled`

운영 API에서 보안 모드를 `disabled`로 바꾸면 클라이언트 광고 완료 이벤트만으로 스폰서 가스가
지출될 수 있으므로 출시 환경에서는 사용하지 않습니다.

## 최종 확인 순서

1. Vercel KV 또는 Upstash Redis 연결
2. Vercel Production 환경 변수 등록 및 재배포
3. AdMob 광고 단위에 SSV callback URL 등록
4. SSV 테스트 도구로 서명 검증 callback HTTP 200 확인
5. 실제 광고 AAB에서 `challenge → 광고 → SSV → 서명 → 릴레이` 전체 흐름 확인
6. 같은 challenge 재전송이 거부되는지 확인
