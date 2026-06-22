# 광고 시청 검증 게이팅 (Ad-watch Gating)

릴레이 API(`/api/relay/transfer`)가 **광고를 실제로 시청한 사용자에게만** 무료 가스 대납을 제공하도록
강제하는 서버측 게이팅 레이어입니다. 클라이언트 우회(스크립트로 API 직접 호출)와 서버리스 환경에서의
인메모리 한도 무력화 문제를 함께 해결합니다.

## 흐름

```
1. [클라이언트] 전송 직전 → POST /api/ad-challenge
     { from, to, amount, tokenSymbol, chainId, platform, turnstileToken? }
     → 서버가 Redis에 challenge 저장(status: pending) 후 challengeId 반환
2. [앱(AdMob)] prepareRewardVideoAd({ ssv: { customData: challengeId, userId: from } })
     광고 시청 완료 → Google이 SSV 콜백 호출
       GET /api/admob-ssv?...&custom_data=challengeId&signature=...&key_id=...
     → 서버가 Google verifier 공개키로 서명 검증 → challenge status: verified
   [웹(Turnstile)] /api/ad-challenge에서 Turnstile 검증 통과 시 즉시 status: verified
3. [클라이언트] POST /api/relay/transfer { ..., challengeId }
     → 서버가 challenge가 verified·미사용·전송내용 일치인지 확인 → 대납 후 status: consumed
     → Redis 기반 1일 10회 한도 차감
```

- 챌린지는 `from/to/amount/tokenSymbol/chainId`에 바인딩되어 다른 전송에 재사용 불가.
- `consumed` 상태로 1회용 보장(광고 1회 = 대납 1회).
- TTL 10분.

## 활성화 체크리스트

게이팅은 **기본 비활성(off)**. 아래를 모두 마친 뒤 플래그를 켜세요. 켜기 전까지는 기존 동작
(서명 사전검증 + 인메모리 한도)으로 안전하게 운영됩니다.

### 1. Upstash Redis (저장소)
- Vercel 대시보드 → Storage → Upstash Redis 통합 추가(또는 Upstash에서 직접 생성).
- Vercel 통합 시 `KV_REST_API_URL` / `KV_REST_API_TOKEN`이 자동 주입됩니다.
  (직접 생성 시 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`도 인식)

### 2. AdMob SSV (앱 — 주 수익 경로)
- AdMob 콘솔 → 해당 **리워드 광고 단위** → Server-Side Verification 설정.
- SSV 콜백 URL 등록:
  ```
  https://<배포도메인>/api/admob-ssv
  ```
- 클라이언트는 `customData`에 challengeId, `userId`에 지갑 주소를 자동 전달합니다(코드 반영 완료).

### 3. Cloudflare Turnstile (웹 — best-effort 봇 방지)
- Turnstile에서 사이트 추가 → site key / secret 발급.
- 환경변수:
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (클라이언트)
  - `TURNSTILE_SECRET_KEY` (서버)
- 둘 다 설정하거나 둘 다 비워두세요. (secret만 있고 토큰이 없으면 웹 챌린지가 거부됨)
- 참고: AdSense 리워드 SSV가 가능해지기 전까지 웹은 "사람 확인 + 한도"의 best-effort 게이팅입니다.

### 4. 플래그 ON (서버·클라이언트 동시)
```
AD_GATING_ENABLED=true
NEXT_PUBLIC_AD_GATING_ENABLED=true
```
> 한쪽만 켜면 안 됩니다. 서버만 켜면 클라이언트가 challengeId를 안 보내 fail-closed로 막히고,
> 클라이언트만 켜면 서버가 챌린지를 무시합니다.

## 관련 파일
- `frontend/src/lib/server/adGating.ts` — 챌린지/한도 (Upstash Redis)
- `frontend/src/lib/server/admobSsv.ts` — Google SSV 서명 검증
- `frontend/src/lib/server/turnstile.ts` — Turnstile 서버 검증
- `frontend/src/lib/turnstileClient.ts` — Turnstile 클라이언트 토큰 획득
- `frontend/src/app/api/ad-challenge/route.ts` — 챌린지 발급
- `frontend/src/app/api/admob-ssv/route.ts` — AdMob SSV 콜백
- `frontend/src/app/api/relay/transfer/route.ts` — 릴레이(게이팅 적용 지점)
