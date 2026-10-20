import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GU 이벤트 | 지유의원",
  description: "지유의원 이벤트 랜딩페이지 모음",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-[#FDFCFB] antialiased">{children}</body>
    </html>
  );
}
