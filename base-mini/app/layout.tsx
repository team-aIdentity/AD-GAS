import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Base Build / 미니앱에서 요구하는 앱 식별 메타. Vercel 등에서는 `NEXT_PUBLIC_BASE_APP_ID`로 덮어쓸 수 있음. */
const baseAppId =
  process.env.NEXT_PUBLIC_BASE_APP_ID ?? "69be497efa9c0ad39d2bcba7";

export const metadata: Metadata = {
  title: "AD-GAS · Base Mini App",
  description: "AD-GAS Base 미니앱",
  other: {
    "base:app_id": baseAppId,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-dvh antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
