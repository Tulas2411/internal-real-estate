import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nhà Nội Bộ | Quản lý bất động sản",
  description: "Không gian quản lý bất động sản dành cho đội ngũ môi giới",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
    >
      <body>{children}</body>
    </html>
  );
}
