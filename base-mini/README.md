# AD-GAS Base Mini App

[OnchainKit](https://onchainkit.xyz) + **MiniKit** 기반의 **Base / Farcaster 미니앱**용 Next.js 앱입니다.  
메인 웹앱은 `web/frontend`를 그대로 두고, 미니앱 전용 UI·진입점만 이 패키지에서 다룹니다.

## 요구 사항

- **Node.js 20+** 권장 (Next 15 / OnchainKit 엔진 호환)
- **CDP OnchainKit API Key** — [CDP 포털](https://portal.cdp.coinbase.com/products/onchainkit)에서 발급

## 설정

1. 의존성 설치 (이 폴더에서):

   ```bash
   npm install
   ```

2. 환경 변수:

   ```bash
   cp .env.example .env.local
   ```

   `NEXT_PUBLIC_ONCHAINKIT_API_KEY`에 CDP 키를 넣으세요.

3. **미니앱 manifest**  
   배포 도메인이 정해지면 `public/.well-known/farcaster.json`의 `homeUrl`, `iconUrl`을 **실제 HTTPS URL**로 바꾸세요.  
   (Farcaster / Base 미니앱 검증에 필요합니다.)

4. 로고: `public/logo.png` (없으면 프론트엔드 `web/frontend/public/logo.png`를 복사해 사용)

## Vercel로 배포 (Base Mini App)

**같은 레포(모노레포) 그대로** 두고, Vercel에서 **이 폴더만** 루트로 잡아 배포하면 됩니다. 별도 레포는 필요 없습니다.

### 1. Git에 올리기

AD-GAS 레포가 GitHub/GitLab 등에 있어야 합니다. (아직이면 `git init` → 원격 추가 → push)

### 2. Vercel에서 프로젝트 만들기

1. [vercel.com](https://vercel.com) 로그인 → **Add New… → Project**
2. 해당 Git 저장소 **Import**
3. **가장 중요:** **Root Directory**를 `web/base-mini` 로 설정  
   (비워 두면 상위에 `package.json`이 없어 빌드가 실패할 수 있음)
4. Framework Preset: **Next.js** (자동 감지)
5. **Environment Variables**에 추가:
   - `NEXT_PUBLIC_ONCHAINKIT_API_KEY` = CDP OnchainKit 키 값
   - (선택) `NEXT_PUBLIC_ONCHAINKIT_ANALYTICS` = `false` 로 분석 끄기
6. **Deploy**

배포가 끝나면 **`https://xxxx.vercel.app`** 같은 **Production URL**이 생깁니다.

### 3. CDP에 프로덕션 도메인 등록

[CDP 포털](https://portal.cdp.coinbase.com) → OnchainKit 키 설정에서 **허용 도메인(Allowed domains)** 에  
`https://당신-프로젝트.vercel.app` (및 커스텀 도메인이 있으면 그것도) 추가하세요.  
안 넣으면 브라우저에서 RPC 등 요청이 **CORS / Failed to fetch** 로 막힐 수 있습니다.

### 4. `farcaster.json` 맞추기 (두 번째 배포)

첫 배포로 받은 **정확한 HTTPS URL**로 `public/.well-known/farcaster.json`을 수정합니다.

```json
{
  "miniapp": {
    "version": "1",
    "name": "AD-GAS",
    "homeUrl": "https://여기에-배포-도메인",
    "iconUrl": "https://여기에-배포-도메인/logo.png"
  }
}
```

저장 후 **커밋 → push** 하면 Vercel이 다시 배포합니다.  
이후 Base / Farcaster 미니앱 콘솔에서 manifest 검증 시 이 URL과 일치해야 합니다.

### 5. 동작 확인

- 브라우저에서 `https://당신-도메인/` 열림
- `https://당신-도메인/.well-known/farcaster.json` 이 JSON 그대로 보임
- `https://당신-도메인/logo.png` 가 이미지로 열림

---

## 실행

- 개발: `npm run dev` → 기본 **http://localhost:3001**
- 프로덕션: `npm run build` → `npm run start`

## 기존 프로젝트와의 관계

- **스마트 컨트랙트 / API**는 `web/frontend`와 동일한 백엔드·RPC를 가리키도록 `.env.local`에 URL·주소를 맞추면 됩니다.
- 미니앱은 보통 **별도 배포 URL**이 필요하므로, CORS·허용 오리진 설정을 API 측에 추가하는 것을 잊지 마세요.

## 콘솔 `TypeError: Failed to fetch`

브라우저는 **어떤 URL 요청이 막혔는지** Network 탭에만 정확히 보여 줍니다. 흔한 원인은 아래와 같습니다.

1. **OnchainKit 분석(analytics)**  
   기본값은 켜져 있어, 로컬에서 분석 엔드포인트로의 `fetch`가 실패하면 콘솔에 `Failed to fetch`가 날 수 있습니다.  
   이 레포는 **`next dev`에서는 분석을 끄고**, `next build` + `next start`일 때만 켜지도록 `app/providers.tsx`에 맞춰 두었습니다.  
   강제로 켜려면 `NEXT_PUBLIC_ONCHAINKIT_ANALYTICS=true`, 끄려면 `=false` 를 `.env.local`에 넣으세요.

2. **CDP RPC / API 키 도메인**  
   `NEXT_PUBLIC_ONCHAINKIT_API_KEY`를 쓰면 RPC가 `https://api.developer.coinbase.com/...` 로 나갑니다.  
   [CDP 포털](https://portal.cdp.coinbase.com)에서 해당 키(프로젝트)에 **`http://localhost:3001`**(또는 사용 중인 포트)을 **허용 도메인**으로 등록하지 않으면 CORS로 `Failed to fetch`가 날 수 있습니다.

3. **광고/추적 차단 확장 프로그램**  
   `coinbase.com`, `walletconnect` 등 도메인을 막으면 지갑·RPC 요청이 같은 메시지로 실패할 수 있습니다.

## 스타일 / 빌드 (Tailwind · OnchainKit)

- **OnchainKit `styles.css`는 Tailwind v4 전용**이라, 이 프로젝트도 **Tailwind v4 + `@tailwindcss/postcss`** 를 사용합니다. (v3만 쓰면 `@layer base` 관련 빌드 에러가 납니다.)
- OnchainKit 스타일은 `app/globals.css`에서 `@import "@coinbase/onchainkit/styles.css";` 로만 불러옵니다. **`@import "tailwindcss"` 보다 위에** 두어야 Google Fonts `@import` 순서 경고가 나지 않습니다. `providers.tsx`에서는 중복 import 하지 않습니다.

### `Cannot find native binding` (@tailwindcss/oxide)

- **Node 20+** 사용 후:

  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

- 그래도 동일하면(Apple Silicon 예시) 네이티브 패키지를 맞는 버전으로 한 번 더 설치해 보세요. (`tailwindcss`와 같은 **4.1.x**)

  ```bash
  npm install @tailwindcss/oxide-darwin-arm64@4.1.6 --save-optional
  ```

## 알림 프록시 (선택)

MiniKit 알림 훅은 기본적으로 `/api/notify`로 프록시합니다. 서버에서 처리하려면 해당 라우트를 구현하거나, `OnchainKitProvider`의 `miniKit.notificationProxyUrl`을 변경하세요.
