import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "국가인권위원회 결정문 검색",
  description: "국가인권위원회 결정문 전문 검색 서비스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
