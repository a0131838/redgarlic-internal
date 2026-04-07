import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Hongsuan Internal",
  description: "Hongsuan Intelligent internal file sharing and employee system.",
};

const bodyStyle = {
  margin: 0,
  minHeight: "100vh",
  background:
    "linear-gradient(180deg, #f6f3ee 0%, #f8fafc 35%, #ffffff 100%)",
  color: "#1f2937",
  fontFamily:
    "\"Segoe UI\", \"PingFang SC\", \"Hiragino Sans GB\", sans-serif",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body style={bodyStyle}>{children}</body>
    </html>
  );
}
