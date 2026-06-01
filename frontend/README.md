This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## AD-GAS: 광고 (앱 우선)

브라우저는 **GPT 리워드(Ad Manager)**, Android/iOS 네이티브 래퍼 앱에서는 **AdMob 리워드**가 사용됩니다. Ad Manager 계정 검토 중이면 **`NEXT_PUBLIC_GOOGLE_REWARDED_AD_SLOT`** 은 비워 두고, **배포 URL에 AdMob 변수**만 채워 Android를 먼저 가져가면 됩니다.

상세 체크리스트: [`../docs/ADS_APP_FIRST_KO.md`](../docs/ADS_APP_FIRST_KO.md) · **AdMob 넣을 곳 표:** [`../docs/ADMOB_WHERE_KO.md`](../docs/ADMOB_WHERE_KO.md) · 네이티브 셸: [`../../mobile/README.md`](../../mobile/README.md)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
